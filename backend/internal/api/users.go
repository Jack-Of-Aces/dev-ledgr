package api

import (
	"errors"
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
	usernamePattern   = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,30}$`)
	reservedUsernames = []string{"me", "available", "admin", "api", "settings", "dashboard", "login", "p"}
)

// GET /api/v1/users/me returns the caller's full profile.
func (s *Server) getMe(w http.ResponseWriter, r *http.Request) error {
	writeJSON(w, http.StatusOK, principalFrom(r.Context()).User)
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
	if p := principalFrom(r.Context()); p != nil && p.User.ID == u.ID {
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
		v.add("username", "Username must be 3-30 characters of letters, digits, _ or -")
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

// profileUpdateRequest mirrors UserProfileUpdateSchema in lib/schemas/profile.ts.
// Optional fields that are omitted keep their stored value.
type profileUpdateRequest struct {
	Name         string   `json:"name"`
	Headline     string   `json:"headline"`
	Bio          string   `json:"bio"`
	AvatarURL    *string  `json:"avatarUrl"`
	GitHubURL    *string  `json:"githubUrl"`
	Email        *string  `json:"email"`
	Plan         string   `json:"plan"`
	APIKey       *string  `json:"apiKey"`
	StatedSkills []string `json:"statedSkills"`
}

func isHTTPURL(s string) bool {
	u, err := url.Parse(s)
	return err == nil && (u.Scheme == "https" || u.Scheme == "http") && u.Host != ""
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
	if req.GitHubURL != nil && *req.GitHubURL != "" && !isHTTPURL(*req.GitHubURL) {
		v.add("githubUrl", "Must be a valid GitHub URL")
	}
	if req.Email != nil && *req.Email != "" {
		if e, ok := normalizeEmail(*req.Email); ok {
			*req.Email = e
		} else {
			v.add("email", "Must be a valid email")
		}
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
	return v.err()
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
		AvatarURL: req.AvatarURL, GitHubURL: req.GitHubURL, Email: req.Email,
		Plan: req.Plan, StatedSkills: dedupe(req.StatedSkills),
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

	u, err := s.store.UpdateProfile(r.Context(), principalFrom(r.Context()).User.ID, upd)
	if errors.Is(err, store.ErrConflict) {
		v := validationErrors{}
		v.add("email", "This email is already linked to another account")
		return &apiError{Message: "Email already in use", StatusCode: http.StatusConflict, Code: "CONFLICT", Errors: v}
	}
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, u)
	return nil
}

// providerKey returns the caller's decrypted BYOK key, or "".
func (s *Server) providerKey(r *http.Request) string {
	p := principalFrom(r.Context())
	if p == nil || !p.User.HasAPIKey {
		return ""
	}
	ct, err := s.store.GetAPIKeyCiphertext(r.Context(), p.User.ID)
	if err != nil || ct == nil {
		return ""
	}
	key, err := s.cipher.Decrypt(ct)
	if err != nil {
		return ""
	}
	return key
}
