package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/mail"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/supabase"
)

// Identity is owned by Supabase Auth. These routes proxy its REST API so the
// frontend has one backend to talk to, and make sure every Supabase user has
// a DevLedgr dev record.

var oauthProviders = map[string]string{
	"github": "read:user user:email",
}

// authResponse extends the frontend's UserSession with the refresh token and
// the full dev record.
type authResponse struct {
	Token        string             `json:"token"`
	RefreshToken string             `json:"refreshToken,omitempty"`
	ExpiresAt    time.Time          `json:"expiresAt"`
	Username     string             `json:"username"`
	Name         string             `json:"name"`
	Role         model.Role         `json:"role"`
	AvatarURL    string             `json:"avatarUrl"`
	Dev          *model.UserProfile `json:"dev"`
}

func metaString(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

// identityFromClaims maps Supabase user metadata (email sign-up fields or the
// GitHub OAuth profile) onto a dev identity.
func identityFromClaims(id, email string, userMeta, appMeta map[string]any) store.AuthIdentity {
	provider := metaString(appMeta, "provider")
	ident := store.AuthIdentity{
		ID:        id,
		Email:     email,
		Provider:  provider,
		Username:  metaString(userMeta, "username", "user_name", "preferred_username"),
		Name:      metaString(userMeta, "full_name", "name"),
		AvatarURL: metaString(userMeta, "avatar_url", "picture"),
	}
	if provider == "github" {
		if login := metaString(userMeta, "user_name", "preferred_username"); login != "" {
			ident.GitHubUsername = login
			ident.GitHubURL = "https://github.com/" + login
		}
	}
	return ident
}

func (s *Server) requireAuthClient() error {
	if !s.auth.Configured() {
		return &apiError{Message: "Supabase Auth is not configured (SUPABASE_ANON_KEY)", StatusCode: http.StatusServiceUnavailable, Code: "AUTH_NOT_CONFIGURED"}
	}
	return nil
}

// authError maps a Supabase Auth failure onto an API error.
func authError(err error) error {
	var se *supabase.Error
	if !errors.As(err, &se) {
		slog.Error("supabase auth unreachable", "err", err)
		return &apiError{Message: "Authentication service unavailable", StatusCode: http.StatusBadGateway, Code: "AUTH_UNAVAILABLE"}
	}
	switch {
	case se.Status == http.StatusTooManyRequests:
		return errTooMany(se.Message)
	case se.Status >= 400 && se.Status < 500:
		code := "AUTH_ERROR"
		if se.Code != "" {
			code = "AUTH_" + strings.ToUpper(se.Code)
		}
		return &apiError{Message: se.Message, StatusCode: se.Status, Code: code}
	default:
		slog.Error("supabase auth error", "status", se.Status, "code", se.Code, "msg", se.Message)
		return &apiError{Message: "Authentication service unavailable", StatusCode: http.StatusBadGateway, Code: "AUTH_UNAVAILABLE"}
	}
}

// startSession provisions the dev record, sets cookies and writes the session.
func (s *Server) startSession(w http.ResponseWriter, r *http.Request, sess *supabase.Session, status int) error {
	dev, _, err := s.store.EnsureDev(r.Context(),
		identityFromClaims(sess.User.ID, sess.User.Email, sess.User.UserMetadata, sess.User.AppMetadata))
	if err != nil {
		return err
	}
	expires := time.Unix(sess.ExpiresAt, 0).UTC()
	if sess.ExpiresAt == 0 {
		expires = time.Now().Add(time.Duration(sess.ExpiresIn) * time.Second).UTC()
	}
	s.setAuthCookies(w, sess.AccessToken, sess.RefreshToken, dev.Role, expires)
	writeJSON(w, status, authResponse{
		Token: sess.AccessToken, RefreshToken: sess.RefreshToken, ExpiresAt: expires,
		Username: dev.Username, Name: dev.Name, Role: dev.Role, AvatarURL: dev.AvatarURL, Dev: dev,
	})
	return nil
}

// setAuthCookies writes devledgr_session (the access token, HttpOnly),
// devledgr_refresh (HttpOnly, only sent to /api/auth) and devledgr_role, a
// routing hint for the Next.js proxy. The API never trusts the role cookie.
func (s *Server) setAuthCookies(w http.ResponseWriter, access, refresh string, role model.Role, expires time.Time) {
	sessionAge, longAge := int(time.Until(expires).Seconds()), 30*24*60*60
	if access == "" {
		sessionAge, longAge = -1, -1
	}
	for _, c := range []*http.Cookie{
		{Name: sessionCookie, Value: access, HttpOnly: true, Path: "/", MaxAge: sessionAge},
		{Name: refreshCookie, Value: refresh, HttpOnly: true, Path: "/api/auth", MaxAge: longAge},
		{Name: roleCookie, Value: string(role), Path: "/", MaxAge: longAge},
	} {
		if c.Name == refreshCookie && refresh == "" && access != "" {
			continue
		}
		c.Domain = s.cfg.CookieDomain
		c.Secure = s.cfg.CookieSecure
		c.SameSite = http.SameSiteLaxMode
		http.SetCookie(w, c)
	}
}

func normalizeEmail(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	addr, err := mail.ParseAddress(raw)
	if err != nil || addr.Address != raw || len(raw) > 254 || !strings.Contains(raw[strings.LastIndex(raw, "@"):], ".") {
		return "", false
	}
	return strings.ToLower(raw), true
}

type signupRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Username string `json:"username"`
	Name     string `json:"name"`
}

