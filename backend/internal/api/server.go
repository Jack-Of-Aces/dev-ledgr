// Package api implements the DevLedgr REST API: auth (Supabase), the
// Launchpad problem bank, the job board and CV audits, dev portfolios, and
// the /api/v1 contracts used by the Next.js service layer.
package api

import (
	"context"
	"net/http"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/ai"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/config"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/security"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/supabase"
)

type Server struct {
	cfg      *config.Config
	store    *store.Store
	cipher   *security.Cipher
	verifier *supabase.Verifier
	auth     *supabase.AuthClient
	ai       *ai.Engine

	authLimiter *rateLimiter
	aiLimiter   *rateLimiter
}

func NewServer(cfg *config.Config, st *store.Store) (*Server, error) {
	c, err := security.NewCipher(cfg.EncryptionKey)
	if err != nil {
		return nil, err
	}
	engine := &ai.Engine{GatewayURL: cfg.AIGatewayURL, Model: cfg.AnthropicModel}
	if cfg.AnthropicAPIKey != "" {
		client := anthropic.NewClient(option.WithAPIKey(cfg.AnthropicAPIKey), option.WithRequestTimeout(90*time.Second))
		engine.Claude = &client
	}
	return &Server{
		cfg:         cfg,
		store:       st,
		cipher:      c,
		verifier:    supabase.NewVerifier(cfg.SupabaseURL, cfg.SupabaseJWTSecret, nil),
		auth:        &supabase.AuthClient{BaseURL: cfg.SupabaseURL, AnonKey: cfg.SupabaseAnonKey},
		ai:          engine,
		authLimiter: newRateLimiter(20, time.Minute),
		aiLimiter:   newRateLimiter(30, time.Minute),
	}, nil
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	route := func(pattern string, h handler) { mux.Handle(pattern, h) }

	route("GET /healthz", s.healthz)
	route("GET /readyz", s.readyz)

	// Auth: Supabase Auth owns identity; these proxy it and keep dev records in sync.
	route("POST /api/auth/signup", s.authLimiter.wrap(s.signup))
	route("POST /api/auth/login", s.authLimiter.wrap(s.login))
	route("POST /api/auth/refresh", s.authLimiter.wrap(s.refresh))
	route("POST /api/auth/logout", s.logout)
	route("POST /api/auth/magic-link", s.authLimiter.wrap(s.magicLink))
	route("GET /api/auth/oauth/{provider}", s.oauthStart)
	route("GET /api/auth/me", requireAuth(s.me))
	route("POST /api/auth/webhook", s.authWebhook)

	// Launchpad: the problem bank and who is building what.
	route("GET /api/launchpad/problems", s.listProblems)
	route("GET /api/launchpad/problems/recommended", requireAuth(s.recommendedProblems))
	route("GET /api/launchpad/problems/{id}", s.getProblem)
	route("POST /api/launchpad/problems/{id}/approve", requirePermission(model.PermSeedIdeas, s.approveProblem))
	route("POST /api/launchpad/claim", requirePermission(model.PermSubmitSolution, s.claimProblem))
	route("POST /api/launchpad/claim/{problemId}", requirePermission(model.PermSubmitSolution, s.claimProblem))
	route("GET /api/launchpad/claims", requireAuth(s.myClaims))
	route("POST /api/launchpad/status", requireAuth(s.updateProblemStatus))
	route("GET /api/launchpad/status/{problemId}", s.problemStatus)

	// Job board
	route("GET /api/jobBoard/jobs", s.jobBoard)
	route("GET /api/jobBoard/jobs/{id}", s.jobBoardJob)
	route("POST /api/jobBoard/jobs", requireServiceOr(model.PermManagePlatform, s.ingestJobs))
	route("POST /api/jobBoard/audit", requireServiceOr(model.PermApplyJob, s.aiLimiter.wrap(s.auditCV)))
	route("GET /api/jobBoard/audit", requireServiceOr(model.PermApplyJob, s.listAudits))
	route("GET /api/jobBoard/audit/{id}", requireServiceOr(model.PermApplyJob, s.getAudit))

	// Dev portfolio & profile
	route("GET /api/dev/portfolio", s.devPortfolio)
	route("GET /api/dev/portfolio/{username}", s.devPortfolio)
	route("GET /api/dev/profile", requireAuth(s.getMe))
	route("PATCH /api/dev/profile", requirePermission(model.PermEditOwnProfile, s.updateMe))

	// Internal (X-Service-Key): server-to-server lookups for the Next.js AI routes.
	route("GET /api/internal/provider-key", s.internalProviderKey)

	// v1: contracts the current frontend service layer calls (frontend/src/services).
	route("GET /api/v1/users/me", requireAuth(s.getMe))
	route("PATCH /api/v1/users/me", requirePermission(model.PermEditOwnProfile, s.updateMe))
	route("PUT /api/v1/users/me", requirePermission(model.PermEditOwnProfile, s.updateMe))
	route("GET /api/v1/users/available", s.usernameAvailable)
	route("PATCH /api/v1/users/me/username", requirePermission(model.PermEditOwnProfile, s.updateUsername))
	route("GET /api/v1/users/{username}", s.getUser)

	// Role management. public.profiles.role is otherwise unreachable: the
	// Supabase roles cannot write the column and no profile path includes it.
	// assign_roles, not manage_platform, so a reviewer can staff the queue
	// without also gaining job ingestion and problem seeding.
	route("GET /api/v1/admin/users", requirePermission(model.PermAssignRoles, s.listPlatformUsers))
	route("PATCH /api/v1/admin/users/{id}/role", requirePermission(model.PermAssignRoles, s.setUserRole))
	route("GET /api/v1/ideas", s.listIdeas)
	route("GET /api/v1/ideas/{id}", s.getIdea)
	route("POST /api/v1/ideas", requirePermission(model.PermSeedIdeas, s.createIdea))
	route("GET /api/v1/submissions", s.listSubmissions)
	route("GET /api/v1/submissions/{hash}", s.getSubmission)
	route("GET /api/v1/submissions/{hash}/certificate", s.getCertificate)
	route("POST /api/v1/submissions", requirePermission(model.PermSubmitSolution, s.createSubmission))
	route("POST /api/v1/submissions/{hash}/verify", requirePermission(model.PermStampSolution, s.verifySubmission))
	route("POST /api/v1/submissions/{hash}/reject", requirePermission(model.PermReviewSubmissions, s.rejectSubmission))
	route("GET /api/v1/jobs", s.listJobs)
	route("GET /api/v1/jobs/{id}", s.getJob)
	route("POST /api/v1/jobs", requirePermission(model.PermManagePlatform, s.createJob))
	// Job moderation. manage_platform already guards createJob and the scrape
	// ingest, so extending it to hide and remove adds no privilege for
	// reviewers; assign_roles stays the "staff the queue" permission.
	route("GET /api/v1/admin/jobs", requirePermission(model.PermManagePlatform, s.listAdminJobs))
	route("POST /api/v1/jobs/{id}/active", requirePermission(model.PermManagePlatform, s.setJobActive))
	route("DELETE /api/v1/jobs/{id}", requirePermission(model.PermManagePlatform, s.deleteJob))
	route("GET /api/v1/coaching", s.listItineraries)
	route("GET /api/v1/coaching/{id}", s.getItinerary)
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
	// A fresh connection through the Supabase pooler can take a few seconds.
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	if err := s.store.Ping(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable", "database": "down"})
		return nil
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "database": "up"})
	return nil
}
