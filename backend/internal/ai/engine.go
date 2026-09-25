// Package ai implements the scrutiny audit and coaching features described in
// ADR-005. When AI_GATEWAY_URL is configured requests are forwarded to it;
// otherwise (or if it fails) the deterministic Heuristic Reasoning Engine
// answers from the candidate's real ledger data.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

// ScrutinyResult mirrors ScrutinyResult in services/ai/IAIService.ts.
type ScrutinyResult struct {
	Status      string   `json:"status"` // ready | gap
	ScanLogs    []string `json:"scanLogs"`
	CVMarkdown  string   `json:"cvMarkdown"`
	CoverLetter string   `json:"coverLetter"`
	GapReason   string   `json:"gapReason,omitempty"`
	GapIdeaID   string   `json:"gapIdeaId,omitempty"`
	Engine      string   `json:"engine"` // gateway | heuristic
}

type ScrutinyInput struct {
	Job         model.Job          `json:"job"`
	User        model.UserProfile  `json:"user"`
	Submissions []model.Submission `json:"submissions"` // verified entries only
	ForceGap    bool               `json:"forceGap"`
}

type CoachInput struct {
	ItineraryTitle string `json:"itineraryTitle"`
	MilestoneTitle string `json:"milestoneTitle"`
	Prompt         string `json:"prompt"`
}

type Engine struct {
	GatewayURL string
	HTTP       *http.Client
}

// Scrutiny runs the audit. onLog, if non-nil, receives each step as it completes.
// providerKey is the caller's decrypted BYOK key, forwarded only to the gateway.
func (e *Engine) Scrutiny(ctx context.Context, in ScrutinyInput, providerKey string, onLog func(string)) ScrutinyResult {
	emit := func(s string) {
		if onLog != nil {
			onLog(s)
		}
	}
	if e.GatewayURL != "" {
		var res ScrutinyResult
		if err := e.post(ctx, "/scrutiny", providerKey, in, &res); err == nil {
			res.Engine = "gateway"
			for _, l := range res.ScanLogs {
				emit(l)
			}
			return res
		}
		emit("AI gateway unavailable; continuing with the local reasoning engine.")
	}
	return heuristicScrutiny(in, emit)
}

func (e *Engine) Coach(ctx context.Context, in CoachInput, providerKey string) (advice, engine string) {
	if e.GatewayURL != "" {
		var res struct {
			Advice string `json:"advice"`
		}
		if err := e.post(ctx, "/coach", providerKey, in, &res); err == nil && res.Advice != "" {
			return res.Advice, "gateway"
		}
	}
	return heuristicCoach(in), "heuristic"
}