// POST /api/auth/signup creates a Supabase user and their dev record.
func (s *Server) signup(w http.ResponseWriter, r *http.Request) error {
	if err := s.requireAuthClient(); err != nil {
		return err
	}
	var req signupRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	v := validationErrors{}
	email, ok := normalizeEmail(req.Email)
	if !ok {
		v.add("email", "Please enter a valid email")
	}
	if n := len(req.Password); n < 8 || n > 72 {
		v.add("password", "Password must be 8-72 characters")
	}
	if !usernamePattern.MatchString(req.Username) || slices.Contains(reservedUsernames, strings.ToLower(req.Username)) {
		v.add("username", "Username must be 3-30 characters of letters, digits, _ or -")
	}
	req.Name = strings.TrimSpace(req.Name)
	if n := runeLen(req.Name); n < 2 || n > 60 {
		v.add("name", "Name must be 2-60 characters")
	}
	if err := v.err(); err != nil {
		return err
	}
	if free, err := s.store.UsernameAvailable(r.Context(), req.Username); err != nil {
		return err
	} else if !free {
		v.add("username", "This username is taken")
		return &apiError{Message: "Username is taken", StatusCode: http.StatusConflict, Code: "CONFLICT", Errors: v}
	}

	user, sess, err := s.auth.SignUp(r.Context(), email, req.Password,
		map[string]any{"username": req.Username, "name": req.Name, "full_name": req.Name}, s.cfg.AuthRedirectURL)
	if err != nil {
		return authError(err)
	}
	// The on_auth_user_created trigger names new profiles after the email;
	// apply the handle the dev chose.
	dev, _, err := s.store.EnsureDev(r.Context(), identityFromClaims(user.ID, user.Email, user.UserMetadata, user.AppMetadata))
	if err != nil {
		return err
	}
	if !strings.EqualFold(dev.Username, req.Username) {
		if err := s.store.SetUsername(r.Context(), dev.ID, req.Username); err != nil && !errors.Is(err, store.ErrConflict) {
			return err
		}
	}
	if sess != nil {
		return s.startSession(w, r, sess, http.StatusCreated)
	}
	// Email confirmation is on: sign in after confirming.
	if dev, err = s.store.GetUserByID(r.Context(), dev.ID); err != nil {
		return err
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"confirmationRequired": true,
		"message":              fmt.Sprintf("Check %s for a confirmation link to activate your account.", email),
		"dev":                  dev,
	})
	return nil
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// POST /api/auth/login signs in with email and password.
func (s *Server) login(w http.ResponseWriter, r *http.Request) error {
	if err := s.requireAuthClient(); err != nil {
		return err
	}
	var req loginRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	email, ok := normalizeEmail(req.Email)
	if !ok || req.Password == "" {
		return errBadRequest("email and password are required")
	}
	sess, err := s.auth.PasswordLogin(r.Context(), email, req.Password)
	if err != nil {
		return authError(err)
	}
	return s.startSession(w, r, sess, http.StatusOK)
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

// POST /api/auth/refresh exchanges a refresh token (body or cookie) for a new session.
func (s *Server) refresh(w http.ResponseWriter, r *http.Request) error {
	if err := s.requireAuthClient(); err != nil {
		return err
	}
	var req refreshRequest
	if err := decodeOptionalJSON(w, r, &req); err != nil {
		return err
	}
	if req.RefreshToken == "" {
		if c, err := r.Cookie(refreshCookie); err == nil {
			req.RefreshToken = c.Value
		}
	}
	if req.RefreshToken == "" {
		return errUnauthorized("refreshToken is required")
	}
	sess, err := s.auth.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		return authError(err)
	}
	return s.startSession(w, r, sess, http.StatusOK)
}

// POST /api/auth/logout revokes the session in Supabase and clears cookies. Always 204.
func (s *Server) logout(w http.ResponseWriter, r *http.Request) error {
	if tok := bearerToken(r); tok != "" && s.auth.Configured() {
		if err := s.auth.Logout(r.Context(), tok); err != nil {
			slog.Warn("supabase logout", "err", err) // expired tokens are fine; cookies are cleared regardless
		}
	}
	s.setAuthCookies(w, "", "", "", time.Now())
	w.WriteHeader(http.StatusNoContent)
	return nil
}

type magicLinkRequest struct {
	Email string `json:"email"`
}

