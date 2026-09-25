package store

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

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

// GitHubIdentity is the subset of the GitHub user payload used for sign-in.
type GitHubIdentity struct {
	ID        int64
	Login     string
	Name      string
	Email     string
	AvatarURL string
	HTMLURL   string
}

// UpsertGitHubUser finds the user linked to a GitHub account, links an
// existing email-only account with the same verified email, or creates one.
func (s *Store) UpsertGitHubUser(ctx context.Context, gh GitHubIdentity) (*model.UserProfile, error) {
	u, err := scanUser(s.pool.QueryRow(ctx, `select `+userColumns+` from users where github_id = $1`, gh.ID))
	if err == nil || !errors.Is(err, ErrNotFound) {
		return u, err
	}

	if gh.Email != "" {
		u, err := scanUser(s.pool.QueryRow(ctx, `
			update users set github_id = $1,
				github_url = coalesce(nullif(github_url, ''), $2),
				avatar_url = coalesce(nullif(avatar_url, ''), $3),
				updated_at = now()
			where lower(email) = lower($4) and github_id is null
			returning `+userColumns, gh.ID, gh.HTMLURL, gh.AvatarURL, gh.Email))
		if err == nil || !errors.Is(err, ErrNotFound) {
			return u, err
		}
	}

	name := gh.Name
	if name == "" {
		name = gh.Login
	}
	return s.createUser(ctx, gh.Login, func(username string) pgx.Row {
		return s.pool.QueryRow(ctx, `
			insert into users (username, name, email, avatar_url, github_id, github_url)
			values ($1, $2, $3, $4, $5, $6)
			returning `+userColumns, username, name, nullIfEmpty(gh.Email), gh.AvatarURL, gh.ID, gh.HTMLURL)
	})
}

// FindOrCreateEmailUser returns the account for an email, creating it on first sign-in.
func (s *Store) FindOrCreateEmailUser(ctx context.Context, email string) (*model.UserProfile, error) {
	u, err := scanUser(s.pool.QueryRow(ctx, `select `+userColumns+` from users where lower(email) = lower($1)`, email))
	if err == nil || !errors.Is(err, ErrNotFound) {
		return u, err
	}
	local, _, _ := strings.Cut(email, "@")
	return s.createUser(ctx, local, func(username string) pgx.Row {
		return s.pool.QueryRow(ctx, `
			insert into users (username, name, email) values ($1, $2, $3)
			returning `+userColumns, username, local, email)
	})
}

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

func (s *Store) CreateSession(ctx context.Context, userID string, tokenHash []byte, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx, `insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)`,
		tokenHash, userID, expiresAt)
	return err
}

// SessionUser resolves a session token hash to its user and expiry.
func (s *Store) SessionUser(ctx context.Context, tokenHash []byte) (*model.UserProfile, time.Time, error) {
	var expiresAt time.Time
	var userID string
	err := s.pool.QueryRow(ctx, `select user_id::text, expires_at from sessions where token_hash = $1 and expires_at > now()`,
		tokenHash).Scan(&userID, &expiresAt)
	if err != nil {
		return nil, time.Time{}, mapErr(err)
	}
	u, err := s.GetUserByID(ctx, userID)
	return u, expiresAt, err
}

func (s *Store) DeleteSession(ctx context.Context, tokenHash []byte) error {
	_, err := s.pool.Exec(ctx, `delete from sessions where token_hash = $1`, tokenHash)
	return err
}

// PurgeExpired removes stale sessions and magic links.
func (s *Store) PurgeExpired(ctx context.Context) error {
	if _, err := s.pool.Exec(ctx, `delete from sessions where expires_at < now()`); err != nil {
		return err
	}
	_, err := s.pool.Exec(ctx, `delete from magic_links where expires_at < now() - interval '1 day'`)
	return err
}

func (s *Store) CreateMagicLink(ctx context.Context, email string, tokenHash []byte, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx, `insert into magic_links (token_hash, email, expires_at) values ($1, $2, $3)`,
		tokenHash, email, expiresAt)
	return err
}

func (s *Store) RecentMagicLinks(ctx context.Context, email string, since time.Time) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `select count(*) from magic_links where lower(email) = lower($1) and created_at > $2`,
		email, since).Scan(&n)
	return n, err
}

// ConsumeMagicLink marks a link used exactly once and returns its email.
func (s *Store) ConsumeMagicLink(ctx context.Context, tokenHash []byte) (string, error) {
	var email string
	err := s.pool.QueryRow(ctx, `
		update magic_links set used_at = now()
		where token_hash = $1 and used_at is null and expires_at > now()
		returning email`, tokenHash).Scan(&email)
	return email, mapErr(err)
}
