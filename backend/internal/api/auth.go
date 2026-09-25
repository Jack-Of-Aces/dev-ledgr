package api

import (
	"errors"
	"fmt"
	"html"
	"log/slog"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"time"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/github"
	mailer "github.com/Jack-Of-Aces/dev-ledgr/backend/internal/mail"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/security"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

const (
	magicLinkTTL      = 15 * time.Minute
	magicLinkPerEmail = 3 // per magicLinkWindow
	magicLinkWindow   = 15 * time.Minute
)

// startSession issues a session token, persists its hash, sets the cookies
// the Next.js proxy reads, and returns the UserSession payload.
func (s *Server) startSession(w http.ResponseWriter, r *http.Request, u *model.UserProfile) error {
	token := security.NewToken()
	expires := time.Now().Add(s.cfg.SessionTTL).UTC().Truncate(time.Second)
	if err := s.store.CreateSession(r.Context(), u.ID, security.HashToken(token), expires); err != nil {
		return err
	}
	s.setSessionCookies(w, token, u.Role, expires)
	writeJSON(w, http.StatusOK, model.UserSession{
		Token: token, Username: u.Username, Name: u.Name, Role: u.Role, AvatarURL: u.AvatarURL, ExpiresAt: expires,
	})
	return nil
}

// setSessionCookies writes devledgr_session (HttpOnly) and devledgr_role.
// The role cookie is only a routing hint for the edge proxy; the API always
// authorizes against the role stored in the database.
func (s *Server) setSessionCookies(w http.ResponseWriter, token string, role model.Role, expires time.Time) {
	maxAge := int(time.Until(expires).Seconds())
	if token == "" {
		maxAge = -1
	}
	for _, c := range []*http.Cookie{
		{Name: sessionCookie, Value: token, HttpOnly: true},
		{Name: roleCookie, Value: string(role)},
	} {
		c.Path = "/"
		c.Domain = s.cfg.CookieDomain
		c.MaxAge = maxAge
		c.Secure = s.cfg.CookieSecure
		c.SameSite = http.SameSiteLaxMode
		http.SetCookie(w, c)
	}
}

type githubLoginRequest struct {
	Code        string `json:"code"`
	RedirectURI string `json:"redirectUri"`
}

// POST /api/v1/auth/github exchanges the OAuth code received by the
// frontend's /api/auth/callback/github route for a DevLedgr session.
func (s *Server) loginGitHub(w http.ResponseWriter, r *http.Request) error {
	if !s.github.Configured() {
		return &apiError{Message: "GitHub sign-in is not configured", StatusCode: http.StatusServiceUnavailable, Code: "GITHUB_NOT_CONFIGURED"}
	}
	var req githubLoginRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	if strings.TrimSpace(req.Code) == "" {
		v := validationErrors{}
		v.add("code", "OAuth code is required")
		return v.err()
	}
	if req.RedirectURI != "" && !s.allowedRedirect(req.RedirectURI) {
		return errBadRequest("redirectUri must point to an allowed frontend origin")
	}

	identity, err := s.github.Exchange(r.Context(), req.Code, req.RedirectURI)
	if errors.Is(err, github.ErrBadCode) {
		return errUnauthorized("GitHub authorization code is invalid or expired")
	}
	if err != nil {
		slog.Error("github exchange failed", "err", err)
		return &apiError{Message: "Could not reach GitHub", StatusCode: http.StatusBadGateway, Code: "GITHUB_UNAVAILABLE"}
	}
	user, err := s.store.UpsertGitHubUser(r.Context(), identity)
	if err != nil {
		return err
	}
	return s.startSession(w, r, user)
}

func (s *Server) allowedRedirect(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return false
	}
	origin := u.Scheme + "://" + u.Host
	for _, o := range s.cfg.AllowedOrigins {
		if o == origin {
			return true
		}
	}
	return false
}

type magicLinkRequest struct {
	Email string `json:"email"`
}

type magicLinkResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func normalizeEmail(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	addr, err := mail.ParseAddress(raw)
	if err != nil || addr.Address != raw || len(raw) > 254 || !strings.Contains(raw[strings.LastIndex(raw, "@"):], ".") {
		return "", false
	}
	return strings.ToLower(raw), true
}

