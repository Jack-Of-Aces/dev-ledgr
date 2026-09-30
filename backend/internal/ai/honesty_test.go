package ai

import (
	"strings"
	"testing"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

// The heuristic engine is the fallback that runs when no model gateway is
// configured, and its output is what a recruiter reads. These tests pin two
// properties that were both wrong:
//
//   - It published portfolio URLs on devledgr.io, a domain the product does not
//     use; every frontend surface uses devledgr.xyz. A CV advertising a URL
//     that does not resolve is a dead link on the one document meant to get the
//     dev an interview.
//   - An unmeasured performance figure was replaced with a confident-sounding
//     default. Worst case, buildCoverLetter substituted the literal string
//     "verified" for a missing p99, so an entry with no measurement produced
//     "achieving verified p99 latency under simulated production load".

func submission(hash string, m *model.Metrics) model.Submission {
	return model.Submission{
		IdeaID:            "lpg",
		IdeaTitle:         "Log-Structured Merge Planner",
		Hash:              hash,
		RepoURL:           "https://github.com/mj/lpg",
		Metrics:           m,
		ArchitectureNotes: "Rewrites the merge order to keep per-tenant state contiguous.",
		TestResults:       model.TestResults{Passed: 0, Total: 0},
	}
}

func TestGeneratedDocumentsUseTheRealDomain(t *testing.T) {
	t.Parallel()

	u := model.UserProfile{Username: "mj", Name: "Michael Ojekunle", Headline: "Backend Engineer"}
	job := model.Job{Company: "Kuda", Title: "Backend Engineer"}

	for _, tc := range []struct {
		name string
		doc  string
	}{
		{"cv", buildCV(u, []model.Submission{submission("abc123", nil)})},
		{"cover letter", buildCoverLetter(job, u, []model.Submission{submission("abc123", nil)})},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if strings.Contains(tc.doc, "devledgr.io") {
				t.Errorf("%s links a domain the product does not use:\n%s", tc.name, tc.doc)
			}
			if !strings.Contains(tc.doc, "mj.devledgr.xyz") {
				t.Errorf("%s is missing the portfolio URL:\n%s", tc.name, tc.doc)
			}
		})
	}
}

func TestUnmeasuredPerformanceIsNotStatedAsAFigure(t *testing.T) {
	t.Parallel()

	u := model.UserProfile{Username: "mj", Name: "Michael Ojekunle", Headline: "Backend Engineer"}
	job := model.Job{Company: "Kuda", Title: "Backend Engineer"}
	// Metrics present but empty: this is the shape a freshly submitted
	// submission has, and the one that previously produced "n/a" and "verified".
	empty := &model.Metrics{}

	for _, tc := range []struct {
		name   string
		doc    string
		absent []string
	}{
		{
			// Previously: "Sustained p99 latency of n/a at n/a."
			name:   "cv",
			doc:    buildCV(u, []model.Submission{submission("abc123", empty)}),
			absent: []string{"n/a", "Sustained p99 latency of"},
		},
		{
			name:   "cv with no metrics at all",
			doc:    buildCV(u, []model.Submission{submission("abc123", nil)}),
			absent: []string{"n/a", "Sustained p99 latency of"},
		},
		{
			// Previously: "achieving verified p99 latency under simulated
			// production load."
			name:   "cover letter",
			doc:    buildCoverLetter(job, u, []model.Submission{submission("abc123", empty)}),
			absent: []string{"achieving verified", "p99 latency under simulated"},
		},
		{
			name:   "cover letter with no metrics at all",
			doc:    buildCoverLetter(job, u, []model.Submission{submission("abc123", nil)}),
			absent: []string{"achieving verified", "p99 latency under simulated"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			for _, phrase := range tc.absent {
				if strings.Contains(tc.doc, phrase) {
					t.Errorf("%s states performance that was never measured (found %q):\n%s",
						tc.name, phrase, tc.doc)
				}
			}
		})
	}
}

func TestMeasuredPerformanceIsStillReported(t *testing.T) {
	t.Parallel()

	// The fix must not silence real results: a reviewer-measured p99 and
	// throughput still belong in the document.
	u := model.UserProfile{Username: "mj", Name: "Michael Ojekunle", Headline: "Backend Engineer"}
	job := model.Job{Company: "Kuda", Title: "Backend Engineer"}
	measured := &model.Metrics{LatencyP99: "18ms", Throughput: "240 req/s"}

	cv := buildCV(u, []model.Submission{submission("abc123", measured)})
	for _, want := range []string{"18ms", "240 req/s"} {
		if !strings.Contains(cv, want) {
			t.Errorf("CV dropped the measured figure %q:\n%s", want, cv)
		}
	}

	letter := buildCoverLetter(job, u, []model.Submission{submission("abc123", measured)})
	if !strings.Contains(letter, "18ms") {
		t.Errorf("cover letter dropped the measured p99:\n%s", letter)
	}
}

func TestRecordedMetricReportsPresence(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name    string
		metrics *model.Metrics
		wantOK  bool
		wantVal string
	}{
		{name: "nil metrics", metrics: nil, wantOK: false},
		{name: "empty string", metrics: &model.Metrics{}, wantOK: false},
		{name: "whitespace only", metrics: &model.Metrics{LatencyP99: "   "}, wantOK: false},
		{name: "recorded", metrics: &model.Metrics{LatencyP99: "18ms"}, wantOK: true, wantVal: "18ms"},
		{name: "recorded with padding", metrics: &model.Metrics{LatencyP99: " 18ms "}, wantOK: true, wantVal: "18ms"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, ok := recordedMetric(tc.metrics, p99)
			if ok != tc.wantOK {
				t.Fatalf("recordedMetric() ok = %v, want %v (value %q)", ok, tc.wantOK, got)
			}
			if ok && got != tc.wantVal {
				t.Errorf("recordedMetric() = %q, want %q", got, tc.wantVal)
			}
		})
	}
}
