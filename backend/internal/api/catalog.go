package api

import (
	"errors"
	"net/http"
	"slices"
	"strings"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

// canModerate reports whether the caller may see and approve unapproved problems and jobs.
func canModerate(r *http.Request) bool {
	dev := devFrom(r.Context())
	return dev != nil && model.HasPermission(dev.Role, model.PermSeedIdeas)
}

// GET /api/v1/ideas?domain=&difficulty=&search=
func (s *Server) listIdeas(w http.ResponseWriter, r *http.Request) error {
	return s.listIdeasWith(w, r, "")
}

// listIdeasWith lists problems. Everyone sees admin-approved problems;
// moderators see all and may filter with ?approved=true|false.
func (s *Server) listIdeasWith(w http.ResponseWriter, r *http.Request, status string) error {
	q := r.URL.Query()
	f := store.IdeaFilters{Domain: q.Get("domain"), Difficulty: q.Get("difficulty"), Search: q.Get("search"), Status: status}
	v := validationErrors{}
	if len(f.Search) > 100 || len(f.Domain) > 40 || len(f.Difficulty) > 40 {
		v.add("search", "search must be under 100 characters; domain and difficulty under 40")
	}
	approved := true
	f.Approved = &approved
	if canModerate(r) {
		switch q.Get("approved") {
		case "", "all":
			f.Approved = nil
		case "true":
		case "false":
			approved = false
		default:
			v.add("approved", "approved must be true, false or all")
		}
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

// loadVisibleIdea fetches a problem, hiding unapproved ones from non-moderators.
func (s *Server) loadVisibleIdea(r *http.Request, id string) (*model.Idea, error) {
	idea, err := s.store.GetIdea(r.Context(), id)
	if errors.Is(err, store.ErrNotFound) || (err == nil && !idea.AdminApproved && !canModerate(r)) {
		return nil, errNotFound("Problem not found")
	}
	return idea, err
}

func (s *Server) getIdea(w http.ResponseWriter, r *http.Request) error {
	idea, err := s.loadVisibleIdea(r, r.PathValue("id"))
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, idea)
	return nil
}

// createIdeaRequest is Omit<IdeaItem, 'submissionCount'> plus the problem
// fields of the live schema. A client-sent id is ignored: ids are UUIDs.
type createIdeaRequest struct {
	ID                    string              `json:"id"`
	Title                 string              `json:"title"`
	Tagline               string              `json:"tagline"`
	Domain                string              `json:"domain"`
	Difficulty            string              `json:"difficulty"`
	EstimatedHours        int                 `json:"estimatedHours"`
	OriginStory           string              `json:"originStory"`
	ProblemStatement      string              `json:"problemStatement"`
	TechnicalRequirements []string            `json:"technicalRequirements"`
	MockInfra             model.MockInfraSpec `json:"mockInfra"`
	Tags                  []string            `json:"tags"`
	SuggestedStack        []string            `json:"suggestedStack"`
	RegionalHurdles       string              `json:"regionalHurdles"`
	SourceURL             string              `json:"sourceUrl"`
}

func (req *createIdeaRequest) validate() error {
	v := validationErrors{}
	req.Title = strings.TrimSpace(req.Title)
	if len(req.Title) < 5 || len(req.Title) > 160 {
		v.add("title", "Title must be 5-160 characters")
	}
	if len(req.Tagline) > 300 {
		v.add("tagline", "Tagline must be under 300 characters")
	}
	req.Domain, req.Difficulty = strings.TrimSpace(req.Domain), strings.TrimSpace(req.Difficulty)
	if req.Domain == "" || len(req.Domain) > 40 {
		v.add("domain", "Domain is required (max 40 characters)")
	}
	if req.Difficulty == "" || len(req.Difficulty) > 40 {
		v.add("difficulty", "Difficulty is required (max 40 characters)")
	}
	if req.EstimatedHours < 1 || req.EstimatedHours > 500 {
		v.add("estimatedHours", "Estimated hours must be between 1 and 500")
	}
	if strings.TrimSpace(req.ProblemStatement) == "" {
		v.add("problemStatement", "Problem statement is required")
	}
	if len(req.ProblemStatement) > 20000 || len(req.OriginStory) > 5000 || len(req.RegionalHurdles) > 5000 {
		v.add("problemStatement", "Problem statement, origin story or regional hurdles is too long")
	}
	if len(req.TechnicalRequirements) == 0 {
		v.add("technicalRequirements", "At least one technical requirement is required")
	}
	if req.SourceURL != "" && !isHTTPURL(req.SourceURL) {
		v.add("sourceUrl", "Must be a valid URL")
	}
	if req.MockInfra.BaseURL != "" && !isHTTPURL(req.MockInfra.BaseURL) {
		v.add("mockInfra.baseUrl", "Must be a valid URL")
	}
	if req.MockInfra.StarterRepoURL != "" && !isHTTPURL(req.MockInfra.StarterRepoURL) {
		v.add("mockInfra.starterRepoUrl", "Must be a valid URL")
	}
	for _, e := range req.MockInfra.Endpoints {
		if !slices.Contains([]string{"GET", "POST", "PUT", "DELETE"}, e.Method) {
			v.add("mockInfra.endpoints", "Endpoint method must be GET, POST, PUT or DELETE")
			break
		}
	}
	return v.err()
}

// POST /api/v1/ideas publishes a new problem (admin). Admin-authored problems are approved immediately.
func (s *Server) createIdea(w http.ResponseWriter, r *http.Request) error {
	var req createIdeaRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	if err := req.validate(); err != nil {
		return err
	}
	stack := dedupe(req.SuggestedStack)
	if len(stack) == 0 {
		stack = dedupe(req.Tags)
	}
	idea, err := s.store.CreateIdea(r.Context(), model.Idea{
		Title: req.Title, Tagline: req.Tagline, Domain: req.Domain, Difficulty: req.Difficulty,
		EstimatedHours: req.EstimatedHours, OriginStory: req.OriginStory, ProblemStatement: req.ProblemStatement,
		TechnicalRequirements: req.TechnicalRequirements, MockInfra: req.MockInfra, Tags: dedupe(req.Tags),
		SuggestedStack: stack, RegionalHurdles: req.RegionalHurdles, SourceURL: req.SourceURL,
	})
	if errors.Is(err, store.ErrConflict) {
		return errConflict("A problem with this title already exists")
	}
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusCreated, idea)
	return nil
}

type approveRequest struct {
	Approved *bool `json:"approved"`
}

type activeRequest struct {
	Active *bool `json:"active"`
}

// POST /api/launchpad/problems/{id}/approve publishes (default) or, with
// {"approved": false}, unpublishes a problem (admin).
func (s *Server) approveProblem(w http.ResponseWriter, r *http.Request) error {
	var req approveRequest
	if err := decodeOptionalJSON(w, r, &req); err != nil {
		return err
	}
	approved := req.Approved == nil || *req.Approved
	idea, err := s.store.SetApproved(r.Context(), r.PathValue("id"), approved)
	if errors.Is(err, store.ErrNotFound) {
		return errNotFound("Problem not found")
	}
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, idea)
	return nil
}

