package api

import (
	"strings"
	"testing"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

// TestTestResultsError pins the gate that decides whether a reviewer may mint a
// 365-day certificate.
//
// The regression this guards: the check used to be `passed != total`, which
// zero satisfies vacuously. Every new submission is created with
// {"passed":0,"total":0}, and the admin console posted no body at all, so the
// default path stamped certificates recording 0/0 — a certificate claiming a
// successful run of no tests, indistinguishable on the wire from a real pass.
func TestTestResultsError(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name    string
		results model.TestResults
		wantErr string
	}{
		{
			name:    "the vacuous 0/0 pass is now refused",
			results: model.TestResults{Passed: 0, Total: 0},
			wantErr: "a certificate cannot be minted without recorded test results: total must be greater than zero",
		},
		{
			name:    "an explicit suite that ran nothing is still refused",
			results: model.TestResults{Passed: 0, Total: 0, SuiteName: "Manual Reviewer Audit"},
			wantErr: "a certificate cannot be minted without recorded test results: total must be greater than zero",
		},
		{
			name:    "a real pass is accepted",
			results: model.TestResults{Passed: 20, Total: 20, SuiteName: "Manual Reviewer Audit"},
		},
		{
			name:    "a single passing test is accepted",
			results: model.TestResults{Passed: 1, Total: 1},
		},
		{
			name:    "a real failure is refused",
			results: model.TestResults{Passed: 19, Total: 20},
			wantErr: "all tests must pass before a submission can be stamped",
		},
		{
			name:    "a suite that passed nothing is refused for that, not for the total",
			results: model.TestResults{Passed: 0, Total: 5},
			wantErr: "all tests must pass before a submission can be stamped",
		},
		{
			name:    "more passes than tests is refused",
			results: model.TestResults{Passed: 21, Total: 20},
			wantErr: "passed must not exceed total",
		},
		{
			name:    "negative counts are refused",
			results: model.TestResults{Passed: -1, Total: 5},
			wantErr: "passed and total must be zero or greater",
		},
		{
			name:    "a negative total is refused",
			results: model.TestResults{Passed: 0, Total: -1},
			wantErr: "passed and total must be zero or greater",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := testResultsError(tc.results)
			if tc.wantErr == "" {
				if got != "" {
					t.Fatalf("testResultsError(%+v) = %q, want it accepted", tc.results, got)
				}
				return
			}
			if !strings.Contains(got, tc.wantErr) {
				t.Fatalf("testResultsError(%+v) = %q, want it to mention %q", tc.results, got, tc.wantErr)
			}
		})
	}
}
