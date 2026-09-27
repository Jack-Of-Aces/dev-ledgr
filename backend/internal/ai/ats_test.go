package ai

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

const goodCV = `Ada Obi
ada@example.com | +234 801 234 5678 | github.com/adaobi

Experience
Backend Engineer, Paylink (2024 - present)
- Built an idempotent webhook ingester in Golang handling 4,800 req/s at 18ms p99.
- Cut duplicate credits by 100% using Redis-backed idempotency keys.
- Reduced PostgreSQL lock contention, lowering checkout latency by 35%.
- Migrated 12 services to Docker, saving 20 hours of deploy time per month.
- Mentored 3 interns on testing; raised coverage to 92%.

Projects
Route optimizer for LPG delivery: Go service clustering 500 orders per batch.

Skills
Go, PostgreSQL, Redis, Docker, TypeScript

Education
B.Sc. Computer Science, University of Lagos
` + "Additional detail about distributed systems, consistency, retries and observability. "

func TestHeuristicATSRewardsAStrongCV(t *testing.T) {
	job := &model.Job{Tags: []string{"Go", "Redis", "Kubernetes"}}
	good := heuristicATS(ATSInput{CVText: strings.Repeat(goodCV, 3), Job: job})
	weak := heuristicATS(ATSInput{CVText: "I like computers and want a job. Please hire me.", Job: job})

	if good.Score <= weak.Score || good.Score < 70 || weak.Score > 30 {
		t.Fatalf("scores: good=%d weak=%d", good.Score, weak.Score)
	}
	if strings.Join(good.MissingKeywords, ",") != "Kubernetes" || len(good.MatchedKeywords) != 2 {
		t.Fatalf("keywords: matched=%v missing=%v (Golang should satisfy Go)", good.MatchedKeywords, good.MissingKeywords)
	}
	if len(weak.Recommendations) == 0 || weak.Recommendations[0].Priority != "high" {
		t.Fatalf("weak CV should get high-priority recommendations first: %+v", weak.Recommendations)
	}
	if good.Engine != "heuristic" {
		t.Fatalf("engine = %s", good.Engine)
	}
}

// fakeClaude serves canned Messages API responses and records the request.
func fakeClaude(t *testing.T, status int, body string) (*Engine, *map[string]any, *http.Header) {
	t.Helper()
	var got map[string]any
	var hdr http.Header
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		json.Unmarshal(raw, &got)
		hdr = r.Header.Clone()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	c := anthropic.NewClient(option.WithAPIKey("test"), option.WithBaseURL(srv.URL), option.WithMaxRetries(0))
	return &Engine{Claude: &c, Model: "claude-opus-5"}, &got, &hdr
}

func messageJSON(stopReason, text string) string {
	b, _ := json.Marshal(map[string]any{
		"id": "msg_1", "type": "message", "role": "assistant", "model": "claude-opus-5",
		"stop_reason": stopReason, "content": []map[string]any{{"type": "text", "text": text}},
		"usage": map[string]any{"input_tokens": 10, "output_tokens": 10},
	})
	return string(b)
}

func TestClaudeATSRequestAndParsing(t *testing.T) {
	out := `{"score":140,"summary":"Solid.","breakdown":[{"category":"keywords","score":-5,"notes":"n"}],
		"recommendations":[{"category":"achievements","priority":"high","issue":"i","suggestion":"s"}],
		"matchedKeywords":["Go"],"missingKeywords":["Kubernetes"]}`
	e, req, hdr := fakeClaude(t, 200, messageJSON("end_turn", out))

	job := &model.Job{Title: "Backend Engineer", Company: "Acme", Tags: []string{"Go", "Kubernetes"}}
	audit, err := e.ATSAudit(context.Background(), ATSInput{CVText: goodCV, Job: job})
	if err != nil {
		t.Fatal(err)
	}
	if audit.Score != 100 || audit.Breakdown[0].Score != 0 {
		t.Fatalf("scores not clamped: %d / %d", audit.Score, audit.Breakdown[0].Score)
	}
	if audit.Engine != "claude" || audit.Model != "claude-opus-5" || audit.MissingKeywords[0] != "Kubernetes" {
		t.Fatalf("audit = %+v", audit)
	}

	r := *req
	if r["model"] != "claude-opus-5" || r["fallbacks"] != "default" {
		t.Fatalf("model/fallbacks = %v / %v", r["model"], r["fallbacks"])
	}
	format := r["output_config"].(map[string]any)["format"].(map[string]any)
	if format["type"] != "json_schema" || format["schema"].(map[string]any)["additionalProperties"] != false {
		t.Fatalf("output_config.format = %v", format)
	}
	if !strings.Contains((*hdr).Get("anthropic-beta"), "server-side-fallback-2026-07-01") {
		t.Fatalf("beta header = %q", (*hdr).Get("anthropic-beta"))
	}
	userText := r["messages"].([]any)[0].(map[string]any)["content"].([]any)[0].(map[string]any)["text"].(string)
	if !strings.Contains(userText, "<job_description>") || !strings.Contains(userText, "Paylink") {
		t.Fatal("prompt is missing the job description or CV")
	}
}

func TestClaudeATSFailuresAreReported(t *testing.T) {
	e, _, _ := fakeClaude(t, 200, messageJSON("refusal", ""))
	if _, err := e.ATSAudit(context.Background(), ATSInput{CVText: goodCV}); !errors.Is(err, ErrAIRefused) {
		t.Fatalf("refusal: %v", err)
	}
	e, _, _ = fakeClaude(t, 529, `{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}`)
	if _, err := e.ATSAudit(context.Background(), ATSInput{CVText: goodCV}); !errors.Is(err, ErrAIUnavailable) {
		t.Fatalf("overloaded: %v", err)
	}
	e, _, _ = fakeClaude(t, 200, messageJSON("end_turn", "not json"))
	if _, err := e.ATSAudit(context.Background(), ATSInput{CVText: goodCV}); !errors.Is(err, ErrAIUnavailable) {
		t.Fatalf("bad json: %v", err)
	}
}
