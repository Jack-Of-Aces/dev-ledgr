package ai

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

func TestHeuristicGapDecision(t *testing.T) {
	user := model.UserProfile{Username: "dev", Name: "Dev", StatedSkills: []string{"Go"}}
	solved := []model.Submission{{Hash: "abc1234", IdeaID: "webhook-deduplicator", IdeaTitle: "Webhooks"}}

	cases := []struct {
		name  string
		job   model.Job
		subs  []model.Submission
		force bool
		want  string
	}{
		{"gap solved", model.Job{MatchScore: 50, GapIdeaID: "webhook-deduplicator"}, solved, false, "ready"},
		{"unsolved but high match", model.Job{MatchScore: 90, GapIdeaID: "other"}, solved, false, "ready"},
		{"unsolved low match", model.Job{MatchScore: 60, GapIdeaID: "other"}, solved, false, "gap"},
		{"forced gap", model.Job{MatchScore: 99}, solved, true, "gap"},
	}
	e := &Engine{}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var logs []string
			res := e.Scrutiny(context.Background(), ScrutinyInput{Job: c.job, User: user, Submissions: c.subs, ForceGap: c.force},
				"", func(s string) { logs = append(logs, s) })
			if res.Status != c.want {
				t.Fatalf("status = %s, want %s", res.Status, c.want)
			}
			if len(logs) != len(res.ScanLogs) || res.Engine != "heuristic" {
				t.Fatalf("streamed %d logs, result has %d (engine %s)", len(logs), len(res.ScanLogs), res.Engine)
			}
			if !strings.Contains(res.CVMarkdown, "abc1234") {
				t.Fatal("CV does not cite the verified commit")
			}
		})
	}
}

func TestGatewayFailureFallsBack(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "down", http.StatusBadGateway)
	}))
	defer srv.Close()

	e := &Engine{GatewayURL: srv.URL}
	res := e.Scrutiny(context.Background(), ScrutinyInput{User: model.UserProfile{Username: "dev"}}, "", nil)
	if res.Engine != "heuristic" {
		t.Fatalf("engine = %s, want heuristic fallback", res.Engine)
	}
	if advice, engine := e.Coach(context.Background(), CoachInput{Prompt: "p"}, ""); engine != "heuristic" || advice == "" {
		t.Fatalf("coach fallback = %q, %s", advice, engine)
	}
}

func TestGatewayReceivesProviderKey(t *testing.T) {
	var gotKey string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotKey = r.Header.Get("X-Provider-Key")
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"advice":"from gateway"}`))
	}))
	defer srv.Close()

	advice, engine := (&Engine{GatewayURL: srv.URL}).Coach(context.Background(), CoachInput{Prompt: "p"}, "sk-byok")
	if advice != "from gateway" || engine != "gateway" || gotKey != "sk-byok" {
		t.Fatalf("got %q/%s key=%q", advice, engine, gotKey)
	}
}
