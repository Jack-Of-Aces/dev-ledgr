package api

import (
	"context"
	"crypto/subtle"
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
)

const (
	sessionCookie = "devledgr_session"
	roleCookie    = "devledgr_role"
	refreshCookie = "devledgr_refresh"
)

type ctxKey int

const principalKey ctxKey = iota

// principal is the authenticated caller attached to the request context:
// either a developer (Supabase user) or an internal service (scraper, CV parser).
type principal struct {
	User      *model.UserProfile
	Token     string
	ExpiresAt time.Time
	Service   bool
}

func principalFrom(ctx context.Context) *principal {
	p, _ := ctx.Value(principalKey).(*principal)
	return p
}

// devFrom returns the authenticated developer, or nil.
func devFrom(ctx context.Context) *model.UserProfile {
	if p := principalFrom(ctx); p != nil {
		return p.User
	}
	return nil
}

// bearerToken reads the Supabase access token from the Authorization header
// or, for same-site browser calls, the devledgr_session cookie.
func bearerToken(r *http.Request) string {
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

func secretEqual(a, b string) bool {
	return a != "" && b != "" && subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// authenticate resolves the caller. A present-but-invalid token is rejected
// with 401 so clients know to refresh, rather than silently treated as anonymous.
func (s *Server) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if key := r.Header.Get("X-Service-Key"); key != "" {
			if !secretEqual(key, s.cfg.ServiceAPIKey) {
				writeError(w, r, errUnauthorized("Invalid service key"))
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), principalKey, &principal{Service: true})))
			return
		}

		// Auth routes (login, refresh, webhook, ...) must work even while the
		// browser still holds an expired token; only /api/auth/me needs a user.
		authRoute := strings.HasPrefix(r.URL.Path, "/api/auth/") && r.URL.Path != "/api/auth/me"
		tok := bearerToken(r)
		if tok == "" || authRoute {
			next.ServeHTTP(w, r)
			return
		}
		claims, err := s.verifier.Verify(r.Context(), tok)
		if err != nil {
			writeError(w, r, &apiError{Message: "Access token is invalid or expired", StatusCode: http.StatusUnauthorized, Code: "INVALID_TOKEN"})
			return
		}
		// The webhook normally creates the dev record; provisioning here too
		// means a missed or delayed webhook never locks a user out.
		user, _, err := s.store.EnsureDev(r.Context(), identityFromClaims(claims.Subject, claims.Email, claims.UserMetadata, claims.AppMetadata))
		if err != nil {
			writeError(w, r, err)
			return
		}
		var exp time.Time
		if claims.ExpiresAt != nil {
			exp = claims.ExpiresAt.Time
		}
		ctx := context.WithValue(r.Context(), principalKey, &principal{User: user, Token: tok, ExpiresAt: exp})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func requireAuth(h handler) handler {
	return func(w http.ResponseWriter, r *http.Request) error {
		if devFrom(r.Context()) == nil {
			return errUnauthorized("Authentication required")
		}
		return h(w, r)
	}
}

// requirePermission enforces the same ROLE_PERMISSIONS matrix the frontend uses.
func requirePermission(p model.Permission, h handler) handler {
	return requireAuth(func(w http.ResponseWriter, r *http.Request) error {
		if !model.HasPermission(devFrom(r.Context()).Role, p) {
			return errForbidden("Your role does not grant the '" + string(p) + "' permission")
		}
		return h(w, r)
	})
}

// requireServiceOr admits internal services, or developers holding permission p.
func requireServiceOr(p model.Permission, h handler) handler {
	return func(w http.ResponseWriter, r *http.Request) error {
		if pr := principalFrom(r.Context()); pr != nil && pr.Service {
			return h(w, r)
		}
		return requirePermission(p, h)(w, r)
	}
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
				h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, X-Service-Key")
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
