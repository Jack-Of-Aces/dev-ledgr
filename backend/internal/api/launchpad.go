package api

import (
	"errors"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

// maxActiveClaims caps how many problems one dev can hold in progress, so
// problems are not hoarded.
const maxActiveClaims = 3

// GET /api/launchpad/problems?status=&domain=&difficulty=&search=
func (s *Server) listProblems(w http.ResponseWriter, r *http.Request) error {
	status := r.URL.Query().Get("status")
	if status != "" && !slices.Contains(model.ProblemStatuses, status) {
		v := validationErrors{}
		v.add("status", "Status must be one of "+strings.Join(model.ProblemStatuses, ", "))
		return v.err()
	}
	return s.listIdeasWith(w, r, status)
}

// GET /api/launchpad/problems/{id}
func (s *Server) getProblem(w http.ResponseWriter, r *http.Request) error {
	return s.getIdea(w, r)
}

type claimRequest struct {
	ProblemID string `json:"problemId"`
}

// POST /api/launchpad/claim (body {problemId}) or /api/launchpad/claim/{problemId}
// makes the caller the dev building an open problem and moves it to in_progress.
func (s *Server) claimProblem(w http.ResponseWriter, r *http.Request) error {
	var req claimRequest
	if err := decodeOptionalJSON(w, r, &req); err != nil {
		return err
	}
	if id := r.PathValue("problemId"); id != "" {
		req.ProblemID = id
	}
	if req.ProblemID == "" {
		v := validationErrors{}
		v.add("problemId", "problemId is required")
		return v.err()
	}
	idea, err := s.store.ClaimIdea(r.Context(), req.ProblemID, devFrom(r.Context()).ID, maxActiveClaims)
	switch {
	case errors.Is(err, store.ErrNotFound):
		return errNotFound("Problem not found")
	case errors.Is(err, store.ErrNotOpen):
		return errConflict("This problem is already claimed or no longer open")
	case errors.Is(err, store.ErrClaimLimit):
		return &apiError{Message: "You can hold at most 3 active problems. Complete or release one first.",
			StatusCode: http.StatusConflict, Code: "CLAIM_LIMIT"}
	case err != nil:
		return err
	}
	writeJSON(w, http.StatusOK, idea)
	return nil
}

// GET /api/launchpad/claims?status= lists the caller's claimed problems.
func (s *Server) myClaims(w http.ResponseWriter, r *http.Request) error {
	var statuses []string
	if st := r.URL.Query().Get("status"); st != "" {
		if !slices.Contains(model.ProblemStatuses, st) {
			v := validationErrors{}
			v.add("status", "Status must be one of "+strings.Join(model.ProblemStatuses, ", "))
			return v.err()
		}
		statuses = []string{st}
	}
	ideas, err := s.store.IdeasByClaimant(r.Context(), devFrom(r.Context()).ID, statuses...)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, ideas)
	return nil
}

type statusView struct {
	ProblemID       string        `json:"problemId"`
	Status          string        `json:"status"`
	ClaimedBy       *model.DevRef `json:"claimedBy"`
	ClaimedAt       *time.Time    `json:"claimedAt,omitempty"`
	StatusUpdatedAt time.Time     `json:"statusUpdatedAt"`
	CompletedAt     *time.Time    `json:"completedAt,omitempty"`
}

// GET /api/launchpad/status/{problemId}
func (s *Server) problemStatus(w http.ResponseWriter, r *http.Request) error {
	idea, err := s.store.GetIdea(r.Context(), r.PathValue("problemId"))
	if errors.Is(err, store.ErrNotFound) {
		return errNotFound("Problem not found")
	}
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, statusView{
		ProblemID: idea.ID, Status: idea.Status, ClaimedBy: idea.ClaimedBy, ClaimedAt: idea.ClaimedAt,
		StatusUpdatedAt: idea.StatusUpdatedAt, CompletedAt: idea.CompletedAt,
	})
	return nil
}

type statusRequest struct {
	ProblemID string `json:"problemId"`
	Status    string `json:"status"`
}

// POST /api/launchpad/status moves a problem between open, in_progress,
// seeking_contributors and complete. The dev building it (or an admin) may:
//   - toggle in_progress <-> seeking_contributors
//   - mark it complete
//   - release it back to open
//
// Opening a problem for a builder goes through /claim; reopening a completed
// problem is admin-only.
func (s *Server) updateProblemStatus(w http.ResponseWriter, r *http.Request) error {
	var req statusRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	v := validationErrors{}
	if req.ProblemID == "" {
		v.add("problemId", "problemId is required")
	}
	if !slices.Contains(model.ProblemStatuses, req.Status) {
		v.add("status", "Status must be one of "+strings.Join(model.ProblemStatuses, ", "))
	}
	if err := v.err(); err != nil {
		return err
	}

	idea, err := s.store.GetIdea(r.Context(), req.ProblemID)
	if errors.Is(err, store.ErrNotFound) {
		return errNotFound("Problem not found")
	}
	if err != nil {
		return err
	}

	dev := devFrom(r.Context())
	isAdmin := model.HasPermission(dev.Role, model.PermManagePlatform)
	isBuilder := idea.ClaimedBy != nil && idea.ClaimedBy.ID == dev.ID
	from, to := idea.Status, req.Status

	switch {
	case from == to:
		return errConflict("Problem is already " + to)
	case !isBuilder && !isAdmin:
		return errForbidden("Only the dev building this problem or an admin can change its status")
	case from == model.StatusOpen:
		return errConflict("Claim this problem before changing its status")
	case from == model.StatusComplete && !isAdmin:
		return errForbidden("Only an admin can reopen a completed problem")
	case to != model.StatusOpen && idea.ClaimedBy == nil:
		return errConflict("This problem has no builder; release it to open so it can be claimed")
	}

	updated, err := s.store.SetIdeaStatus(r.Context(), idea.ID, from, to)
	if errors.Is(err, store.ErrStale) {
		return errConflict("The problem changed while you were updating it; reload and retry")
	}
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, updated)
	return nil
}
