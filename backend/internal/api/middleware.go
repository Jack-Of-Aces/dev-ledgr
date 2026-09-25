package api

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"runtime/debug"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/security"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

const (
	sessionCookie = "devledgr_session"
	roleCookie    = "devledgr_role"
)

type ctxKey int

const principalKey ctxKey = iota

// principal is the authenticated caller attached to the request context.
type principal struct {
	User      *model.UserProfile
	Token     string
	ExpiresAt time.Time
}

func principalFrom(ctx context.Context) *principal {
	p, _ := ctx.Value(principalKey).(*principal)
	return p
}

// sessionToken reads the bearer token (what the frontend httpClient sends)
// or falls back to the HttpOnly session cookie.
func sessionToken(r *http.Request) string {
	if h := r.Header.Get("Authorization"); h != "" {
		if tok, ok := strings.CutPrefix(h, "Bearer "); ok {
			return strings.TrimSpace(tok)
		}
	}
	if c, err := r.Cookie(sessionCookie); err == nil {
		return c.Value
	}
	return ""
}

// authenticate resolves the session, if any. Invalid or expired tokens are
// treated as anonymous; endpoints that need a user enforce it via requireAuth.
func (s *Server) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tok := sessionToken(r)
		if tok == "" {
			next.ServeHTTP(w, r)
			return
		}
		user, exp, err := s.store.SessionUser(r.Context(), security.HashToken(tok))
		switch {
		case err == nil:
			ctx := context.WithValue(r.Context(), principalKey, &principal{User: user, Token: tok, ExpiresAt: exp})
			r = r.WithContext(ctx)
		case !errors.Is(err, store.ErrNotFound):
			writeError(w, r, err)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func requireAuth(h handler) handler {
	return func(w http.ResponseWriter, r *http.Request) error {
		if principalFrom(r.Context()) == nil {
			return errUnauthorized("Authentication required")
		}
		return h(w, r)
	}
}

// requirePermission enforces the same ROLE_PERMISSIONS matrix the frontend uses.
func requirePermission(p model.Permission, h handler) handler {
	return requireAuth(func(w http.ResponseWriter, r *http.Request) error {
		if !model.HasPermission(principalFrom(r.Context()).User.Role, p) {
			return errForbidden("Your role does not grant the '" + string(p) + "' permission")
		}
		return h(w, r)
	})
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && slices.Contains(s.cfg.AllowedOrigins, origin) {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Credentials", "true")
			h.Add("Vary", "Origin")
			if r.Method == http.MethodOptions {
				h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept")
				h.Set("Access-Control-Max-Age", "600")
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Flush() {
	if f, ok := r.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		slog.Info("request", "method", r.Method, "path", r.URL.Path, "status", rec.status,
			"duration_ms", time.Since(start).Milliseconds())
	})
}

func recoverPanics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				if v == http.ErrAbortHandler {
					panic(v)
				}
				slog.Error("panic", "value", v, "stack", string(debug.Stack()))
				writeError(w, r, errors.New("panic"))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// rateLimiter is a small fixed-window limiter keyed by client IP. It is
// per-process; put a shared limiter (e.g. at the edge) in front of multiple replicas.
type rateLimiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	hits   map[string]*window
}

type window struct {
	start time.Time
	count int
}

func newRateLimiter(limit int, per time.Duration) *rateLimiter {
	return &rateLimiter{limit: limit, window: per, hits: map[string]*window{}}
}

func (l *rateLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	if len(l.hits) > 10000 {
		for k, w := range l.hits {
			if now.Sub(w.start) > l.window {
				delete(l.hits, k)
			}
		}
	}
	w, ok := l.hits[key]
	if !ok || now.Sub(w.start) > l.window {
		l.hits[key] = &window{start: now, count: 1}
		return true
	}
	w.count++
	return w.count <= l.limit
}

func (l *rateLimiter) wrap(h handler) handler {
	return func(w http.ResponseWriter, r *http.Request) error {
		if !l.allow(clientIP(r)) {
			return errTooMany("Too many requests, slow down and retry shortly")
		}
		return h(w, r)
	}
}

// clientIP uses RemoteAddr. Behind a trusted proxy, configure it to
// overwrite RemoteAddr (or extend this to parse its forwarding header).
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
