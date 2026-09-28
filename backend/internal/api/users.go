package api

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

var (
	usernamePattern   = regexp.MustCompile(`^[a-zA-Z0-9._-]{3,30}$`)
	reservedUsernames = []string{"me", "available", "admin", "api", "settings", "dashboard", "login", "p"}
)

// GET /api/v1/users/me returns the caller's full profile.
func (s *Server) getMe(w http.ResponseWriter, r *http.Request) error {
	writeJSON(w, http.StatusOK, devFrom(r.Context()))
	return nil
}

// GET /api/v1/users/{username} returns a public profile (the full profile to its owner).
func (s *Server) getUser(w http.ResponseWriter, r *http.Request) error {
	u, err := s.store.GetUserByUsername(r.Context(), r.PathValue("username"))
	if errors.Is(err, store.ErrNotFound) {
		return errNotFound("User not found")
	}
	if err != nil {
		return err
	}
	if dev := devFrom(r.Context()); dev != nil && dev.ID == u.ID {
		writeJSON(w, http.StatusOK, u)
		return nil
	}
	writeJSON(w, http.StatusOK, u.Public())
	return nil
}

// GET /api/v1/users/available?username=
func (s *Server) usernameAvailable(w http.ResponseWriter, r *http.Request) error {
	name := r.URL.Query().Get("username")
	if !usernamePattern.MatchString(name) {
		v := validationErrors{}
		v.add("username", "Username must be 3-30 characters of letters, digits, '.', '_' or '-'")
		return v.err()
	}
	available := !slices.Contains(reservedUsernames, strings.ToLower(name))
	if available {
		var err error
		if available, err = s.store.UsernameAvailable(r.Context(), name); err != nil {
			return err
		}
	}
	writeJSON(w, http.StatusOK, map[string]bool{"available": available})
	return nil
}

// usernameUpdateRequest is the body of PATCH /api/v1/users/me/username.
type usernameUpdateRequest struct {
	Username string `json:"username"`
}

// PATCH /api/v1/users/me/username changes the caller's handle.
//
// createUser derives a first handle from the Supabase metadata or the email
// local part, and appends a random suffix when that is already taken, so an
// OAuth sign-in can land on "michojekunle_1a3f". Until this endpoint the only
// place that handle could change was the sign-up path, which is unreachable for
// an account that already exists.
func (s *Server) updateUsername(w http.ResponseWriter, r *http.Request) error {
	var req usernameUpdateRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}

	v := validationErrors{}
	name := strings.TrimSpace(req.Username)
	switch {
	case name == "":
		v.add("username", "Username is required")
	case !usernamePattern.MatchString(name):
		v.add("username", "Username must be 3-30 characters of letters, digits, '.', '_' or '-'")
	case slices.Contains(reservedUsernames, strings.ToLower(name)):
		v.add("username", "That username is reserved")
	default:
		free, err := s.store.UsernameAvailable(r.Context(), name)
		if err != nil {
			return err
		}
		if !free {
			v.add("username", "That username is taken")
		}
	}
	if err := v.err(); err != nil {
		return err
	}

	caller := devFrom(r.Context())
	// Re-submitting the current handle is a no-op rather than a conflict: the
	// availability check above cannot see the caller's own row as free.
	if strings.EqualFold(caller.Username, name) {
		writeJSON(w, http.StatusOK, caller)
		return nil
	}
	if err := s.store.SetUsername(r.Context(), caller.ID, name); err != nil {
		if errors.Is(err, store.ErrConflict) {
			return errConflict("That username is taken")
		}
		return err
	}
	updated, err := s.store.GetUserByID(r.Context(), caller.ID)
	if err != nil {
		return err
	}
	slog.InfoContext(r.Context(), "username changed", "actor", caller.Username, "to", updated.Username)
	writeJSON(w, http.StatusOK, updated)
	return nil
}

