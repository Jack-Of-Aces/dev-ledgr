package store

import (
	"context"
	"errors"
	"log/slog"
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
		coalesce(p.skills, '{}'), coalesce(p.role, 'candidate'), p.updated_at,
		coalesce(p.engineering_track, ''), coalesce(p.target_role, ''), coalesce(p.experience_level, ''),
		coalesce(p.github_username, ''), coalesce(p.github_connected, false), coalesce(p.onboarding_completed, false),
		coalesce(p.auth_provider, ''), coalesce(p.contact_email, '')
	from public.profiles p
	left join auth.users u on u.id = p.id
	left join public.profile_secrets s on s.profile_id = p.id`

func scanUser(row pgx.Row) (*model.UserProfile, error) {
	var u model.UserProfile
	var role string
	err := row.Scan(&u.ID, &u.Username, &u.Name, &u.Email, &u.AvatarURL, &u.Headline, &u.Bio, &u.GitHubURL,
		&u.PortfolioURL, &u.PortfolioValidUntil, &u.Plan, &u.HasAPIKey, &u.StatedSkills, &role, &u.UpdatedAt,
		&u.EngineeringTrack, &u.TargetRole, &u.ExperienceLevel, &u.GitHubUsername, &u.GitHubConnected, &u.OnboardingCompleted,
		&u.AuthProvider, &u.ContactEmail)
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

// SetRole changes a dev's platform role. This is the only writer of
// public.profiles.role: migration 0003 revoked the column from the anon and
// authenticated Supabase roles specifically so a dev cannot promote themselves,
// which means the admin console is the only non-SQL path to a reviewer account.
// Returns ErrNotFound when no profile carries that id.
func (s *Store) SetRole(ctx context.Context, userID string, role model.Role) error {
	if !IsUUID(userID) || !role.Valid() {
		return ErrNotFound
	}
	tag, err := s.pool.Exec(ctx,
		`update public.profiles set role = $2, updated_at = now() where id = $1`,
		userID, model.RoleToDB(role))
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListPlatformUsers returns the admin roster: a substring search over username,
// name and email, or the whole book when q is empty. Ordered so the people
// holding a staff role come first, since managing roles is the reason to call.
func (s *Store) ListPlatformUsers(ctx context.Context, q string, limit int) ([]model.PlatformUser, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `
		select p.id::text, p.username, coalesce(nullif(p.full_name, ''), p.username),
			coalesce(u.email, ''), coalesce(p.avatar_url, ''),
			coalesce(nullif(p.role, 'candidate'), 'candidate'), p.updated_at
		from public.profiles p
		left join auth.users u on u.id = p.id
		where $1 = '' or p.username ilike '%' || $1 || '%'
			or coalesce(p.full_name, '') ilike '%' || $1 || '%'
			or coalesce(u.email, '') ilike '%' || $1 || '%'
		order by (coalesce(p.role, 'candidate') in ('reviewer', 'admin')) desc,
			lower(p.username)
		limit $2`, q, limit)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	out := []model.PlatformUser{}
	for rows.Next() {
		var u model.PlatformUser
		var role string
		if err := rows.Scan(&u.ID, &u.Username, &u.Name, &u.Email, &u.AvatarURL, &role, &u.UpdatedAt); err != nil {
			return nil, mapErr(err)
		}
		u.Role = model.RoleFromDB(role)
		out = append(out, u)
	}
	return out, mapErr(rows.Err())
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
	ID       string // auth.users.id
	Email    string
	Provider string // "github", "google" or ""
	Username string // preferred handle; derived from Email when empty
	Name     string
	// AvatarURL and the GitHub fields come from the provider's own profile, so
	// they are the account's real details rather than anything the client chose.
	AvatarURL      string
	GitHubURL      string // https://github.com/<login>
	GitHubUsername string // the bare login
}

// EnsureDev returns the profile for a Supabase user, creating it if the
// on_auth_user_created trigger has not (e.g. users who predate it). It is
// idempotent and safe to race.
func (s *Store) EnsureDev(ctx context.Context, id AuthIdentity) (*model.UserProfile, bool, error) {
	u, err := s.GetUserByID(ctx, id.ID)
	if err == nil {
		return s.linkIdentity(ctx, u, id), false, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return nil, false, err
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
			insert into public.profiles (id, username, full_name, avatar_url, github_url,
				github_username, github_connected, auth_provider)
			values ($1, $2, $3, nullif($4, ''), nullif($5, ''), nullif($6, ''), $7, nullif($8, ''))
			on conflict (id) do nothing
			returning id::text`, id.ID, username, name, id.AvatarURL, id.GitHubURL,
			id.GitHubUsername, id.GitHubUsername != "", id.Provider)
	}, &newID)
	created := err == nil
	if err != nil && !errors.Is(err, ErrNotFound) { // ErrNotFound: lost the race, row exists
		return nil, false, err
	}
	u, err = s.GetUserByID(ctx, id.ID)
	return u, created, err
}

