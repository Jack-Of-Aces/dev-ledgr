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

// Dev records live in public.profiles (keyed by auth.users.id). Email is read
// from auth.users, which Supabase Auth owns; BYOK keys from profile_secrets.
const profileSelect = `
	select p.id::text, p.username, coalesce(nullif(p.full_name, ''), p.username), coalesce(u.email, ''),
		coalesce(p.avatar_url, ''), coalesce(p.headline, ''), coalesce(p.bio, ''), coalesce(p.github_url, ''),
		coalesce(p.portfolio_url, ''), p.portfolio_valid_until, p.plan, s.profile_id is not null,
		coalesce(p.skills, '{}'), coalesce(p.role, 'candidate'), p.updated_at
	from public.profiles p
	left join auth.users u on u.id = p.id
	left join public.profile_secrets s on s.profile_id = p.id`

func scanUser(row pgx.Row) (*model.UserProfile, error) {
	var u model.UserProfile
	var role string
	err := row.Scan(&u.ID, &u.Username, &u.Name, &u.Email, &u.AvatarURL, &u.Headline, &u.Bio, &u.GitHubURL,
		&u.PortfolioURL, &u.PortfolioValidUntil, &u.Plan, &u.HasAPIKey, &u.StatedSkills, &role, &u.UpdatedAt)
	if err != nil {
		return nil, mapErr(err)
	}
	u.Role = model.RoleFromDB(role)
	u.StatedSkills = nonNil(u.StatedSkills)
	return &u, nil
}

func (s *Store) GetUserByID(ctx context.Context, id string) (*model.UserProfile, error) {
	if !IsUUID(id) {
		return nil, ErrNotFound
	}
	return scanUser(s.pool.QueryRow(ctx, profileSelect+` where p.id = $1`, id))
}

func (s *Store) GetUserByUsername(ctx context.Context, username string) (*model.UserProfile, error) {
	return scanUser(s.pool.QueryRow(ctx, profileSelect+` where lower(p.username) = lower($1)`, username))
}

func (s *Store) UsernameAvailable(ctx context.Context, username string) (bool, error) {
	var taken bool
	err := s.pool.QueryRow(ctx, `select exists(select 1 from public.profiles where lower(username) = lower($1))`, username).Scan(&taken)
	return !taken, err
}

// SetUsername changes a dev's handle (e.g. to the one chosen at sign-up,
// replacing the trigger-generated default). Returns ErrConflict if taken.
func (s *Store) SetUsername(ctx context.Context, userID, username string) error {
	_, err := s.pool.Exec(ctx, `update public.profiles set username = $2, updated_at = now() where id = $1`, userID, username)
	return mapErr(err)
}

// GetAPIKeyCiphertext returns the encrypted BYOK key, or nil if none is stored.
func (s *Store) GetAPIKeyCiphertext(ctx context.Context, userID string) ([]byte, error) {
	var ct []byte
	err := s.pool.QueryRow(ctx, `select api_key_encrypted from public.profile_secrets where profile_id = $1`, userID).Scan(&ct)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return ct, err
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

// EnsureDev returns the profile for a Supabase user, creating it if the
// on_auth_user_created trigger has not (e.g. users who predate it). It is
// idempotent and safe to race.
func (s *Store) EnsureDev(ctx context.Context, id AuthIdentity) (*model.UserProfile, bool, error) {
	u, err := s.GetUserByID(ctx, id.ID)
	if err == nil || !errors.Is(err, ErrNotFound) {
		return u, false, err
	}

	base := id.Username
	if !usernameValid.MatchString(base) {
		base, _, _ = strings.Cut(id.Email, "@")
	}
	name := strings.TrimSpace(id.Name)
	if name == "" {
		name = base
	}
	var newID string
	err = s.createUser(ctx, base, func(username string) pgx.Row {
		return s.pool.QueryRow(ctx, `
			insert into public.profiles (id, username, full_name, avatar_url, github_url)
			values ($1, $2, $3, nullif($4, ''), nullif($5, ''))
			on conflict (id) do nothing
			returning id::text`, id.ID, username, name, id.AvatarURL, id.GitHubURL)
	}, &newID)
	created := err == nil
	if err != nil && !errors.Is(err, ErrNotFound) { // ErrNotFound: lost the race, row exists
		return nil, false, err
	}
	u, err = s.GetUserByID(ctx, id.ID)
	return u, created, err
}

// DeleteDev removes a dev's profile (usually already gone via the auth.users
// cascade) and reopens problems left without an active builder.
func (s *Store) DeleteDev(ctx context.Context, userID string) error {
	if !IsUUID(userID) {
		return nil
	}
	return mapErr(pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `delete from public.profiles where id = $1`, userID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, reopenOrphanedProblems)
		return err
	}))
}

// reopenOrphanedProblems returns in-flight problems with no active claim to the pool.
const reopenOrphanedProblems = `
	update public.problems pr set status = 'Available', status_updated_at = now()
	where pr.status in ('In Progress', 'Seeking Contributors')
	  and not exists (select 1 from public.claimed_projects c
	                  where c.problem_id = pr.id and c.collaboration_status = 'Active')`

var (
	usernameValid = regexp.MustCompile(`^[a-zA-Z0-9._-]{3,30}$`)
	usernameStrip = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)
)

// createUser runs insert with a username derived from base, retrying with a
// random suffix when the handle is already taken. scan receives the returned row.
func (s *Store) createUser(ctx context.Context, base string, insert func(username string) pgx.Row, dst ...any) error {
	candidate := usernameStrip.ReplaceAllString(strings.ToLower(base), "_")
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
		err := mapErr(insert(username).Scan(dst...))
		if !errors.Is(err, ErrConflict) {
			return err
		}
	}
	return ErrConflict
}

// ProfileUpdate carries validated profile fields. Nil pointers keep the
// stored value. When APIKeyChanged, a nil ciphertext deletes the stored key.
type ProfileUpdate struct {
	Name, Headline, Bio             string
	AvatarURL, GitHubURL, Portfolio *string
	Plan                            string
	StatedSkills                    []string
	APIKeyCiphertext                []byte
	APIKeyChanged                   bool
}

func (s *Store) UpdateProfile(ctx context.Context, userID string, p ProfileUpdate) (*model.UserProfile, error) {
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			update public.profiles set
				full_name = $2,
				headline = $3,
				bio = $4,
				avatar_url = coalesce($5, avatar_url),
				github_url = coalesce($6, github_url),
				portfolio_url = coalesce($7, portfolio_url),
				plan = $8,
				skills = $9,
				updated_at = now()
			where id = $1`,
			userID, p.Name, p.Headline, p.Bio, p.AvatarURL, p.GitHubURL, p.Portfolio, p.Plan, nonNil(p.StatedSkills))
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		if !p.APIKeyChanged {
			return nil
		}
		if p.APIKeyCiphertext == nil {
			_, err = tx.Exec(ctx, `delete from public.profile_secrets where profile_id = $1`, userID)
			return err
		}
		_, err = tx.Exec(ctx, `
			insert into public.profile_secrets (profile_id, api_key_encrypted) values ($1, $2)
			on conflict (profile_id) do update set api_key_encrypted = excluded.api_key_encrypted, updated_at = now()`,
			userID, p.APIKeyCiphertext)
		return err
	})
	if err != nil {
		return nil, mapErr(err)
	}
	return s.GetUserByID(ctx, userID)
}