func (s *Server) listJobs(w http.ResponseWriter, r *http.Request) error {
	jobs, err := s.store.ListJobs(r.Context())
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, jobs)
	return nil
}

// loadVisibleJob fetches a job, hiding unapproved, inactive or deleted ones
// from non-moderators.
func (s *Server) loadVisibleJob(r *http.Request, id string) (*model.Job, error) {
	job, err := s.store.GetJob(r.Context(), id)
	if errors.Is(err, store.ErrNotFound) ||
		(err == nil && !(job.AdminApproved && job.IsActive && job.DeletedAt == nil) && !canModerate(r)) {
		return nil, errNotFound("Job not found")
	}
	return job, err
}

func (s *Server) getJob(w http.ResponseWriter, r *http.Request) error {
	job, err := s.loadVisibleJob(r, r.PathValue("id"))
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, job)
	return nil
}

// POST /api/v1/jobs publishes a job opportunity (admin). A client-sent id is ignored.
func (s *Server) createJob(w http.ResponseWriter, r *http.Request) error {
	var job model.Job
	if err := decodeJSON(w, r, &job); err != nil {
		return err
	}
	v := validationErrors{}
	if strings.TrimSpace(job.Title) == "" {
		v.add("title", "Title is required")
	}
	if strings.TrimSpace(job.Company) == "" {
		v.add("company", "Company is required")
	}
	if job.Type == "" {
		job.Type = "Full-time"
	}
	if !slices.Contains(model.JobTypes, job.Type) {
		v.add("type", "Type must be one of "+strings.Join(model.JobTypes, ", "))
	}
	if job.Level != "" && !slices.Contains(model.JobLevels, job.Level) {
		v.add("level", "Level must be one of "+strings.Join(model.JobLevels, ", "))
	}
	if job.ApplyURL != "" && !isHTTPURL(job.ApplyURL) {
		v.add("applyUrl", "Must be a valid URL")
	}
	if job.GapIdeaID != "" {
		if _, err := s.store.GetIdea(r.Context(), job.GapIdeaID); errors.Is(err, store.ErrNotFound) {
			v.add("gapIdeaId", "Unknown problem")
		}
	}
	if err := v.err(); err != nil {
		return err
	}
	if len(job.Tags) == 0 {
		job.Tags = job.RequiredSkills
	}
	job.Tags = dedupe(job.Tags)
	created, err := s.store.CreateJob(r.Context(), job)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusCreated, created)
	return nil
}

