package api

import (
	"errors"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/security"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

const certificateValidity = 365 * 24 * time.Hour

var commitPattern = regexp.MustCompile(`^[0-9a-fA-F]{7,40}$`)

// GET /api/v1/submissions?username=&status=
func (s *Server) listSubmissions(w http.ResponseWriter, r *http.Request) error {
	q := r.URL.Query()
	f := store.SubmissionFilters{Username: q.Get("username"), Status: q.Get("status")}
	if f.Status != "" && !slices.Contains([]string{"pending", "verified", "rejected"}, f.Status) {
		v := validationErrors{}
		v.add("status", "Status must be pending, verified or rejected")
		return v.err()
	}
	subs, err := s.store.ListSubmissions(r.Context(), f)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, subs)
	return nil
}

func (s *Server) getSubmission(w http.ResponseWriter, r *http.Request) error {
	sub, err := s.store.GetSubmission(r.Context(), r.PathValue("hash"))
	if errors.Is(err, store.ErrNotFound) {
		return errNotFound("Submission not found")
	}
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, sub)
	return nil
}

// createSubmissionRequest accepts CreateSubmissionInput from the frontend
// plus commitHash / prNumber from the blueprint's submission contract.
// Author fields are accepted for compatibility but ignored: the author is
// always the authenticated caller.
type createSubmissionRequest struct {
	IdeaID            string `json:"ideaId"`
	RepoURL           string `json:"repoUrl"`
	DemoURL           string `json:"demoUrl"`
	CommitHash        string `json:"commitHash"`
	PRNumber          *int   `json:"prNumber"`
	ArchitectureNotes string `json:"architectureNotes"`

	IdeaTitle      string `json:"ideaTitle"`
	AuthorUsername string `json:"authorUsername"`
	AuthorName     string `json:"authorName"`
	AuthorAvatar   string `json:"authorAvatar"`
}

func (req *createSubmissionRequest) validate() error {
	v := validationErrors{}
	req.RepoURL = strings.TrimRight(strings.TrimSpace(req.RepoURL), "/")
	req.DemoURL = strings.TrimSpace(req.DemoURL)
	req.CommitHash = strings.ToLower(strings.TrimSpace(req.CommitHash))
	req.ArchitectureNotes = strings.TrimSpace(req.ArchitectureNotes)

	if req.IdeaID == "" {
		v.add("ideaId", "ideaId is required")
	}
	if u, err := url.Parse(req.RepoURL); err != nil || u.Scheme != "https" || u.Host == "" || strings.Count(strings.Trim(u.Path, "/"), "/") < 1 {
		v.add("repoUrl", "Repository must be an https URL like https://github.com/owner/repo")
	}
	if req.DemoURL != "" && !isHTTPURL(req.DemoURL) {
		v.add("demoUrl", "Demo URL must be a valid URL")
	}
	if req.CommitHash != "" && !commitPattern.MatchString(req.CommitHash) {
		v.add("commitHash", "Commit hash must be 7-40 hex characters")
	}
	if req.PRNumber != nil && *req.PRNumber <= 0 {
		v.add("prNumber", "PR number must be positive")
	}
	if n := runeLen(req.ArchitectureNotes); n < 10 || n > 5000 {
		v.add("architectureNotes", "Architecture notes must be 10-5000 characters")
	}
	return v.err()
}

// POST /api/v1/submissions records a solution as a pending ledger entry.
// It becomes a stamped proof once a reviewer verifies it.
func (s *Server) createSubmission(w http.ResponseWriter, r *http.Request) error {
	var req createSubmissionRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	if err := req.validate(); err != nil {
		return err
	}
	author := principalFrom(r.Context()).User

	dup, err := s.store.DuplicateSubmission(r.Context(), author.ID, req.IdeaID, req.CommitHash)
	if err != nil {
		return err
	}
	if dup {
		return errConflict("You have already submitted this commit for this idea")
	}

	hash, err := s.store.CreateSubmission(r.Context(), store.NewSubmission{
		IdeaID: req.IdeaID, AuthorID: author.ID, RepoURL: req.RepoURL, DemoURL: req.DemoURL,
		CommitSHA: req.CommitHash, PRNumber: req.PRNumber, ArchitectureNotes: req.ArchitectureNotes,
	})
	if errors.Is(err, store.ErrNotFound) {
		v := validationErrors{}
		v.add("ideaId", "Unknown idea")
		return v.err()
	}
	if err != nil {
		return err
	}
	sub, err := s.store.GetSubmission(r.Context(), hash)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusCreated, sub)
	return nil
}

// verifyRequest optionally carries harness telemetry. When the automated CI
// runner is live it will post these; a human reviewer may omit them.
type verifyRequest struct {
	TestResults *model.TestResults `json:"testResults"`
	Metrics     *model.Metrics     `json:"metrics"`
	Notes       string             `json:"notes"`
}

