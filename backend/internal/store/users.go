package store

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/security"
)

const userColumns = `id::text, username, name, email, avatar_url, headline, bio, github_url,
	portfolio_valid_until, plan, api_key_encrypted is not null, stated_skills, role, updated_at`

func scanUser(row pgx.Row) (*model.UserProfile, error) {
	var u model.UserProfile
	var email *string
	var role string
	err := row.Scan(&u.ID, &u.Username, &u.Name, &email, &u.AvatarURL, &u.Headline, &u.Bio, &u.GitHubURL,
		&u.PortfolioValidUntil, &u.Plan, &u.HasAPIKey, &u.StatedSkills, &role, &u.UpdatedAt)
	if err != nil {
		return nil, mapErr(err)
	}
	u.Email = deref(email)
	u.Role = model.Role(role)
	u.StatedSkills = nonNil(u.StatedSkills)
	return &u, nil
}

func (s *Store) GetUserByID(ctx context.Context, id string) (*model.UserProfile, error) {
	return scanUser(s.pool.QueryRow(ctx, `select `+userColumns+` from users where id = $1`, id))
}

func (s *Store) GetUserByUsername(ctx context.Context, username string) (*model.UserProfile, error) {
	return scanUser(s.pool.QueryRow(ctx, `select `+userColumns+` from users where lower(username) = lower($1)`, username))
}

func (s *Store) UsernameAvailable(ctx context.Context, username string) (bool, error) {
	var taken bool
	err := s.pool.QueryRow(ctx, `select exists(select 1 from users where lower(username) = lower($1))`, username).Scan(&taken)
	return !taken, err
}

// GetAPIKeyCiphertext returns the encrypted BYOK key, or nil if none is stored.
func (s *Store) GetAPIKeyCiphertext(ctx context.Context, userID string) ([]byte, error) {
	var ct []byte
	err := s.pool.QueryRow(ctx, `select api_key_encrypted from users where id = $1`, userID).Scan(&ct)
	return ct, mapErr(err)
}

// AuthIdentity is a Supabase Auth user, normalized for dev-record creation.
type AuthIdentity struct {
	ID        string // auth.users.id
	Email     string
	Username  string // preferred handle; derived from Email when empty
	Name      string
	AvatarURL string
	GitHubURL string
}

// EnsureDev returns the dev record for a Supabase user, creating it on first
// sight. It is idempotent and safe to race (webhook vs. first API request).
func (s *Store) EnsureDev(ctx context.Context, id AuthIdentity) (*model.UserProfile, bool, error) {
	u, err := s.GetUserByID(ctx, id.ID)
	if err == nil || !errors.Is(err, ErrNotFound) {
		return u, false, err
	}

	// Emails are unique; if another record already uses this one (e.g. demo
	// seed data), create the dev without it rather than failing sign-in.
	email := nullIfEmpty(strings.ToLower(id.Email))
	if email != nil {
		var taken bool
		if err := s.pool.QueryRow(ctx, `select exists(select 1 from users where lower(email) = $1)`, *email).Scan(&taken); err != nil {
			return nil, false, err
		}
		if taken {
			email = nil
		}
	}

	base := id.Username
	if !usernameValid.MatchString(base) {
		base, _, _ = strings.Cut(id.Email, "@")
	}
	name := strings.TrimSpace(id.Name)
	if name == "" {
		name = base
	}
	u, err = s.createUser(ctx, base, func(username string) pgx.Row {
		return s.pool.QueryRow(ctx, `
			insert into users (id, username, name, email, avatar_url, github_url)
			values ($1, $2, $3, $4, $5, $6)
			on conflict (id) do nothing
			returning `+userColumns, id.ID, username, name, email, id.AvatarURL, id.GitHubURL)
	})
	if errors.Is(err, ErrNotFound) {
		// Lost the race: another request created it first.
		u, err = s.GetUserByID(ctx, id.ID)
		return u, false, err
	}
	return u, err == nil, err
}

// SyncEmail mirrors an email change from Supabase Auth.
func (s *Store) SyncEmail(ctx context.Context, userID, email string) error {
	_, err := s.pool.Exec(ctx, `update users set email = $2, updated_at = now() where id = $1 and email is distinct from $2`,
		userID, nullIfEmpty(strings.ToLower(email)))
	return mapErr(err)
}

// DeleteDev removes a dev record, first returning their in-flight Launchpad
// claims to the open pool.
func (s *Store) DeleteDev(ctx context.Context, userID string) error {
	return mapErr(pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `
			update ideas set status = 'open', claimed_by = null, claimed_at = null, status_updated_at = now()
			where claimed_by = $1 and status in ('in_progress', 'seeking_contributors')`, userID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `delete from users where id = $1`, userID)
		return err
	}))
}

var usernameValid = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,30}$`)

// EnsureDevUser returns (creating if needed) a sandbox persona with the given role.
func (s *Store) EnsureDevUser(ctx context.Context, username, name string, role model.Role) (*model.UserProfile, error) {
	return scanUser(s.pool.QueryRow(ctx, `
		insert into users (username, name, role) values ($1, $2, $3)
		on conflict ((lower(username))) do update set role = excluded.role, updated_at = now()
		returning `+userColumns, username, name, role))
}

var usernameStrip = regexp.MustCompile(`[^a-zA-Z0-9_-]+`)

// createUser inserts with a username derived from base, retrying with a
// random suffix when the handle is already taken.
func (s *Store) createUser(ctx context.Context, base string, insert func(username string) pgx.Row) (*model.UserProfile, error) {
	candidate := usernameStrip.ReplaceAllString(base, "_")
	if len(candidate) > 24 {
		candidate = candidate[:24]
	}
	for len(candidate) < 3 {
		candidate += "_"
	}
	for attempt := 0; attempt < 5; attempt++ {
		username := candidate
		if attempt > 0 {
			username = candidate + "_" + security.RandomHex(4)
		}
		u, err := scanUser(insert(username))
		if !errors.Is(err, ErrConflict) {
			return u, err
		}
	}
	return nil, ErrConflict
}

// ProfileUpdate carries validated profile fields. APIKey nil leaves the
// stored key untouched; an empty string clears it.
type ProfileUpdate struct {
	Name, Headline, Bio  string
	AvatarURL, GitHubURL *string
	Email                *string
	Plan                 string
	StatedSkills         []string
	APIKeyCiphertext     []byte
	APIKeyChanged        bool
}

func (s *Store) UpdateProfile(ctx context.Context, userID string, p ProfileUpdate) (*model.UserProfile, error) {
	var email any
	if p.Email != nil {
		email = nullIfEmpty(*p.Email)
	}
	return scanUser(s.pool.QueryRow(ctx, `
		update users set
			name = $2,
			headline = $3,
			bio = $4,
			avatar_url = coalesce($5, avatar_url),
			github_url = coalesce($6, github_url),
			email = case when $7 then $8 else email end,
			plan = $9,
			stated_skills = $10,
			api_key_encrypted = case when $11 then $12 else api_key_encrypted end,
			updated_at = now()
		where id = $1
		returning `+userColumns,
		userID, p.Name, p.Headline, p.Bio, p.AvatarURL, p.GitHubURL,
		p.Email != nil, email, p.Plan, nonNil(p.StatedSkills), p.APIKeyChanged, p.APIKeyCiphertext))
}
