package api

import (
	"errors"
	"net/http"
	"regexp"
	"slices"
	"strings"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

var slugPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{2,63}$`)

// GET /api/v1/ideas?domain=&difficulty=&search=
func (s *Server) listIdeas(w http.ResponseWriter, r *http.Request) error {
	q := r.URL.Query()
	f := store.IdeaFilters{Domain: q.Get("domain"), Difficulty: q.Get("difficulty"), Search: q.Get("search")}
	v := validationErrors{}
	if f.Domain != "" && !slices.Contains(model.Domains, f.Domain) {
		v.add("domain", "Unknown domain")
	}
	if f.Difficulty != "" && !slices.Contains(model.Difficulties, f.Difficulty) {
		v.add("difficulty", "Unknown difficulty")
	}
	if len(f.Search) > 100 {
		v.add("search", "Search must be under 100 characters")
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

func (s *Server) getIdea(w http.ResponseWriter, r *http.Request) error {
	idea, err := s.store.GetIdea(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		return errNotFound("Idea not found")
	}
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, idea)
	return nil
}

// createIdeaRequest is Omit<IdeaItem, 'submissionCount'>.
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
}

func (req *createIdeaRequest) validate() error {
	v := validationErrors{}
	if !slugPattern.MatchString(req.ID) {
		v.add("id", "id must be a lowercase slug (3-64 chars: a-z, 0-9, -)")
	}
	if t := strings.TrimSpace(req.Title); len(t) < 5 || len(t) > 160 {
		v.add("title", "Title must be 5-160 characters")
	}
	if len(req.Tagline) > 300 {
		v.add("tagline", "Tagline must be under 300 characters")
	}
	if !slices.Contains(model.Domains, req.Domain) {
		v.add("domain", "Domain must be one of "+strings.Join(model.Domains, ", "))
	}
	if !slices.Contains(model.Difficulties, req.Difficulty) {
		v.add("difficulty", "Difficulty must be one of "+strings.Join(model.Difficulties, ", "))
	}
	if req.EstimatedHours < 1 || req.EstimatedHours > 500 {
		v.add("estimatedHours", "Estimated hours must be between 1 and 500")
	}
	if strings.TrimSpace(req.ProblemStatement) == "" {
		v.add("problemStatement", "Problem statement is required")
	}
	if len(req.ProblemStatement) > 20000 || len(req.OriginStory) > 5000 {
		v.add("problemStatement", "Problem statement or origin story is too long")
	}
	if len(req.TechnicalRequirements) == 0 {
		v.add("technicalRequirements", "At least one technical requirement is required")
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

// POST /api/v1/ideas seeds a new challenge into the Idea Bank (admin).
func (s *Server) createIdea(w http.ResponseWriter, r *http.Request) error {
	var req createIdeaRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	if err := req.validate(); err != nil {
		return err
	}
	idea, err := s.store.CreateIdea(r.Context(), model.Idea{
		ID: req.ID, Title: strings.TrimSpace(req.Title), Tagline: req.Tagline, Domain: req.Domain,
		Difficulty: req.Difficulty, EstimatedHours: req.EstimatedHours, OriginStory: req.OriginStory,
		ProblemStatement: req.ProblemStatement, TechnicalRequirements: req.TechnicalRequirements,
		MockInfra: req.MockInfra, Tags: dedupe(req.Tags),
	}, principalFrom(r.Context()).User.ID)
	if errors.Is(err, store.ErrConflict) {
		return errConflict("An idea with this id already exists")
	}
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusCreated, idea)
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

func (s *Server) getJob(w http.ResponseWriter, r *http.Request) error {
	job, err := s.store.GetJob(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		return errNotFound("Job not found")
	}
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, job)
	return nil
}

// POST /api/v1/jobs publishes a job opportunity (admin).
func (s *Server) createJob(w http.ResponseWriter, r *http.Request) error {
	var job model.Job
	if err := decodeJSON(w, r, &job); err != nil {
		return err
	}
	v := validationErrors{}
	if !slugPattern.MatchString(job.ID) {
		v.add("id", "id must be a lowercase slug (3-64 chars: a-z, 0-9, -)")
	}
	if strings.TrimSpace(job.Title) == "" {
		v.add("title", "Title is required")
	}
	if strings.TrimSpace(job.Company) == "" {
		v.add("company", "Company is required")
	}
	if !slices.Contains(model.JobTypes, job.Type) {
		v.add("type", "Type must be one of "+strings.Join(model.JobTypes, ", "))
	}
	if job.MatchScore < 0 || job.MatchScore > 100 {
		v.add("matchScore", "Match score must be between 0 and 100")
	}
	if err := v.err(); err != nil {
		return err
	}
	if job.GapIdeaID != "" {
		if _, err := s.store.GetIdea(r.Context(), job.GapIdeaID); errors.Is(err, store.ErrNotFound) {
			v.add("gapIdeaId", "Unknown idea")
			return v.err()
		}
	}
	created, err := s.store.CreateJob(r.Context(), job)
	if errors.Is(err, store.ErrConflict) {
		return errConflict("A job with this id already exists")
	}
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusCreated, created)
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