// profileUpdateRequest mirrors UserProfileUpdateSchema in lib/schemas/profile.ts.
// Optional fields that are omitted keep their stored value.
type profileUpdateRequest struct {
	Name         string  `json:"name"`
	Headline     string  `json:"headline"`
	Bio          string  `json:"bio"`
	AvatarURL    *string `json:"avatarUrl"`
	GitHubURL    *string `json:"githubUrl"`
	PortfolioURL *string `json:"portfolioUrl"`
	// ContactEmail is where the dev wants recruiters to reach them. It used to
	// arrive as "email" and was accepted but never stored, so the settings save
	// reported success and discarded the edit. The auth address itself is not
	// settable here: it belongs to Supabase Auth (auth.users) and is read via a
	// join, and it doubles as the identity that verifies GitHub ownership.
	ContactEmail *string  `json:"contactEmail"`
	Plan         string   `json:"plan"`
	APIKey       *string  `json:"apiKey"`
	StatedSkills []string `json:"statedSkills"`

	// Onboarding fields, all optional. decodeJSON runs with
	// DisallowUnknownFields, so a field the form sends but this struct lacks is
	// a hard 400 for the whole save — which is how engineeringTrack, targetRole
	// and experienceLevel used to make the settings form unsaveable. Keeping
	// them here is what makes the form, the API and the schema agree.
	EngineeringTrack    *string `json:"engineeringTrack"`
	TargetRole          *string `json:"targetRole"`
	ExperienceLevel     *string `json:"experienceLevel"`
	GitHubUsername      *string `json:"githubUsername"`
	GitHubConnected     *bool   `json:"githubConnected"`
	OnboardingCompleted *bool   `json:"onboardingCompleted"`
}

func isHTTPURL(s string) bool {
	u, err := url.Parse(s)
	return err == nil && (u.Scheme == "https" || u.Scheme == "http") && u.Host != ""
}

// isEmail is a deliberately loose shape check: one @, no spaces, and a dotted
// domain. Anything stricter starts rejecting real addresses, and the only
// addresses that matter here are ones the dev will receive mail at.
func isEmail(s string) bool {
	at := strings.LastIndex(s, "@")
	if at <= 0 || at == len(s)-1 {
		return false
	}
	local, domain := s[:at], s[at+1:]
	if strings.ContainsAny(local, " @") || strings.ContainsAny(domain, " @") {
		return false
	}
	dot := strings.LastIndex(domain, ".")
	return dot > 0 && dot < len(domain)-1
}

func runeLen(s string) int { return utf8.RuneCountInString(s) }

// dedupe drops case-insensitive duplicates, keeping first occurrences in order.
func dedupe(in []string) []string {
	seen := make(map[string]bool, len(in))
	out := make([]string, 0, len(in))
	for _, s := range in {
		k := strings.ToLower(s)
		if !seen[k] {
			seen[k] = true
			out = append(out, s)
		}
	}
	return out
}

func (req *profileUpdateRequest) validate() error {
	v := validationErrors{}
	req.Name, req.Headline, req.Bio = strings.TrimSpace(req.Name), strings.TrimSpace(req.Headline), strings.TrimSpace(req.Bio)

	if n := runeLen(req.Name); n < 2 {
		v.add("name", "Name must be at least 2 characters")
	} else if n > 60 {
		v.add("name", "Name must be under 60 characters")
	}
	if n := runeLen(req.Headline); n < 3 {
		v.add("headline", "Headline must be at least 3 characters")
	} else if n > 120 {
		v.add("headline", "Headline must be under 120 characters")
	}
	if runeLen(req.Bio) > 500 {
		v.add("bio", "Bio must be under 500 characters")
	}
	if req.AvatarURL != nil && *req.AvatarURL != "" && !isHTTPURL(*req.AvatarURL) {
		v.add("avatarUrl", "Must be a valid URL")
	}
	if req.ContactEmail != nil && *req.ContactEmail != "" && !isEmail(*req.ContactEmail) {
		v.add("contactEmail", "Must be a valid email address")
	}
	if req.GitHubURL != nil && *req.GitHubURL != "" && !isHTTPURL(*req.GitHubURL) {
		v.add("githubUrl", "Must be a valid GitHub URL")
	}
	if req.PortfolioURL != nil && *req.PortfolioURL != "" && !isHTTPURL(*req.PortfolioURL) {
		v.add("portfolioUrl", "Must be a valid URL")
	}
	if !slices.Contains(model.Plans, req.Plan) {
		v.add("plan", "Plan must be one of free, full-service, byok")
	}
	if req.APIKey != nil && len(*req.APIKey) > 512 {
		v.add("apiKey", "API key is too long")
	}
	if len(req.StatedSkills) == 0 {
		v.add("statedSkills", "Please select at least one skill tag")
	}
	if len(req.StatedSkills) > 30 {
		v.add("statedSkills", "At most 30 skill tags are allowed")
	}
	for i, skill := range req.StatedSkills {
		req.StatedSkills[i] = strings.TrimSpace(skill)
		if req.StatedSkills[i] == "" || runeLen(req.StatedSkills[i]) > 40 {
			v.add("statedSkills", "Each skill tag must be 1-40 characters")
			break
		}
	}
	validateProfileTracks(&v, req)
	return v.err()
}

