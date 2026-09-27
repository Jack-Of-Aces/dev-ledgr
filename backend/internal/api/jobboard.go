package api

import (
	"cmp"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/ai"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/skills"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

const (
	jobScanLimit     = 2000
	maxIngestBatch   = 500
	minCVChars       = 200
	maxCVChars       = 60000
	defaultPageSize  = 20
	maxPageSize      = 100
	auditHistorySize = 50
)

type jobBoardEntry struct {
	model.Job
	Match *model.JobMatch `json:"match,omitempty"`
}

type jobBoardPage struct {
	Jobs         []jobBoardEntry `json:"jobs"`
	Total        int             `json:"total"`
	Limit        int             `json:"limit"`
	Offset       int             `json:"offset"`
	Personalized bool            `json:"personalized"`
	DevSkills    []string        `json:"devSkills,omitempty"`
}

// devSkillSet is a dev's stated skills plus skills proven on DevLedgr.
func (s *Server) devSkillSet(ctx context.Context, dev *model.UserProfile) (map[string]string, error) {
	proven, err := s.store.ProvenSkills(ctx, dev.ID)
	if err != nil {
		return nil, err
	}
	return skills.Set(dev.StatedSkills, proven), nil
}

func pageParams(r *http.Request) (limit, offset int, err error) {
	q := r.URL.Query()
	limit, offset = defaultPageSize, 0
	v := validationErrors{}
	if l := q.Get("limit"); l != "" {
		if n, e := strconv.Atoi(l); e != nil || n < 1 || n > maxPageSize {
			v.add("limit", fmt.Sprintf("limit must be 1-%d", maxPageSize))
		} else {
			limit = n
		}
	}
	if o := q.Get("offset"); o != "" {
		if n, e := strconv.Atoi(o); e != nil || n < 0 {
			v.add("offset", "offset must be a non-negative integer")
		} else {
			offset = n
		}
	}
	return limit, offset, v.err()
}

// GET /api/jobBoard/jobs?level=&search=&limit=&offset=
// Signed-in devs get jobs ranked by how well their skills match; anonymous
// callers get the newest jobs first.
func (s *Server) jobBoard(w http.ResponseWriter, r *http.Request) error {
	limit, offset, err := pageParams(r)
	if err != nil {
		return err
	}
	level := r.URL.Query().Get("level")
	if level != "" && !slices.Contains(model.JobLevels, level) {
		v := validationErrors{}
		v.add("level", "level must be one of "+strings.Join(model.JobLevels, ", "))
		return v.err()
	}
	search := r.URL.Query().Get("search")
	if len(search) > 100 {
		return errBadRequest("search must be under 100 characters")
	}

	jobs, err := s.store.SearchJobs(r.Context(), store.JobFilters{Level: level, Search: search, Limit: jobScanLimit})
	if err != nil {
		return err
	}
	entries := make([]jobBoardEntry, len(jobs))
	for i, j := range jobs {
		entries[i] = jobBoardEntry{Job: j}
	}

	page := jobBoardPage{Limit: limit, Offset: offset}
	if dev := devFrom(r.Context()); dev != nil {
		have, err := s.devSkillSet(r.Context(), dev)
		if err != nil {
			return err
		}
		for i := range entries {
			score, matched, missing := skills.Match(have, entries[i].Tags)
			entries[i].Match = &model.JobMatch{Score: score, MatchedSkills: matched, MissingSkills: missing}
			entries[i].MatchScore = score
		}
		// Stable: equal scores keep the store's newest-first order.
		slices.SortStableFunc(entries, func(a, b jobBoardEntry) int { return cmp.Compare(b.Match.Score, a.Match.Score) })
		page.Personalized = true
		page.DevSkills = skills.Sorted(have)
	}

	page.Total = len(entries)
	page.Jobs = entries[min(offset, len(entries)):min(offset+limit, len(entries))]
	writeJSON(w, http.StatusOK, page)
	return nil
}

// GET /api/jobBoard/jobs/{id}
func (s *Server) jobBoardJob(w http.ResponseWriter, r *http.Request) error {
	job, err := s.store.GetJob(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		return errNotFound("Job not found")
	}
	if err != nil {
		return err
	}
	entry := jobBoardEntry{Job: *job}
	if dev := devFrom(r.Context()); dev != nil {
		have, err := s.devSkillSet(r.Context(), dev)
		if err != nil {
			return err
		}
		score, matched, missing := skills.Match(have, job.Tags)
		entry.Match = &model.JobMatch{Score: score, MatchedSkills: matched, MissingSkills: missing}
		entry.MatchScore = score
	}
	writeJSON(w, http.StatusOK, entry)
	return nil
}

type scrapedJobInput struct {
	Source      string     `json:"source"`
	ExternalID  string     `json:"externalId"`
	Title       string     `json:"title"`
	Company     string     `json:"company"`
	Location    string     `json:"location"`
	Type        string     `json:"type"`
	Level       string     `json:"level"`
	Salary      string     `json:"salary"`
	Skills      []string   `json:"skills"`
	Description string     `json:"description"`
	URL         string     `json:"url"`
	PostedAt    *time.Time `json:"postedAt"`
}

type ingestRequest struct {
	Jobs []scrapedJobInput `json:"jobs"`
}

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

var sourcePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,39}$`)

// normalizeLevel maps free-text seniority from job boards onto the level enum.
func normalizeLevel(raw, title string) string {
	s := strings.ToLower(raw + " " + title)
	switch {
	case strings.Contains(s, "intern"):
		return "intern"
	case strings.Contains(s, "principal"), strings.Contains(s, "staff"), strings.Contains(s, "lead"), strings.Contains(s, "head of"):
		return "lead"
	case strings.Contains(s, "senior"), strings.Contains(s, "sr."), strings.Contains(s, "sr "):
		return "senior"
	case strings.Contains(s, "mid"), strings.Contains(s, "intermediate"):
		return "mid"
	case strings.Contains(s, "junior"), strings.Contains(s, "jr"), strings.Contains(s, "entry"),
		strings.Contains(s, "graduate"), strings.Contains(s, "associate"):
		return "junior"
	}
	return "unspecified"
}

func normalizeJobType(raw string) string {
	s := strings.ToLower(raw)
	switch {
	case strings.Contains(s, "intern"):
		return "Internship"
	case strings.Contains(s, "part"):
		return "Part-time"
	case strings.Contains(s, "contract"), strings.Contains(s, "freelance"):
		return "Contract"
	case strings.Contains(s, "remote"):
		return "Remote"
	}
	return "Full-time"
}

func scrapedJobID(source, externalID string) string {
	sum := sha256.Sum256([]byte(source + "\x00" + externalID))
	return "job-" + source + "-" + hex.EncodeToString(sum[:])[:12]
}

// POST /api/jobBoard/jobs ingests scraped listings (service key or admin).
// Listings are upserted by (source, externalId), so re-running a scrape refreshes them.
func (s *Server) ingestJobs(w http.ResponseWriter, r *http.Request) error {
	var req ingestRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	v := validationErrors{}
	if len(req.Jobs) == 0 || len(req.Jobs) > maxIngestBatch {
		v.add("jobs", fmt.Sprintf("Send 1-%d jobs per request", maxIngestBatch))
		return v.err()
	}
	rows := make([]store.ScrapedJob, 0, len(req.Jobs))
	for i, j := range req.Jobs {
		f := func(name string) string { return fmt.Sprintf("jobs[%d].%s", i, name) }
		j.Source = strings.ToLower(strings.TrimSpace(j.Source))
		j.ExternalID = strings.TrimSpace(j.ExternalID)
		j.Title, j.Company = strings.TrimSpace(j.Title), strings.TrimSpace(j.Company)
		if !sourcePattern.MatchString(j.Source) {
			v.add(f("source"), "source must be a short lowercase slug, e.g. linkedin")
		}
		if j.ExternalID == "" || len(j.ExternalID) > 200 {
			v.add(f("externalId"), "externalId is required (max 200 chars)")
		}
		if j.Title == "" || len(j.Title) > 200 {
			v.add(f("title"), "title is required (max 200 chars)")
		}
		if j.Company == "" || len(j.Company) > 200 {
			v.add(f("company"), "company is required (max 200 chars)")
		}
		if j.URL != "" && !isHTTPURL(j.URL) {
			v.add(f("url"), "url must be a valid URL")
		}
		if len(j.Description) > 50000 || len(j.Skills) > 50 {
			v.add(f("description"), "description (50k chars) or skills (50) too long")
		}
		level := j.Level
		if !slices.Contains(model.JobLevels, level) {
			level = normalizeLevel(j.Level, j.Title)
		}
		rows = append(rows, store.ScrapedJob{
			ID: scrapedJobID(j.Source, j.ExternalID), Source: j.Source, ExternalID: j.ExternalID,
			Title: j.Title, Company: j.Company, Location: strings.TrimSpace(j.Location),
			Type: normalizeJobType(j.Type), Level: level, Salary: strings.TrimSpace(j.Salary),
			Description: j.Description, SourceURL: j.URL, Skills: dedupe(j.Skills), PostedAt: j.PostedAt,
		})
	}
	if err := v.err(); err != nil {
		return err
	}
	inserted, updated, err := s.store.UpsertScrapedJobs(r.Context(), rows)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]int{"inserted": inserted, "updated": updated})
	return nil
}

type auditRequest struct {
	CVText string `json:"cvText"`
	JobID  string `json:"jobId"`
	// Service callers (the CV parser) name the dev the CV belongs to.
	DevID    string `json:"devId"`
	Username string `json:"username"`
}

// auditSubject resolves whose CV is being audited: the signed-in dev, or for
// service callers the dev named by devId/username.
func (s *Server) auditSubject(r *http.Request, devID, username string) (*model.UserProfile, error) {
	if dev := devFrom(r.Context()); dev != nil {
		return dev, nil
	}
	var (
		u   *model.UserProfile
		err error
	)
	switch {
	case devID != "":
		if !uuidPattern.MatchString(devID) {
			return nil, errNotFound("Dev not found")
		}
		u, err = s.store.GetUserByID(r.Context(), devID)
	case username != "":
		u, err = s.store.GetUserByUsername(r.Context(), username)
	default:
		v := validationErrors{}
		v.add("devId", "Service callers must identify the dev with devId or username")
		return nil, v.err()
	}
	if errors.Is(err, store.ErrNotFound) {
		return nil, errNotFound("Dev not found")
	}
	return u, err
}

// POST /api/jobBoard/audit scores CV text (extracted by the Python parser)
// for ATS compliance and stores the result. Optional jobId targets a job.
func (s *Server) auditCV(w http.ResponseWriter, r *http.Request) error {
	var req auditRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	req.CVText = strings.TrimSpace(req.CVText)
	n := utf8.RuneCountInString(req.CVText)
	switch {
	case !utf8.ValidString(req.CVText):
		return errBadRequest("cvText must be valid UTF-8")
	case n < minCVChars:
		v := validationErrors{}
		v.add("cvText", fmt.Sprintf("CV text is too short (%d characters); text extraction may have failed", n))
		return v.err()
	case n > maxCVChars:
		return &apiError{Message: fmt.Sprintf("CV text is too long (%d characters, max %d)", n, maxCVChars),
			StatusCode: http.StatusRequestEntityTooLarge, Code: "PAYLOAD_TOO_LARGE"}
	}

	dev, err := s.auditSubject(r, req.DevID, req.Username)
	if err != nil {
		return err
	}
	in := ai.ATSInput{CVText: req.CVText}
	if req.JobID != "" {
		job, err := s.store.GetJob(r.Context(), req.JobID)
		if errors.Is(err, store.ErrNotFound) {
			return errNotFound("Job not found")
		}
		if err != nil {
			return err
		}
		in.Job = job
	} else {
		have, err := s.devSkillSet(r.Context(), dev)
		if err != nil {
			return err
		}
		in.DevSkills = skills.Sorted(have)
	}

	result, err := s.ai.ATSAudit(r.Context(), in)
	switch {
	case errors.Is(err, ai.ErrAIRefused):
		return &apiError{Message: err.Error(), StatusCode: http.StatusUnprocessableEntity, Code: "AI_REFUSED"}
	case errors.Is(err, ai.ErrAIUnavailable):
		slog.Error("ats audit", "err", err)
		return &apiError{Message: "The AI audit service is temporarily unavailable. Please retry.",
			StatusCode: http.StatusServiceUnavailable, Code: "AI_UNAVAILABLE"}
	case err != nil:
		return err
	}
	result.CVChars = n

	sum := sha256.Sum256([]byte(req.CVText))
	audit, err := s.store.CreateAudit(r.Context(), store.NewAudit{
		DevID: dev.ID, JobID: req.JobID, Result: result, CVSHA256: hex.EncodeToString(sum[:]),
	})
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusCreated, audit)
	return nil
}

// GET /api/jobBoard/audit lists the caller's audits, newest first.
// Service callers pass ?devId= or ?username=.
func (s *Server) listAudits(w http.ResponseWriter, r *http.Request) error {
	dev, err := s.auditSubject(r, r.URL.Query().Get("devId"), r.URL.Query().Get("username"))
	if err != nil {
		return err
	}
	audits, err := s.store.ListAudits(r.Context(), dev.ID, auditHistorySize)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, audits)
	return nil
}

// GET /api/jobBoard/audit/{id} (owner, admin or service).
func (s *Server) getAudit(w http.ResponseWriter, r *http.Request) error {
	if !uuidPattern.MatchString(r.PathValue("id")) {
		return errNotFound("Audit not found")
	}
	audit, ownerID, err := s.store.GetAudit(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) || (err == nil && !s.canReadAudit(r, ownerID)) {
		return errNotFound("Audit not found")
	}
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, audit)
	return nil
}

func (s *Server) canReadAudit(r *http.Request, ownerID string) bool {
	if p := principalFrom(r.Context()); p != nil && p.Service {
		return true
	}
	dev := devFrom(r.Context())
	return dev != nil && (dev.ID == ownerID || model.HasPermission(dev.Role, model.PermManagePlatform))
}
