package api

import (
	"cmp"
	"errors"
	"fmt"
	"math"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/skills"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

// maxActiveClaims caps how many problems one dev can hold in progress, so
// problems are not hoarded.
const maxActiveClaims = 3

const (
	// recommendationLimit is the default number of problems returned to the
	// "recommended first challenge" card; maxRecommendationLimit caps ?limit=.
	recommendationLimit    = 5
	maxRecommendationLimit = 20
	// maxDraftSkills and maxDraftSkillChars bound the ?skills= onboarding
	// draft so a client cannot turn the ranking endpoint into a parser.
	maxDraftSkills     = 50
	maxDraftSkillChars = 500
)

// problemRecommendation is one problem on the ranked list, carrying the
// evidence behind its position.
type problemRecommendation struct {
	model.Idea
	Match *model.IdeaMatch `json:"match"`
}

type recommendationPage struct {
	Problems     []problemRecommendation `json:"problems"`
	Total        int                     `json:"total"`
	Personalized bool                    `json:"personalized"`
	DevSkills    []string                `json:"devSkills"`
}

// difficultyRanks and levelRanks give problem difficulty and developer
// seniority a common scale so the two can be compared. Scraped problems use
// the plain easy/medium/hard scale while the curated bank uses
// foundational/intermediate/production-grade, so both vocabularies are
// mapped. Unrecognised labels are absent from the map and score neutrally, so
// an admin-authored problem with a bespoke difficulty neither wins nor loses
// on this term.
var (
	difficultyRanks = map[string]int{
		"foundational": 1, "beginner": 1, "easy": 1,
		"intermediate": 2, "medium": 2,
		"advanced": 3, "production-grade": 3, "hard": 3, "expert": 3,
	}
	levelRanks = map[string]int{"junior": 1, "mid": 2, "senior": 3, "lead": 3}
)

// difficultyFit scores 0-10 how well a problem's difficulty suits a seniority
// level: 10 when the ranks agree, 5 one step apart, 0 further. It is a nudge,
// not a filter — a strong skill match can still carry a junior onto a harder
// problem.
func difficultyFit(difficulty, level string) int {
	d, ok := difficultyRanks[strings.ToLower(strings.TrimSpace(difficulty))]
	if !ok {
		return 0
	}
	l, ok := levelRanks[strings.ToLower(strings.TrimSpace(level))]
	if !ok {
		return 0
	}
	gap := d - l
	if gap < 0 {
		gap = -gap
	}
	if gap >= 2 {
		return 0
	}
	return 10 - gap*5
}

// problemSkills is the skill vocabulary a problem is matched against: its
// editorial tags plus the stack it suggests. Scraped problems routinely carry
// a stack and no tags, so both are needed for the score to mean anything.
func problemSkills(p *model.Idea) []string {
	if len(p.Tags) == 0 {
		return p.SuggestedStack
	}
	if len(p.SuggestedStack) == 0 {
		return p.Tags
	}
	return append(slices.Clone(p.Tags), p.SuggestedStack...)
}

// rankProblems scores each problem against the dev's skill set and returns
// them best-first. The score combines skill overlap with the seniority fit;
// ties keep the store's newest-first order.
//
// A problem with no stated requirements at all cannot be scored, so it is
// reported as unmatchable rather than being handed a misleading zero and
// sorted by seniority alone.
func rankProblems(problems []model.Idea, have map[string]string, level string) []problemRecommendation {
	out := make([]problemRecommendation, len(problems))
	rank := make([]int, len(problems))
	// Unscorable problems sort after every scored one, so rank stays
	// meaningful; a stable sort keeps their relative order.
	lowest := math.MinInt
	for i, p := range problems {
		score, matched, missing := skills.Match(have, problemSkills(&p))
		fit := difficultyFit(p.Difficulty, level)
		out[i] = problemRecommendation{
			Idea:  p,
			Match: &model.IdeaMatch{Score: score, MatchedSkills: matched, MissingSkills: missing, DifficultyFit: fit},
		}
		switch {
		case len(problemSkills(&p)) == 0:
			rank[i] = lowest
		default:
			rank[i] = score + fit
			if rank[i] < lowest {
				lowest = rank[i]
			}
		}
	}
	idx := make([]int, len(problems))
	for i := range idx {
		idx[i] = i
	}
	slices.SortStableFunc(idx, func(a, b int) int { return cmp.Compare(rank[b], rank[a]) })
	sorted := make([]problemRecommendation, len(out))
	for i, j := range idx {
		sorted[i] = out[j]
	}
	return sorted
}

// parseDraftSkills reads the ?skills= onboarding draft: a comma-separated list
// of the skills a dev has ticked so far.
func parseDraftSkills(raw string) ([]string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	if len(raw) > maxDraftSkillChars {
		return nil, errBadRequest("skills must be under 500 characters")
	}
	parts := strings.Split(raw, ",")
	if len(parts) > maxDraftSkills {
		return nil, errBadRequest(fmt.Sprintf("skills must hold at most %d entries", maxDraftSkills))
	}
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if s := strings.TrimSpace(p); s != "" {
			out = append(out, s)
		}
	}
	return dedupe(out), nil
}

