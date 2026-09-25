// Package api implements the DevLedgr REST API consumed by the Next.js
// frontend service layer (frontend/src/services/*).
package api

import (
	"context"
	"net/http"
	"time"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/ai"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/config"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/github"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/mail"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/security"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

type Server struct {
	cfg    *config.Config
	store  *store.Store
	cipher *security.Cipher
	mailer mail.Sender
	github *github.Client
	ai     *ai.Engine

	authLimiter *rateLimiter
	aiLimiter   *rateLimiter
}

func NewServer(cfg *config.Config, st *store.Store) (*Server, error) {
	c, err := security.NewCipher(cfg.EncryptionKey)
	if err != nil {
		return nil, err
	}
	var mailer mail.Sender = mail.Log{}
	if cfg.ResendAPIKey != "" {
		mailer = &mail.Resend{APIKey: cfg.ResendAPIKey, From: cfg.EmailFrom}
	}
	return &Server{
		cfg:         cfg,
		store:       st,
		cipher:      c,
		mailer:      mailer,
		github:      &github.Client{ClientID: cfg.GitHubClientID, ClientSecret: cfg.GitHubClientSecret},
		ai:          &ai.Engine{GatewayURL: cfg.AIGatewayURL},
		authLimiter: newRateLimiter(20, time.Minute),
		aiLimiter:   newRateLimiter(30, time.Minute),
	}, nil
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	route := func(pattern string, h handler) { mux.Handle(pattern, h) }

	route("GET /healthz", s.healthz)
	route("GET /readyz", s.readyz)

	// Auth (ADR-002)
	route("POST /api/v1/auth/github", s.authLimiter.wrap(s.loginGitHub))
	route("POST /api/v1/auth/magic-link", s.authLimiter.wrap(s.requestMagicLink))
	route("POST /api/v1/auth/magic-link/verify", s.authLimiter.wrap(s.verifyMagicLink))
	route("POST /api/v1/auth/logout", s.logout)
	route("GET /api/v1/auth/me", requireAuth(s.me))
	if s.cfg.EnableDevLogin {
		route("POST /api/v1/auth/dev/login", s.devLogin)
	}

	// Users
	route("GET /api/v1/users/me", requireAuth(s.getMe))
	route("PATCH /api/v1/users/me", requirePermission(model.PermEditOwnProfile, s.updateMe))
	route("PUT /api/v1/users/me", requirePermission(model.PermEditOwnProfile, s.updateMe))
	route("GET /api/v1/users/available", s.usernameAvailable)
	route("GET /api/v1/users/{username}", s.getUser)

	// Idea Bank
	route("GET /api/v1/ideas", s.listIdeas)
	route("GET /api/v1/ideas/{id}", s.getIdea)
	route("POST /api/v1/ideas", requirePermission(model.PermSeedIdeas, s.createIdea))

	// Submissions & stamping
	route("GET /api/v1/submissions", s.listSubmissions)
	route("GET /api/v1/submissions/{hash}", s.getSubmission)
	route("GET /api/v1/submissions/{hash}/certificate", s.getCertificate)
	route("POST /api/v1/submissions", requirePermission(model.PermSubmitSolution, s.createSubmission))
	route("POST /api/v1/submissions/{hash}/verify", requirePermission(model.PermStampSolution, s.verifySubmission))
	route("POST /api/v1/submissions/{hash}/reject", requirePermission(model.PermReviewSubmissions, s.rejectSubmission))

	// Jobs & coaching
	route("GET /api/v1/jobs", s.listJobs)
	route("GET /api/v1/jobs/{id}", s.getJob)
	route("POST /api/v1/jobs", requirePermission(model.PermManagePlatform, s.createJob))
	route("GET /api/v1/coaching", s.listItineraries)
	route("GET /api/v1/coaching/{id}", s.getItinerary)

	// AI (ADR-005)
	route("POST /api/v1/ai/scrutiny", requirePermission(model.PermApplyJob, s.aiLimiter.wrap(s.scrutiny)))
	route("POST /api/v1/ai/coach", requirePermission(model.PermRunAICoach, s.aiLimiter.wrap(s.coach)))

	var h http.Handler = mux
	h = s.authenticate(h)
	h = securityHeaders(h)
	h = s.cors(h)
	h = logRequests(h)
	h = recoverPanics(h)
	return h
}

func (s *Server) healthz(w http.ResponseWriter, r *http.Request) error {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	return nil
}

func (s *Server) readyz(w http.ResponseWriter, r *http.Request) error {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.store.Ping(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable", "database": "down"})
		return nil
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "database": "up"})
	return nil
}