// linkIdentity backfills the provider-derived columns on a profile that the
// on_auth_user_created trigger created before this code ran.
//
// The trigger builds the row from the email alone, so it leaves auth_provider,
// github_username and github_connected empty even when the dev signed in with
// GitHub and the provider had already proven the account. Without this the
// GitHub linkage existed only in the browser, and was gone as soon as the
// authoritative dev record replaced the provisional one.
//
// Only blanks are filled. These three describe provenance, not dev-authored
// content, so an already-populated value was set deliberately and must survive.
// Nothing here touches name, headline, bio or skills: those belong to the dev,
// and the trigger's guesses at them are the dev's to correct in settings.
// identityLinkNeeded reports whether linkIdentity has a blank to fill, and so
// whether it is worth a write. A dev who has since set a GitHub handle by hand
// must keep it, and a profile the trigger already labelled is left alone.
func identityLinkNeeded(u *model.UserProfile, id AuthIdentity) (provider, github bool) {
	return u.AuthProvider == "" && id.Provider != "", u.GitHubUsername == "" && id.GitHubUsername != ""
}

func (s *Store) linkIdentity(ctx context.Context, u *model.UserProfile, id AuthIdentity) *model.UserProfile {
	// EnsureDev is called from the auth middleware on every authenticated
	// request, so a profile that is already linked must cost no extra queries.
	providerPending, githubPending := identityLinkNeeded(u, id)
	if !providerPending && !githubPending {
		return u
	}

	// Every right-hand expression reads the pre-update row, so the
	// github_connected test sees the stored handle, not the one being written.
	if _, err := s.pool.Exec(ctx, `
		update public.profiles set
			auth_provider    = case when auth_provider = '' then $2 else auth_provider end,
			github_username  = case when github_username = '' and $3 <> '' then $3 else github_username end,
			github_connected = case when github_username = '' and $3 <> '' then true else github_connected end
		where id = $1`, u.ID, id.Provider, id.GitHubUsername); err != nil {
		slog.ErrorContext(ctx, "link provider identity columns", "err", err, "user_id", u.ID)
		return u
	}

	updated, err := s.GetUserByID(ctx, u.ID)
	if err != nil {
		slog.ErrorContext(ctx, "reload profile after linking identity", "err", err, "user_id", u.ID)
		return u
	}
	return updated
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
	ContactEmail                    *string
	Plan                            string
	StatedSkills                    []string
	APIKeyCiphertext                []byte
	APIKeyChanged                   bool

	// Onboarding fields. Pointers follow the same rule as the other optional
	// columns: nil keeps the stored value, so a client that does not send them
	// cannot blank a field it never knew about.
	EngineeringTrack, TargetRole, ExperienceLevel, GitHubUsername *string
	GitHubConnected                                               *bool
	OnboardingCompleted                                           *bool
}

// updateProfileSQL is a named constant so the schema contract test can check
// its columns against the migration history without a database.
const updateProfileSQL = `
	update public.profiles set
		full_name = $2,
		headline = $3,
		bio = $4,
		avatar_url = coalesce($5, avatar_url),
		github_url = coalesce($6, github_url),
		portfolio_url = coalesce($7, portfolio_url),
		plan = $8,
		skills = $9,
		engineering_track = coalesce($10, engineering_track),
		target_role = coalesce($11, target_role),
		experience_level = coalesce($12, experience_level),
		github_username = coalesce($13, github_username),
		github_connected = coalesce($14, github_connected),
		onboarding_completed = coalesce($15, onboarding_completed),
		contact_email = coalesce($16, contact_email),
		updated_at = now()
	where id = $1`

func (s *Store) UpdateProfile(ctx context.Context, userID string, p ProfileUpdate) (*model.UserProfile, error) {
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, updateProfileSQL,
			userID, p.Name, p.Headline, p.Bio, p.AvatarURL, p.GitHubURL, p.Portfolio, p.Plan, nonNil(p.StatedSkills),
			p.EngineeringTrack, p.TargetRole, p.ExperienceLevel, p.GitHubUsername, p.GitHubConnected, p.OnboardingCompleted,
			p.ContactEmail)
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