// GET /api/v1/admin/jobs?active=&level=&search=
// Lists every job for moderation, including inactive and removed ones, which
// the public list hides. Deliberately unpaginated: the point of this list is
// that an admin can see the whole bank, and a cap would quietly hide the row
// someone is looking for. The store's filter carries a limit for other callers.
func (s *Server) listAdminJobs(w http.ResponseWriter, r *http.Request) error {
	q := r.URL.Query()
	f := store.AdminJobFilters{Level: q.Get("level"), Search: q.Get("search")}
	v := validationErrors{}
	if len(f.Search) > 100 || len(f.Level) > 40 {
		v.add("search", "search must be under 100 characters and level under 40")
	}
	active := true
	f.Active = &active
	switch q.Get("active") {
	case "", "all":
		f.Active = nil
	case "true":
	case "false":
		active = false
	default:
		v.add("active", "active must be true, false or all")
	}
	if err := v.err(); err != nil {
		return err
	}
	jobs, err := s.store.ListAllJobs(r.Context(), f)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, jobs)
	return nil
}

// POST /api/v1/jobs/{id}/active shows (default) or, with {"active": false},
// hides a job from the public board (admin).
func (s *Server) setJobActive(w http.ResponseWriter, r *http.Request) error {
	var req activeRequest
	if err := decodeOptionalJSON(w, r, &req); err != nil {
		return err
	}
	active := req.Active == nil || *req.Active
	job, err := s.store.SetJobActive(r.Context(), r.PathValue("id"), active)
	if errors.Is(err, store.ErrNotFound) {
		return errNotFound("Job not found")
	}
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, job)
	return nil
}

// DELETE /api/v1/jobs/{id} removes a job from the platform (admin).
func (s *Server) deleteJob(w http.ResponseWriter, r *http.Request) error {
	err := s.store.DeleteJob(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		return errNotFound("Job not found")
	}
	if err != nil {
		return err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}

func (s *Server) listItineraries(w http.ResponseWriter, r *http.Request) error {
	its, err := s.store.ListItineraries(r.Context())
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, its)
	return nil
}

func (s *Server) getItinerary(w http.ResponseWriter, r *http.Request) error {
	it, err := s.store.GetItinerary(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		return errNotFound("Coaching itinerary not found")
	}
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, it)
	return nil
}