// POST /api/auth/magic-link emails a passwordless sign-in link via Supabase.
func (s *Server) magicLink(w http.ResponseWriter, r *http.Request) error {
	if err := s.requireAuthClient(); err != nil {
		return err
	}
	var req magicLinkRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	email, ok := normalizeEmail(req.Email)
	if !ok {
		v := validationErrors{}
		v.add("email", "Please enter a valid email")
		return v.err()
	}
	if err := s.auth.SendMagicLink(r.Context(), email, s.cfg.AuthRedirectURL); err != nil {
		return authError(err)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": fmt.Sprintf("Sign-in link sent to %s.", email),
	})
	return nil
}

// GET /api/auth/oauth/{provider}?redirectTo= starts an OAuth sign-in by
// redirecting the browser to Supabase. Supabase returns the session to
// redirectTo (default AUTH_REDIRECT_URL) in the URL fragment.
func (s *Server) oauthStart(w http.ResponseWriter, r *http.Request) error {
	if err := s.requireAuthClient(); err != nil {
		return err
	}
	provider := r.PathValue("provider")
	scopes, ok := oauthProviders[provider]
	if !ok {
		return errNotFound("Unsupported sign-in provider")
	}
	redirect := s.cfg.AuthRedirectURL
	if rt := r.URL.Query().Get("redirectTo"); rt != "" {
		if !s.allowedRedirect(rt) {
			return errBadRequest("redirectTo must point to an allowed frontend origin")
		}
		redirect = rt
	}
	http.Redirect(w, r, s.auth.AuthorizeURL(provider, redirect, scopes), http.StatusFound)
	return nil
}

func (s *Server) allowedRedirect(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return false
	}
	return slices.Contains(s.cfg.AllowedOrigins, u.Scheme+"://"+u.Host)
}

// GET /api/auth/me returns the current session and dev record.
func (s *Server) me(w http.ResponseWriter, r *http.Request) error {
	p := principalFrom(r.Context())
	writeJSON(w, http.StatusOK, authResponse{
		Token: p.Token, ExpiresAt: p.ExpiresAt, Username: p.User.Username, Name: p.User.Name,
		Role: p.User.Role, AvatarURL: p.User.AvatarURL, Dev: p.User,
	})
	return nil
}

// webhookUser is the auth.users row sent by the trigger in supabase/auth_webhook.sql.
type webhookUser struct {
	ID              string         `json:"id"`
	Email           string         `json:"email"`
	RawUserMetaData map[string]any `json:"raw_user_meta_data"`
	RawAppMetaData  map[string]any `json:"raw_app_meta_data"`
}

// webhookPayload is the Supabase database-webhook envelope.
type webhookPayload struct {
	Type      string       `json:"type"` // INSERT | UPDATE | DELETE
	Table     string       `json:"table"`
	Schema    string       `json:"schema"`
	Record    *webhookUser `json:"record"`
	OldRecord *webhookUser `json:"old_record"`
}

// POST /api/auth/webhook syncs Supabase Auth users into dev records:
// INSERT and UPDATE ensure the dev's profile exists; DELETE removes it and
// reopens problems the dev was building.
// Authenticated with SUPABASE_WEBHOOK_SECRET as a bearer token.
func (s *Server) authWebhook(w http.ResponseWriter, r *http.Request) error {
	if s.cfg.SupabaseWebhookSecret == "" {
		return &apiError{Message: "Webhook secret is not configured", StatusCode: http.StatusServiceUnavailable, Code: "WEBHOOK_NOT_CONFIGURED"}
	}
	got, _ := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if got == "" {
		got = r.Header.Get("X-Webhook-Secret")
	}
	if !secretEqual(got, s.cfg.SupabaseWebhookSecret) {
		return errUnauthorized("Invalid webhook secret")
	}

	var p webhookPayload
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	if err := dec.Decode(&p); err != nil {
		return errBadRequest("Invalid webhook payload")
	}
	if p.Schema != "auth" || p.Table != "users" {
		return errBadRequest("Expected an auth.users event")
	}

	switch p.Type {
	case "INSERT", "UPDATE":
		if p.Record == nil || p.Record.ID == "" {
			return errBadRequest("record.id is required")
		}
		dev, created, err := s.store.EnsureDev(r.Context(),
			identityFromClaims(p.Record.ID, p.Record.Email, p.Record.RawUserMetaData, p.Record.RawAppMetaData))
		if err != nil {
			return err
		}
		// Email lives in auth.users and is read from there, so UPDATE needs no sync.
		action := "synced"
		if created {
			action = "created"
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "action": action, "username": dev.Username})
	case "DELETE":
		if p.OldRecord == nil || p.OldRecord.ID == "" {
			return errBadRequest("old_record.id is required")
		}
		if err := s.store.DeleteDev(r.Context(), p.OldRecord.ID); err != nil {
			return err
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "action": "deleted"})
	default:
		return errBadRequest("Unsupported event type " + p.Type)
	}
	return nil
}
