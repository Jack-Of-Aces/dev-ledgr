package api

import (
	"errors"
	"strings"
	"testing"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

// fieldMessage pulls a field's message out of a validation error. apiError.Error
// only reports "Validation failed"; the detail the user actually sees is in the
// Errors map.
func fieldMessage(t *testing.T, err error, field string) string {
	t.Helper()
	var ae *apiError
	if !errors.As(err, &ae) {
		t.Fatalf("error %v is not an apiError", err)
	}
	msgs, ok := ae.Errors[field]
	if !ok {
		t.Fatalf("error has no %q field; got %v", field, ae.Errors)
	}
	return strings.Join(msgs, "; ")
}

// TestSubmissionVisibility pins who may enumerate which ledger entries.
//
// The regression this guards: GET /api/v1/submissions had no ownership check
// and no LIMIT, so a single anonymous call returned every submission on the
// platform — including every other dev's pending, unverified work — in one
// response. Pending entries are a dev's in-flight work; publishing them to
// anyone is both a privacy leak and a way to see what a competitor is building.
func TestSubmissionVisibility(t *testing.T) {
	t.Parallel()

	alice := &model.UserProfile{Username: "alice"}

	for _, tc := range []struct {
		name     string
		viewer   *model.UserProfile
		username string
		status   string
		wantErr  string
	}{
		{
			name:   "a recruiter may read the public verified ledger",
			viewer: nil, status: "verified",
		},
		{
			name:   "a recruiter may read one dev's verified work",
			viewer: nil, username: "bob", status: "verified",
		},
		{
			name:   "a dev may read their own pending work",
			viewer: alice, username: "alice", status: "pending",
		},
		{
			name:   "a dev may read their own rejected work",
			viewer: alice, status: "rejected",
		},
		{
			name:   "a dev may read their own work with no status filter",
			viewer: alice,
		},
		{
			name:   "username matching is case-insensitive, as everywhere else",
			viewer: alice, username: "ALICE", status: "pending",
		},
		{
			// The one that matters most: no filter must not become a bypass
			// for the private statuses.
			name:    "an anonymous caller cannot enumerate everything",
			viewer:  nil,
			wantErr: "Verified entries are public",
		},
		{
			name:   "an anonymous caller cannot list pending work",
			viewer: nil, status: "pending",
			wantErr: "You can only list your own pending submissions",
		},
		{
			name:   "a dev cannot read a rival's pending work",
			viewer: alice, username: "bob", status: "pending",
			wantErr: "You can only list your own pending submissions",
		},
		{
			// Allowed, and the handler must then scope the query to the
			// viewer rather than leaving the username filter empty.
			name:   "a signed-in dev with no filter is reading their own work",
			viewer: alice,
		},
		{
			name:   "an unknown status is a validation error, not a silent empty list",
			viewer: nil, status: "forged",
			wantErr: "Status must be pending, verified or rejected",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			err := submissionVisibility(tc.viewer, tc.username, tc.status)
			if tc.wantErr == "" {
				if err != nil {
					t.Fatalf("submissionVisibility(%v, %q, %q) = %v, want it allowed", tc.viewer, tc.username, tc.status, err)
				}
				return
			}
			if err == nil {
				t.Fatalf("submissionVisibility(%v, %q, %q) was allowed, want it refused with %q", tc.viewer, tc.username, tc.status, tc.wantErr)
			}
			if got := fieldMessage(t, err, "status"); !strings.Contains(got, tc.wantErr) {
				t.Fatalf("message %q does not mention %q", got, tc.wantErr)
			}
		})
	}
}