// GET /api/launchpad/problems/recommended?level=&skills=&limit= ranks the
// problem bank for the signed-in dev, best first, so the console can name a
// first challenge that actually fits the profile. Scoring mirrors the job
// board: the dev's stated skills plus the skills proven by their verified
// submissions and completed builds.
//
// The onboarding flow needs this before the profile is written, so ?skills
// carries the draft the dev is still editing and takes precedence over the
// saved stated skills; proven skills always count. ?level is the seniority
// chosen in onboarding and only nudges the ranking (see difficultyFit).
func (s *Server) recommendedProblems(w http.ResponseWriter, r *http.Request) error {
	dev := devFrom(r.Context())
	q := r.URL.Query()

	level := strings.ToLower(strings.TrimSpace(q.Get("level")))
	if level != "" && !slices.Contains(model.ExperienceLevels, level) {
		v := validationErrors{}
		v.add("level", "level must be one of "+strings.Join(model.ExperienceLevels, ", "))
		return v.err()
	}
	draft, err := parseDraftSkills(q.Get("skills"))
	if err != nil {
		return err
	}
	limit := recommendationLimit
	if l := q.Get("limit"); l != "" {
		n, e := strconv.Atoi(l)
		if e != nil || n < 1 || n > maxRecommendationLimit {
			return errBadRequest(fmt.Sprintf("limit must be 1-%d", maxRecommendationLimit))
		}
		limit = n
	}

	proven, err := s.store.ProvenSkills(r.Context(), dev.ID)
	if err != nil {
		return err
	}
	have := skills.Set(dev.StatedSkills, proven)
	if len(draft) > 0 {
		have = skills.Set(draft, proven)
	}

	// Visibility matches the public list: approved only, unless the caller
	// moderates. Recommending a problem the list hides would be exactly the
	// fetched-vs-displayed mismatch this endpoint is meant to remove.
	var approved *bool
	if !canModerate(r) {
		t := true
		approved = &t
	}
	status := model.StatusOpen
	problems, err := s.store.ListIdeas(r.Context(), store.IdeaFilters{Approved: approved, Status: status})
	if err != nil {
		return err
	}
	// A first challenge has to be claimable, but an empty card helps nobody:
	// if every problem is being built, fall back to the rest of the bank.
	if len(problems) == 0 {
		if problems, err = s.store.ListIdeas(r.Context(), store.IdeaFilters{Approved: approved}); err != nil {
			return err
		}
	}

	ranked := rankProblems(problems, have, level)
	page := recommendationPage{
		Problems:     ranked[:min(limit, len(ranked))],
		Total:        len(ranked),
		Personalized: true,
		DevSkills:    skills.Sorted(have),
	}
	writeJSON(w, http.StatusOK, page)
	return nil
}

// GET /api/launchpad/problems?status=
//
// Only admin-approved problems are public. Moderators see every problem by
// default and may narrow with ?approved=true|false, matching /api/v1/ideas.
func (s *Server) listProblems(w http.ResponseWriter, r *http.Request) error {
	approved, err := approvedFilter(r)
	if err != nil {
		return err
	}
	return s.listProblemsWith(w, r, approved)
}

// approvedFilter resolves ?approved= into a store filter. A nil result means
// both approved and unapproved problems, which is what a moderator gets by
// default. Everyone else is pinned to approved-only: the drafts are not public,
// and a non-moderator cannot opt into them with the query parameter.
func approvedFilter(r *http.Request) (*bool, error) {
	approved := true
	if canModerate(r) {
		switch q := r.URL.Query().Get("approved"); q {
		case "", "all":
			return nil, nil
		case "true":
		case "false":
			approved = false
		default:
			v := validationErrors{}
			v.add("approved", "approved must be true, false or all")
			return nil, v.err()
		}
	}
	return &approved, nil
}

// listProblemsWith lists Launchpad problems. approved nil means both approved
// and unapproved problems.
func (s *Server) listProblemsWith(w http.ResponseWriter, r *http.Request, approved *bool) error {
	status := r.URL.Query().Get("status")
	if status != "" && !slices.Contains(model.ProblemStatuses, status) {
		v := validationErrors{}
		v.add("status", "Status must be one of "+strings.Join(model.ProblemStatuses, ", "))
		return v.err()
	}
	// Validate length constraints similar to catalog version
	v := validationErrors{}
	if len(r.URL.Query().Get("search")) > 100 || len(r.URL.Query().Get("domain")) > 40 || len(r.URL.Query().Get("difficulty")) > 40 {
		v.add("search", "search must be under 100 characters; domain and difficulty under 40")
	}
	f := store.IdeaFilters{
		Domain:     r.URL.Query().Get("domain"),
		Difficulty: r.URL.Query().Get("difficulty"),
		Search:     r.URL.Query().Get("search"),
		Status:     status,
		Approved:   approved,
	}
	if err := v.err(); err != nil {
		return err
	}
	ideas, err := s.store.ListIdeas(r.Context(), f)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, ideas)
	return nil
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
	case errors.Is(err, store.ErrNotApproved):
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
	idea, err := s.loadVisibleIdea(r, r.PathValue("problemId"))
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
