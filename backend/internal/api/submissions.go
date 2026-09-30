package api

import (
	"errors"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/security"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

const certificateValidity = 365 * 24 * time.Hour

var commitPattern = regexp.MustCompile(`^[0-9a-fA-F]{7,40}$`)

// GET /api/v1/submissions?username=&status=&limit=&offset=
//
// Verified entries are public — a portfolio has to be readable by a recruiter —
// but pending and rejected entries are a dev's unvetted work in progress, so
// only the author may list those. Before this split, one anonymous call
// returned every submission on the platform including everyone's pending ones,
// because the query had neither an ownership check nor a LIMIT.
func (s *Server) listSubmissions(w http.ResponseWriter, r *http.Request) error {
	q := r.URL.Query()
	f, err := submissionQuery(devFrom(r.Context()), q.Get("username"), q.Get("status"))
	if err != nil {
		return err
	}
	if l := q.Get("limit"); l != "" {
		n, err := strconv.Atoi(l)
		if err != nil || n < 1 || n > store.MaxSubmissionLimit {
			return errBadRequest("limit must be 1-" + strconv.Itoa(store.MaxSubmissionLimit))
		}
		f.Limit = n
	}
	if o := q.Get("offset"); o != "" {
		n, err := strconv.Atoi(o)
		if err != nil || n < 0 {
			return errBadRequest("offset must be zero or greater")
		}
		f.Offset = n
	}
	subs, err := s.store.ListSubmissions(r.Context(), f)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, subs)
	return nil
}

// submissionQuery turns the request's username/status into the filters the
// store will run, refusing the combinations a caller is not entitled to.
//
// It returns the filters rather than only an error because the authorisation
// decision and the scoping it implies have to be the same step. Checking
// ownership and then querying on whatever username was sent leaves a hole: the
// store reads an empty username as "no filter", so a signed-in dev who omitted
// it would be handed every dev's entries in every status rather than their own.
func submissionQuery(viewer *model.UserProfile, username, status string) (store.SubmissionFilters, error) {
	f := store.SubmissionFilters{Username: username, Status: status, Limit: store.DefaultSubmissionLimit}
	if err := submissionVisibility(viewer, username, status); err != nil {
		return f, err
	}
	// Anything not explicitly requested for someone else is the viewer's own
	// work, so pin the filter to them. An anonymous caller reading the public
	// verified ledger is left unfiltered on purpose.
	if f.Username == "" && viewer != nil {
		f.Username = viewer.Username
	}
	return f, nil
}

// submissionVisibility decides who may list which status. viewer is nil for an
// anonymous caller.
//
// Anything not explicitly verified is private. "No status filter" is therefore
// not a way around the rule — an anonymous caller asking for everything is
// refused rather than quietly served the public subset, because a filtered
// result set that looks complete is worse than a clear error.
func submissionVisibility(viewer *model.UserProfile, username, status string) error {
	if status != "" && !slices.Contains([]string{"pending", "verified", "rejected"}, status) {
		v := validationErrors{}
		v.add("status", "Status must be pending, verified or rejected")
		return v.err()
	}
	if status == "verified" {
		return nil
	}
	// A signed-in dev may list their own work, with or without a status filter.
	if viewer != nil && (username == "" || strings.EqualFold(username, viewer.Username)) {
		return nil
	}
	v := validationErrors{}
	if status == "" {
		v.add("status", "Verified entries are public; sign in as a dev to list pending or rejected work")
	} else {
		v.add("status", "You can only list your own "+status+" submissions")
	}
	return v.err()
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
	// Required, not optional. The commit is what identifies the work and is
	// the de-duplication key; without it the same repo could be registered
	// under a fresh ledger hash any number of times, each drawing its own
	// signed certificate. submissions_dedup_key excludes NULL commit_sha, so
	// an entry without one escapes the index entirely.
	if req.CommitHash == "" {
		v.add("commitHash", "Commit hash is required — it identifies the work and prevents duplicate entries")
	} else if !commitPattern.MatchString(req.CommitHash) {
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
	author := devFrom(r.Context())

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
	switch {
	case errors.Is(err, store.ErrNotFound):
		v := validationErrors{}
		v.add("ideaId", "Unknown idea")
		return v.err()
	// The check above is advisory; the dedup index is the guarantee. Losing the
	// race means saying the same thing the pre-check would have.
	case errors.Is(err, store.ErrDuplicateSubmission):
		return errConflict("You have already submitted this commit for this idea")
	case errors.Is(err, store.ErrCommitRequired):
		v := validationErrors{}
		v.add("commitHash", "Commit hash is required")
		return v.err()
	case err != nil:
		return err
	}
	sub, err := s.store.GetSubmission(r.Context(), hash)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusCreated, sub)
	return nil
}