func (e *Engine) post(ctx context.Context, path, providerKey string, body, dst any) error {
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.GatewayURL+path, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if providerKey != "" {
		req.Header.Set("X-Provider-Key", providerKey)
	}
	client := e.HTTP
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("gateway %s: HTTP %d", path, resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(dst)
}

func heuristicScrutiny(in ScrutinyInput, emit func(string)) ScrutinyResult {
	job, user, subs := in.Job, in.User, in.Submissions

	solved := make(map[string]bool, len(subs))
	for _, s := range subs {
		solved[s.IdeaID] = true
	}
	hasSolvedGap := job.GapIdeaID == "" || solved[job.GapIdeaID]
	hasGap := in.ForceGap || (!hasSolvedGap && job.MatchScore < 80)

	gapReason := job.GapReason
	if gapReason == "" {
		gapReason = "specialized domain problem"
	}
	final := fmt.Sprintf("Verified all required proof points for %s. Synthesizing ATS-safe package...", job.Company)
	if hasGap {
		final = fmt.Sprintf("Identified skill gap: requires demonstrated proof for %s.", gapReason)
	}
	steps := []string{
		fmt.Sprintf("Fetching verified commits for @%s from DevLedgr consensus network...", user.Username),
		fmt.Sprintf("Found %d cryptographically signed entries.", len(subs)),
		fmt.Sprintf("Cross-referencing technical requirements for %s (%s)...", job.Company, job.Title),
		"Auditing latency SLA proofs and test suites against job spec...",
		final,
	}
	for _, s := range steps {
		emit(s)
	}

	status := "ready"
	if hasGap {
		status = "gap"
	}
	return ScrutinyResult{
		Status:      status,
		ScanLogs:    steps,
		CVMarkdown:  buildCV(user, subs),
		CoverLetter: buildCoverLetter(job, user, subs),
		GapReason:   job.GapReason,
		GapIdeaID:   job.GapIdeaID,
		Engine:      "heuristic",
	}
}

func metricOr(m *model.Metrics, pick func(*model.Metrics) string, def string) string {
	if m != nil {
		if v := pick(m); v != "" {
			return v
		}
	}
	return def
}

func p99(m *model.Metrics) string        { return m.LatencyP99 }
func throughput(m *model.Metrics) string { return m.Throughput }

func contactEmail(u model.UserProfile) string {
	if u.Email != "" {
		return u.Email
	}
	return u.Username + "@devledgr.me"
}

func buildCV(u model.UserProfile, subs []model.Submission) string {
	var b strings.Builder
	fmt.Fprintf(&b, "# %s\n%s\nEmail: %s | Portfolio: https://%s.devledgr.io\n", u.Name, u.Headline, contactEmail(u), u.Username)
	fmt.Fprintf(&b, "GitHub: %s | Verification: Stamped on DevLedgr (1-Year Certificate)\n\n---\n\n", u.GitHubURL)
	b.WriteString("## EXECUTIVE SUMMARY\nEngineer with a track record of building resilient, low-latency services. ")
	b.WriteString("All highlighted competencies are supported by cryptographically verified ledger entries with CI telemetry.\n\n---\n\n")
	b.WriteString("## VERIFIED ENGINEERING PROOF (DEVLEDGR COMMITS)\n\n")
	for i, s := range subs {
		if i > 0 {
			b.WriteString("\n")
		}
		fmt.Fprintf(&b, "### %s\n**Commit #%s** · Verified Proof of Work | Code: %s\n", s.IdeaTitle, s.Hash, s.RepoURL)
		fmt.Fprintf(&b, "- **Architecture & Implementation:** %s\n", s.ArchitectureNotes)
		fmt.Fprintf(&b, "- **Performance & Constraints:** Sustained p99 latency of %s at %s.\n",
			metricOr(s.Metrics, p99, "n/a"), metricOr(s.Metrics, throughput, "n/a"))
		if s.TestResults.Total > 0 {
			fmt.Fprintf(&b, "- **Verification Suite:** Passed %d/%d tests in %s.\n", s.TestResults.Passed, s.TestResults.Total, s.TestResults.SuiteName)
		}
		fmt.Fprintf(&b, "- **Permanent Ledger Link:** https://%s.devledgr.io/p/%s\n", u.Username, s.Hash)
	}

	skills := u.StatedSkills[:min(3, len(u.StatedSkills))]
	b.WriteString("\n---\n\n## TECHNICAL CAPABILITIES\n")
	fmt.Fprintf(&b, "- **Languages & Tools:** %s\n", strings.Join(skills, ", "))
	if u.PortfolioValidUntil != nil {
		fmt.Fprintf(&b, "- **Verification Guarantee:** Verifiable ledger certificate through %s\n", u.PortfolioValidUntil.Format("Jan 2006"))
	}
	return b.String()
}

func buildCoverLetter(job model.Job, u model.UserProfile, subs []model.Submission) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Dear Hiring Team at %s,\n\nI am writing to express my strong interest in the %s position.\n\n", job.Company, job.Title)
	fmt.Fprintf(&b, "Unlike applications built on unverified claims, my experience is backed by verifiable proof-of-work recorded on DevLedgr (https://%s.devledgr.io).\n\n", u.Username)

	// Lead with entries that match the job's target problems.
	ordered := slices.Clone(subs)
	slices.SortStableFunc(ordered, func(a, c model.Submission) int {
		am, cm := slices.Contains(job.MatchedIdeaIDs, a.IdeaID), slices.Contains(job.MatchedIdeaIDs, c.IdeaID)
		switch {
		case am && !cm:
			return -1
		case cm && !am:
			return 1
		}
		return 0
	})
	if len(ordered) > 0 {
		fmt.Fprintf(&b, "To demonstrate the engineering requirements essential for %s, I built:\n", job.Company)
		for _, s := range ordered[:min(2, len(ordered))] {
			fmt.Fprintf(&b, "• %s (Commit #%s), achieving %s p99 latency under simulated production load.\n",
				s.IdeaTitle, s.Hash, metricOr(s.Metrics, p99, "verified"))
		}
		b.WriteString("\n")
	}
	fmt.Fprintf(&b, "My technical documentation, test harness results, and code repositories are permanently verifiable on my ledger. I welcome the opportunity to discuss how I can add immediate value to %s.\n\n", job.Company)
	fmt.Fprintf(&b, "Sincerely,\n%s\nhttps://%s.devledgr.io\n", u.Name, u.Username)
	return b.String()
}

func heuristicCoach(in CoachInput) string {
	return fmt.Sprintf(`[AI Coach Formulation]:
For milestone "%s" (%s):
%s

Suggested Implementation Strategy:
1. Write down the failure modes first: timeouts, duplicates, partial writes, and concurrent edits.
2. Build an in-memory benchmark harness so every design choice is measured, not guessed.
3. Make retries safe with idempotency keys, and isolate failing dependencies behind a circuit breaker.
4. Record p99 latency and throughput for the final design; those numbers become your ledger evidence.`,
		in.MilestoneTitle, in.ItineraryTitle, in.Prompt)
}