// TestSubmissionQueryScoping pins the filters the store actually receives.
//
// submissionVisibility alone is not enough to keep the test honest: the
// authorisation decision and the query it implies have to be one step. The
// store reads an empty username as "no filter", so a handler that checked
// ownership and then queried on the username as sent would hand a signed-in
// dev every dev's pending entries the moment they omitted the parameter. That
// is the bug this table exists to catch.
func TestSubmissionQueryScoping(t *testing.T) {
	t.Parallel()

	alice := &model.UserProfile{Username: "alice"}

	for _, tc := range []struct {
		name       string
		viewer     *model.UserProfile
		username   string
		status     string
		wantUser   string
		wantStatus string
		wantErr    bool
	}{
		{
			name:     "a signed-in dev with no username is pinned to their own entries",
			viewer:   alice,
			wantUser: "alice",
		},
		{
			name:   "a signed-in dev asking for pending work is pinned to their own entries",
			viewer: alice, status: "pending",
			wantUser: "alice", wantStatus: "pending",
		},
		{
			name:   "the viewer's own username is preserved",
			viewer: alice, username: "ALICE", status: "rejected",
			wantUser: "ALICE", wantStatus: "rejected",
		},
		{
			name:   "an anonymous caller reads the whole public verified ledger",
			viewer: nil, status: "verified",
			wantUser: "", wantStatus: "verified",
		},
		{
			name:   "an anonymous caller may read one dev's verified work",
			viewer: nil, username: "bob", status: "verified",
			wantUser: "bob", wantStatus: "verified",
		},
		{
			name:   "the limit is always bounded",
			viewer: nil, status: "verified",
			wantUser: "", wantStatus: "verified",
		},
		{
			name:   "a rival's pending work is refused outright",
			viewer: alice, username: "bob", status: "pending",
			wantErr: true,
		},
		{
			name:    "an anonymous unfiltered sweep is refused outright",
			viewer:  nil,
			wantErr: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			f, err := submissionQuery(tc.viewer, tc.username, tc.status)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("submissionQuery(%v, %q, %q) was allowed and would query username %q — a caller was handed work they do not own",
						tc.viewer, tc.username, tc.status, f.Username)
				}
				return
			}
			if err != nil {
				t.Fatalf("submissionQuery(%v, %q, %q) = %v, want it allowed", tc.viewer, tc.username, tc.status, err)
			}
			if f.Username != tc.wantUser {
				t.Fatalf("query username = %q, want %q", f.Username, tc.wantUser)
			}
			if f.Status != tc.wantStatus {
				t.Fatalf("query status = %q, want %q", f.Status, tc.wantStatus)
			}
			if f.Limit <= 0 || f.Limit > store.MaxSubmissionLimit {
				t.Fatalf("query limit = %d, want 1-%d — the endpoint must never be unbounded", f.Limit, store.MaxSubmissionLimit)
			}
		})
	}
}

// TestCreateSubmissionRequiresCommitHash pins that a commit is mandatory.
//
// The commit is what identifies the work and is the de-duplication key. When it
// was optional a submission could be registered with no commit at all:
// submissions_dedup_key excludes NULL commit_sha, so the row escaped the index
// entirely and the same repo could be re-registered under a fresh ledger hash
// any number of times, each drawing its own signed certificate.
func TestCreateSubmissionRequiresCommitHash(t *testing.T) {
	t.Parallel()

	base := func() *createSubmissionRequest {
		return &createSubmissionRequest{
			IdeaID:            "1e4c1a4e-0000-4000-8000-000000000001",
			RepoURL:           "https://github.com/alice/thing",
			ArchitectureNotes: "a sufficiently long architecture note",
			CommitHash:        "abc1234",
		}
	}

	t.Run("a valid submission with a commit is accepted", func(t *testing.T) {
		t.Parallel()
		if err := base().validate(); err != nil {
			t.Fatalf("validate() = %v, want it accepted", err)
		}
	})

	t.Run("omitting the commit is refused", func(t *testing.T) {
		t.Parallel()
		req := base()
		req.CommitHash = ""
		err := req.validate()
		if err == nil {
			t.Fatal("validate() accepted a submission with no commit hash")
		}
		if got := fieldMessage(t, err, "commitHash"); !strings.Contains(got, "required") {
			t.Fatalf("message %q does not explain that the commit is required", got)
		}
	})

	t.Run("a malformed commit is still refused", func(t *testing.T) {
		t.Parallel()
		req := base()
		req.CommitHash = "not-a-hash"
		err := req.validate()
		if err == nil {
			t.Fatal("validate() accepted a malformed commit hash")
		}
		if got := fieldMessage(t, err, "commitHash"); !strings.Contains(got, "7-40 hex characters") {
			t.Fatalf("message %q does not mention the expected format", got)
		}
	})

	t.Run("the commit is normalised before it is used as a key", func(t *testing.T) {
		t.Parallel()
		req := base()
		req.CommitHash = "  ABC1234def  "
		if err := req.validate(); err != nil {
			t.Fatalf("validate() = %v, want it accepted", err)
		}
		if req.CommitHash != "abc1234def" {
			t.Fatalf("commit normalised to %q, want %q — the dedup key must be case-insensitive in practice", req.CommitHash, "abc1234def")
		}
	})
}