// verifyRequest carries the test results the reviewer is attesting to, plus
// optional measured metrics. The automated runner will populate this from a
// real replay; until that exists a reviewer supplies the counts they verified
// by hand, and testResults is required either way (see testResultsError).
type verifyRequest struct {
	TestResults *model.TestResults `json:"testResults"`
	Metrics     *model.Metrics     `json:"metrics"`
	Notes       string             `json:"notes"`
}

// testResultsError validates the counts a reviewer is about to certify.
// It reports an error string, or "" when the results may be signed.
//
// A total of zero is refused. The gate used to read "all tests passed" as
// passed == total, which zero satisfies vacuously, so the default for a fresh
// submission ({"passed":0,"total":0}) minted a certificate recording a
// successful run of nothing. A certificate asserting 0/0 is indistinguishable
// from a certificate asserting a real pass, so it is refused outright: if no
// tests were run, there is nothing to certify.
func testResultsError(t model.TestResults) string {
	if t.Passed < 0 || t.Total < 0 {
		return "passed and total must be zero or greater"
	}
	if t.Passed > t.Total {
		return "passed must not exceed total"
	}
	if t.Total == 0 {
		return "a certificate cannot be minted without recorded test results: total must be greater than zero"
	}
	if t.Passed != t.Total {
		return "all tests must pass before a submission can be stamped"
	}
	return ""
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
	reviewer := devFrom(r.Context())
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

	// A reviewer must state the results they verified. Omitting testResults
	// falls back to whatever the submission was created with, which is always
	// 0/0 and now fails validation rather than passing silently.
	tests := sub.TestResults
	if req.TestResults != nil {
		tests = *req.TestResults
	}
	v := validationErrors{}
	if msg := testResultsError(tests); msg != "" {
		v.add("testResults", msg)
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
	cert.Hash = security.SignCertificate(s.cfg.SigningSecret, certificateInput(sub, tests, cert))

	if err := s.store.RecordReview(r.Context(), store.ReviewDecision{
		Hash: sub.Hash, ReviewerID: devFrom(r.Context()).ID, Status: "verified",
		Tests: &tests, Metrics: req.Metrics, Notes: req.Notes, Certificate: cert,
	}); err != nil {
		return reviewConflict(err)
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
		Hash: sub.Hash, ReviewerID: devFrom(r.Context()).ID, Status: "rejected", Notes: req.Notes,
	}); err != nil {
		return reviewConflict(err)
	}
	return s.writeSubmission(w, r, sub.Hash)
}

// reviewConflict translates the store's compare-and-set failure into a 409.
// loadForReview already rejects a non-pending entry, but that check and the
// write are separate round trips, so a second reviewer arriving in between is
// reported here rather than being told their decision was recorded.
func reviewConflict(err error) error {
	if errors.Is(err, store.ErrAlreadyReviewed) {
		return errConflict("Another reviewer already decided this submission; reload to see the current state")
	}
	return err
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
	case !security.VerifyCertificate(s.cfg.SigningSecret, certificateInput(sub, sub.TestResults, sub.Certificate), sub.Certificate.Hash):
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