// validateProfileTracks checks the onboarding fields against the same
// vocabularies the frontend renders. An empty string is allowed and means "not
// chosen yet": the form sends defaults for a profile that has never onboarded,
// and rejecting those would make the first save impossible.
func validateProfileTracks(v *validationErrors, req *profileUpdateRequest) {
	if t := req.EngineeringTrack; t != nil {
		track := strings.TrimSpace(*t)
		if track != "" && !slices.Contains(model.EngineeringTracks, track) {
			v.add("engineeringTrack", "Engineering track must be one of "+strings.Join(model.EngineeringTracks, ", "))
		}
		*t = track
	}
	if r := req.TargetRole; r != nil {
		role := strings.TrimSpace(*r)
		if runeLen(role) > 80 {
			v.add("targetRole", "Target role must be under 80 characters")
		}
		*r = role
	}
	if l := req.ExperienceLevel; l != nil {
		level := strings.TrimSpace(*l)
		if level != "" && !slices.Contains(model.ExperienceLevels, level) {
			v.add("experienceLevel", "Experience level must be one of "+strings.Join(model.ExperienceLevels, ", "))
		}
		*l = level
	}
	if g := req.GitHubUsername; g != nil {
		handle := strings.TrimPrefix(strings.TrimSpace(*g), "@")
		if handle != "" && !usernamePattern.MatchString(handle) {
			v.add("githubUsername", "GitHub username must be 3-30 characters of letters, digits, '.', '_' or '-'")
		}
		*g = handle
	}
}

// PATCH|PUT /api/v1/users/me updates the caller's profile. Writes never fall
// back to mock data on the frontend, so every failure is reported explicitly.
func (s *Server) updateMe(w http.ResponseWriter, r *http.Request) error {
	var req profileUpdateRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	if err := req.validate(); err != nil {
		return err
	}

	upd := store.ProfileUpdate{
		Name: req.Name, Headline: req.Headline, Bio: req.Bio,
		AvatarURL: req.AvatarURL, GitHubURL: req.GitHubURL, Portfolio: req.PortfolioURL,
		ContactEmail: req.ContactEmail,
		Plan:         req.Plan, StatedSkills: dedupe(req.StatedSkills),
		EngineeringTrack: req.EngineeringTrack, TargetRole: req.TargetRole,
		ExperienceLevel: req.ExperienceLevel, GitHubUsername: req.GitHubUsername,
		GitHubConnected: req.GitHubConnected, OnboardingCompleted: req.OnboardingCompleted,
	}
	switch {
	case req.Plan != "byok":
		// Keys are only kept for bring-your-own-key plans.
		upd.APIKeyChanged = true
	case req.APIKey != nil && strings.TrimSpace(*req.APIKey) == "":
		upd.APIKeyChanged = true
	case req.APIKey != nil:
		upd.APIKeyChanged = true
		upd.APIKeyCiphertext = s.cipher.Encrypt(strings.TrimSpace(*req.APIKey))
	}

	u, err := s.store.UpdateProfile(r.Context(), devFrom(r.Context()).ID, upd)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, u)
	return nil
}

// GET /api/v1/admin/users?q= lists devs for role management. Admin-only: the
// roster carries email addresses, which no public profile exposes.
func (s *Server) listPlatformUsers(w http.ResponseWriter, r *http.Request) error {
	users, err := s.store.ListPlatformUsers(r.Context(), strings.TrimSpace(r.URL.Query().Get("q")), 50)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, users)
	return nil
}

// roleUpdateRequest is the body of PATCH /api/v1/admin/users/{id}/role.
type roleUpdateRequest struct {
	Role string `json:"role"`
}