// loadForReview fetches a pending submission and enforces reviewer rules.
func (s *Server) loadForReview(r *http.Request) (*model.Submission, error) {
	sub, err := s.store.GetSubmission(r.Context(), r.PathValue("hash"))
	if errors.Is(err, store.ErrNotFound) {
		return nil, errNotFound("Submission not found")
	}
	if err != nil {
		return nil, err
	}
	reviewer := principalFrom(r.Context()).User
	if strings.EqualFold(sub.AuthorUsername, reviewer.Username) {
		return nil, errForbidden("Reviewers cannot review their own submissions")
	}
	if sub.Status != "pending" {
		return nil, errConflict("Submission has already been " + sub.Status)
	}
	return sub, nil
}

// POST /api/v1/submissions/{hash}/verify stamps a submission with a signed
// 365-day ledger certificate (reviewer/admin).
func (s *Server) verifySubmission(w http.ResponseWriter, r *http.Request) error {
	var req verifyRequest
	if err := decodeOptionalJSON(w, r, &req); err != nil {
		return err
	}
	sub, err := s.loadForReview(r)
	if err != nil {
		return err
	}

	tests := sub.TestResults
	if req.TestResults != nil {
		tests = *req.TestResults
	}
	v := validationErrors{}
	if tests.Total < 0 || tests.Passed < 0 || tests.Passed > tests.Total {
		v.add("testResults", "passed must be between 0 and total")
	} else if tests.Passed != tests.Total {
		v.add("testResults", "All harness tests must pass before a submission can be stamped")
	}
	if len(req.Notes) > 2000 {
		v.add("notes", "Notes must be under 2000 characters")
	}
	if err := v.err(); err != nil {
		return err
	}
	if tests.SuiteName == "" {
		tests.SuiteName = "Manual Reviewer Audit"
	}

	issued := time.Now().UTC().Truncate(time.Second)
	cert := &model.Certificate{IssuedAt: issued, ValidUntil: issued.Add(certificateValidity)}
	cert.Hash = security.SignCertificate(s.cfg.SessionSecret, certificateInput(sub, tests, cert))

	if err := s.store.RecordReview(r.Context(), store.ReviewDecision{
		Hash: sub.Hash, ReviewerID: principalFrom(r.Context()).User.ID, Status: "verified",
		Tests: &tests, Metrics: req.Metrics, Notes: req.Notes, Certificate: cert,
	}); err != nil {
		return err
	}
	return s.writeSubmission(w, r, sub.Hash)
}

type rejectRequest struct {
	Notes string `json:"notes"`
}

// POST /api/v1/submissions/{hash}/reject (reviewer/admin).
func (s *Server) rejectSubmission(w http.ResponseWriter, r *http.Request) error {
	var req rejectRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	req.Notes = strings.TrimSpace(req.Notes)
	if req.Notes == "" || len(req.Notes) > 2000 {
		v := validationErrors{}
		v.add("notes", "A rejection reason (up to 2000 characters) is required")
		return v.err()
	}
	sub, err := s.loadForReview(r)
	if err != nil {
		return err
	}
	if err := s.store.RecordReview(r.Context(), store.ReviewDecision{
		Hash: sub.Hash, ReviewerID: principalFrom(r.Context()).User.ID, Status: "rejected", Notes: req.Notes,
	}); err != nil {
		return err
	}
	return s.writeSubmission(w, r, sub.Hash)
}

func (s *Server) writeSubmission(w http.ResponseWriter, r *http.Request, hash string) error {
	sub, err := s.store.GetSubmission(r.Context(), hash)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, sub)
	return nil
}

func certificateInput(sub *model.Submission, tests model.TestResults, cert *model.Certificate) security.CertificateInput {
	return security.CertificateInput{
		SubmissionHash: sub.Hash, IdeaID: sub.IdeaID, AuthorUsername: sub.AuthorUsername, RepoURL: sub.RepoURL,
		CommitSHA: sub.CommitHash, TestsPassed: tests.Passed, TestsTotal: tests.Total,
		IssuedAt: cert.IssuedAt, ValidUntil: cert.ValidUntil,
	}
}

type certificateStatus struct {
	Valid       bool               `json:"valid"`
	Expired     bool               `json:"expired"`
	Reason      string             `json:"reason,omitempty"`
	Certificate *model.Certificate `json:"certificate,omitempty"`
	Submission  *model.Submission  `json:"submission"`
}

// GET /api/v1/submissions/{hash}/certificate lets anyone (e.g. a recruiter
// on /p/[slug]) confirm a stamp is authentic, untampered and unexpired.
func (s *Server) getCertificate(w http.ResponseWriter, r *http.Request) error {
	sub, err := s.store.GetSubmission(r.Context(), r.PathValue("hash"))
	if errors.Is(err, store.ErrNotFound) {
		return errNotFound("Submission not found")
	}
	if err != nil {
		return err
	}
	res := certificateStatus{Submission: sub, Certificate: sub.Certificate}
	switch {
	case sub.Status != "verified" || sub.Certificate == nil:
		res.Reason = "Submission has not been stamped"
	case !security.VerifyCertificate(s.cfg.SessionSecret, certificateInput(sub, sub.TestResults, sub.Certificate), sub.Certificate.Hash):
		res.Reason = "Certificate signature does not match the recorded submission"
	case time.Now().After(sub.Certificate.ValidUntil):
		res.Expired = true
		res.Reason = "Certificate has expired"
	default:
		res.Valid = true
	}
	writeJSON(w, http.StatusOK, res)
	return nil
}