// POST /api/v1/auth/magic-link emails a single-use sign-in link. The
// response is identical whether or not the email has an account.
func (s *Server) requestMagicLink(w http.ResponseWriter, r *http.Request) error {
	var req magicLinkRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	email, ok := normalizeEmail(req.Email)
	if !ok {
		v := validationErrors{}
		v.add("email", "Please enter a valid work or personal email")
		return v.err()
	}
	if _, isLog := s.mailer.(mailer.Log); isLog && s.cfg.IsProduction() {
		return &apiError{Message: "Email sign-in is not configured", StatusCode: http.StatusServiceUnavailable, Code: "EMAIL_NOT_CONFIGURED"}
	}

	recent, err := s.store.RecentMagicLinks(r.Context(), email, time.Now().Add(-magicLinkWindow))
	if err != nil {
		return err
	}
	if recent >= magicLinkPerEmail {
		return errTooMany("Too many sign-in links requested for this email. Try again in a few minutes.")
	}

	token := security.NewToken()
	if err := s.store.CreateMagicLink(r.Context(), email, security.HashToken(token), time.Now().Add(magicLinkTTL)); err != nil {
		return err
	}
	link := s.cfg.MagicLinkURL + "?token=" + url.QueryEscape(token)
	err = s.mailer.Send(r.Context(), mailer.Message{
		To:      email,
		Subject: "Your DevLedgr sign-in link",
		Text:    fmt.Sprintf("Sign in to DevLedgr: %s\n\nThis link expires in 15 minutes and can be used once. If you did not request it, ignore this email.", link),
		HTML: fmt.Sprintf(`<p>Sign in to DevLedgr:</p><p><a href="%s">Sign in</a></p><p>This link expires in 15 minutes and can be used once. If you did not request it, ignore this email.</p>`,
			html.EscapeString(link)),
	})
	if err != nil {
		slog.Error("send magic link", "err", err)
		return &apiError{Message: "Could not send the sign-in email. Please retry.", StatusCode: http.StatusBadGateway, Code: "EMAIL_SEND_FAILED"}
	}
	writeJSON(w, http.StatusOK, magicLinkResponse{
		Success: true,
		Message: fmt.Sprintf("Verification link dispatched to %s. It expires in 15 minutes.", email),
	})
	return nil
}

type verifyMagicLinkRequest struct {
	Token string `json:"token"`
}

// POST /api/v1/auth/magic-link/verify redeems the emailed token for a session.
func (s *Server) verifyMagicLink(w http.ResponseWriter, r *http.Request) error {
	var req verifyMagicLinkRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	if req.Token == "" {
		return errBadRequest("token is required")
	}
	email, err := s.store.ConsumeMagicLink(r.Context(), security.HashToken(req.Token))
	if errors.Is(err, store.ErrNotFound) {
		return errUnauthorized("This sign-in link is invalid, expired, or already used")
	}
	if err != nil {
		return err
	}
	user, err := s.store.FindOrCreateEmailUser(r.Context(), email)
	if err != nil {
		return err
	}
	return s.startSession(w, r, user)
}

// POST /api/v1/auth/logout revokes the current session. Always succeeds.
func (s *Server) logout(w http.ResponseWriter, r *http.Request) error {
	if tok := sessionToken(r); tok != "" {
		if err := s.store.DeleteSession(r.Context(), security.HashToken(tok)); err != nil {
			return err
		}
	}
	s.setSessionCookies(w, "", "", time.Now())
	w.WriteHeader(http.StatusNoContent)
	return nil
}

// GET /api/v1/auth/me returns the current UserSession.
func (s *Server) me(w http.ResponseWriter, r *http.Request) error {
	p := principalFrom(r.Context())
	writeJSON(w, http.StatusOK, model.UserSession{
		Token: p.Token, Username: p.User.Username, Name: p.User.Name, Role: p.User.Role,
		AvatarURL: p.User.AvatarURL, ExpiresAt: p.ExpiresAt,
	})
	return nil
}

type devLoginRequest struct {
	Username string     `json:"username"`
	Name     string     `json:"name"`
	Role     model.Role `json:"role"`
}

// POST /api/v1/auth/dev/login is the "Instant Dev Persona Sandbox" from
// ADR-002. Only registered when ENABLE_DEV_LOGIN is true (never in production).
func (s *Server) devLogin(w http.ResponseWriter, r *http.Request) error {
	var req devLoginRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	if req.Role == "" {
		req.Role = model.RoleUser
	}
	v := validationErrors{}
	if !usernamePattern.MatchString(req.Username) {
		v.add("username", "Username must be 3-30 characters of letters, digits, _ or -")
	}
	if !req.Role.Valid() {
		v.add("role", "Role must be user, reviewer or admin")
	}
	if err := v.err(); err != nil {
		return err
	}
	if req.Name == "" {
		req.Name = req.Username
	}
	user, err := s.store.EnsureDevUser(r.Context(), req.Username, req.Name, req.Role)
	if err != nil {
		return err
	}
	return s.startSession(w, r, user)
}