// PATCH /api/v1/admin/users/{id}/role grants or revokes a reviewer/admin role.
//
// public.profiles.role has no other writer: migration 0003 revoked the column
// from the anon and authenticated Supabase roles so that no dev can promote
// themselves, and the profile update path deliberately omits it. Before this
// endpoint the only way to make a reviewer was a hand-written SQL UPDATE.
//
// Callers need PermAssignRoles, which both reviewer and admin hold, so staff can
// staff the queue without an admin. The rules below keep that from collapsing
// the two roles into one.
func (s *Server) setUserRole(w http.ResponseWriter, r *http.Request) error {
	var req roleUpdateRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}

	role := model.Role(strings.TrimSpace(req.Role))
	if !role.Valid() {
		v := validationErrors{}
		v.add("role", "Role must be one of user, reviewer, admin")
		return v.err()
	}

	targetID := r.PathValue("id")
	caller := devFrom(r.Context())

	// A dev may not change their own role. The bootstrap admin is created with
	// `api promote`, so a self-demotion that leaves nobody holding
	// manage_platform is recoverable, but it is never what the caller meant.
	if targetID == caller.ID {
		return errBadRequest("You cannot change your own role; ask another admin")
	}

	target, err := s.store.GetUserByID(r.Context(), targetID)
	if errors.Is(err, store.ErrNotFound) {
		return errNotFound("User not found")
	}
	if err != nil {
		return err
	}

	// Privilege ordering: you may only act on accounts that do not outrank you,
	// and you may only hand out roles you yourself hold. Without this, a
	// reviewer could mint an admin, or demote the admins and leave the platform
	// with nobody able to grant clearance.
	if !model.HasPermission(caller.Role, model.PermManagePlatform) {
		if target.Role == model.RoleAdmin {
			return errForbidden("Only an admin can change an admin's role")
		}
		if role == model.RoleAdmin {
			return errForbidden("Only an admin can grant the admin role")
		}
	}

	if err := s.store.SetRole(r.Context(), targetID, role); err != nil {
		return err
	}

	slog.InfoContext(r.Context(), "role changed", "actor", caller.Username, "target", target.Username,
		"from", string(target.Role), "to", string(role))
	// Reflect the role just written rather than the one read a moment ago, so
	// the response agrees with the row the caller is about to reload.
	target.Role = role
	writeJSON(w, http.StatusOK, target.Public())
	return nil
}

// providerKey returns the caller's decrypted BYOK key, or "".
func (s *Server) providerKey(r *http.Request) string {
	dev := devFrom(r.Context())
	if dev == nil || !dev.HasAPIKey {
		return ""
	}
	ct, err := s.store.GetAPIKeyCiphertext(r.Context(), dev.ID)
	if err != nil || ct == nil {
		return ""
	}
	key, err := s.cipher.Decrypt(ct)
	if err != nil {
		return ""
	}
	return key
}

// GET /api/internal/provider-key returns a dev's decrypted BYOK key to the
// frontend's server-side AI routes, so the key never has to live in the
// browser. It requires both the service key (held only by the Next.js server)
// and the dev's own access token in X-User-Token: a stolen browser token
// alone cannot extract the key.
func (s *Server) internalProviderKey(w http.ResponseWriter, r *http.Request) error {
	if p := principalFrom(r.Context()); p == nil || !p.Service {
		return errForbidden("Service credentials required")
	}
	claims, err := s.verifier.Verify(r.Context(), strings.TrimPrefix(r.Header.Get("X-User-Token"), "Bearer "))
	if err != nil {
		return errUnauthorized("X-User-Token is missing, invalid or expired")
	}
	dev, err := s.store.GetUserByID(r.Context(), claims.Subject)
	if errors.Is(err, store.ErrNotFound) {
		writeJSON(w, http.StatusOK, map[string]string{"apiKey": ""})
		return nil
	}
	if err != nil {
		return err
	}
	key := ""
	if dev.Plan == "byok" && dev.HasAPIKey {
		ct, err := s.store.GetAPIKeyCiphertext(r.Context(), dev.ID)
		if err != nil {
			return err
		}
		if key, err = s.cipher.Decrypt(ct); err != nil {
			return fmt.Errorf("decrypt provider key for %s: %w", dev.Username, err)
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"apiKey": key})
	return nil
}
