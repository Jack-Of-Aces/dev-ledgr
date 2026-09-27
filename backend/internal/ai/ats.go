package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/skills"
)

// ATSInput is a CV to audit, optionally against a target job.
type ATSInput struct {
	CVText    string
	Job       *model.Job
	DevSkills []string // stated + proven skills, used when no job is given
}

var (
	// ErrAIRefused means the model declined the request (stop_reason "refusal").
	ErrAIRefused = errors.New("the AI model declined to audit this CV")
	// ErrAIUnavailable wraps transport, rate-limit and server errors from the model API.
	ErrAIUnavailable = errors.New("the AI model is unavailable")
)

var atsCategories = []string{"formatting", "keywords", "experience", "achievements", "skills", "education", "contact", "readability"}

// ATSAudit scores a CV for ATS compliance. With an Anthropic client it asks
// Claude; otherwise it uses the deterministic heuristic scorer. A configured
// model that fails returns an error rather than silently degrading.
func (e *Engine) ATSAudit(ctx context.Context, in ATSInput) (model.CVAudit, error) {
	if e.Claude == nil {
		return heuristicATS(in), nil
	}
	return e.claudeATS(ctx, in)
}

func targetKeywords(in ATSInput) []string {
	if in.Job != nil {
		return in.Job.Tags
	}
	return in.DevSkills
}

const atsSystemPrompt = `You audit CVs for applicant tracking system (ATS) compliance for early-career software engineers.

Score the CV from 0 to 100 on how reliably an ATS will parse it and how well it would rank for the target role. Weigh: parseable structure and standard section headings; keyword coverage for the target role; clear, reverse-chronological experience; quantified achievements; an explicit skills section; education; contact details; and concise, readable wording.

Give a score for each category in the breakdown. Recommendations must be specific to this CV: quote or point to the exact line or section at fault and say what to write instead. Order them by impact. Only list keywords that actually appear (matchedKeywords) or are expected for the target role but absent (missingKeywords). If no job description is provided, judge keywords against the candidate's stated skills and general backend/software engineering roles.

The CV text was extracted automatically, so ignore stray line breaks or spacing artifacts unless they indicate a layout (tables, columns, images of text) that a real ATS would also mangle.`

func atsSchema() map[string]any {
	str := map[string]any{"type": "string"}
	strArr := map[string]any{"type": "array", "items": str}
	obj := func(props map[string]any) map[string]any {
		req := make([]string, 0, len(props))
		for k := range props {
			req = append(req, k)
		}
		slices.Sort(req)
		return map[string]any{"type": "object", "additionalProperties": false, "required": req, "properties": props}
	}
	return obj(map[string]any{
		"score":   map[string]any{"type": "integer", "description": "Overall ATS compliance score, 0-100"},
		"summary": map[string]any{"type": "string", "description": "Two or three sentences on the CV's overall ATS readiness"},
		"breakdown": map[string]any{"type": "array", "items": obj(map[string]any{
			"category": map[string]any{"type": "string", "enum": atsCategories},
			"score":    map[string]any{"type": "integer", "description": "0-100"},
			"notes":    str,
		})},
		"recommendations": map[string]any{"type": "array", "items": obj(map[string]any{
			"category":   map[string]any{"type": "string", "enum": atsCategories},
			"priority":   map[string]any{"type": "string", "enum": []string{"high", "medium", "low"}},
			"issue":      str,
			"suggestion": str,
		})},
		"matchedKeywords": strArr,
		"missingKeywords": strArr,
	})
}

func (e *Engine) claudeATS(ctx context.Context, in ATSInput) (model.CVAudit, error) {
	var user strings.Builder
	if in.Job != nil {
		fmt.Fprintf(&user, "<job_description>\nTitle: %s\nCompany: %s\nLevel: %s\nSkills: %s\nRequirements:\n- %s\n\n%s\n</job_description>\n\n",
			in.Job.Title, in.Job.Company, in.Job.Level, strings.Join(in.Job.Tags, ", "),
			strings.Join(in.Job.RequiredSkills, "\n- "), in.Job.Description)
	} else if len(in.DevSkills) > 0 {
		fmt.Fprintf(&user, "<candidate_stated_skills>%s</candidate_stated_skills>\n\n", strings.Join(in.DevSkills, ", "))
	}
	fmt.Fprintf(&user, "<cv>\n%s\n</cv>", in.CVText)

	resp, err := e.Claude.Beta.Messages.New(ctx, anthropic.BetaMessageNewParams{
		Model:     e.Model,
		MaxTokens: 16000,
		System:    []anthropic.BetaTextBlockParam{{Text: atsSystemPrompt}},
		Messages: []anthropic.BetaMessageParam{
			anthropic.NewBetaUserMessage(anthropic.NewBetaTextBlock(user.String())),
		},
		OutputConfig: anthropic.BetaOutputConfigParam{
			Format: anthropic.BetaJSONOutputFormatParam{Schema: atsSchema()},
		},
		// If a safety classifier declines, let the API re-serve the request
		// on a fallback model instead of failing the audit.
		Fallbacks: anthropic.BetaFallbacksParamOfDefault(),
		Betas:     []anthropic.AnthropicBeta{anthropic.AnthropicBetaServerSideFallback2026_07_01},
	})
	if err != nil {
		var apiErr *anthropic.Error
		if errors.As(err, &apiErr) && apiErr.StatusCode < 500 && apiErr.StatusCode != 429 && apiErr.StatusCode != 408 {
			// A 4xx here is a bug in our request or configuration, not a transient outage.
			return model.CVAudit{}, fmt.Errorf("claude request rejected: %w", err)
		}
		return model.CVAudit{}, fmt.Errorf("%w: %v", ErrAIUnavailable, err)
	}
	switch resp.StopReason {
	case anthropic.BetaStopReasonRefusal:
		return model.CVAudit{}, ErrAIRefused
	case anthropic.BetaStopReasonMaxTokens:
		return model.CVAudit{}, fmt.Errorf("%w: response truncated at max_tokens", ErrAIUnavailable)
	}

	var text string
	for _, block := range resp.Content {
		if tb, ok := block.AsAny().(anthropic.BetaTextBlock); ok {
			text += tb.Text
		}
	}
	var out struct {
		Score           int                       `json:"score"`
		Summary         string                    `json:"summary"`
		Breakdown       []model.ATSBreakdownItem  `json:"breakdown"`
		Recommendations []model.ATSRecommendation `json:"recommendations"`
		MatchedKeywords []string                  `json:"matchedKeywords"`
		MissingKeywords []string                  `json:"missingKeywords"`
	}
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		return model.CVAudit{}, fmt.Errorf("%w: unparseable audit output: %v", ErrAIUnavailable, err)
	}

	// Structured outputs cannot express numeric ranges; enforce them here.
	audit := model.CVAudit{
		Score:           clamp(out.Score),
		Summary:         out.Summary,
		Breakdown:       out.Breakdown,
		Recommendations: out.Recommendations,
		MatchedKeywords: capList(out.MatchedKeywords, 50),
		MissingKeywords: capList(out.MissingKeywords, 50),
		Engine:          "claude",
		Model:           string(resp.Model),
	}
	for i := range audit.Breakdown {
		audit.Breakdown[i].Score = clamp(audit.Breakdown[i].Score)
	}
	if len(audit.Recommendations) > 20 {
		audit.Recommendations = audit.Recommendations[:20]
	}
	if audit.Breakdown == nil {
		audit.Breakdown = []model.ATSBreakdownItem{}
	}
	if audit.Recommendations == nil {
		audit.Recommendations = []model.ATSRecommendation{}
	}
	return audit, nil
}

func clamp(n int) int { return max(0, min(100, n)) }

func capList(s []string, n int) []string {
	if s == nil {
		return []string{}
	}
	return s[:min(n, len(s))]
}

var (
	emailRe       = regexp.MustCompile(`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`)
	phoneRe       = regexp.MustCompile(`\+?\d[\d\s().-]{7,}\d`)
	profileRe     = regexp.MustCompile(`(?i)(github\.com|linkedin\.com|gitlab\.com)/\S+`)
	quantifiedRe  = regexp.MustCompile(`\d+(\.\d+)?\s*(%|x\b|ms\b|k\b|m\b|req/s|users|customers|hours|days)|\$\s?\d`)
	sectionChecks = []struct {
		name string
		re   *regexp.Regexp
	}{
		{"Experience", regexp.MustCompile(`(?im)^\s*(work\s+)?(experience|employment|work history|professional experience)\b`)},
		{"Education", regexp.MustCompile(`(?im)^\s*(education|academic)\b`)},
		{"Skills", regexp.MustCompile(`(?im)^\s*(technical\s+)?skills\b`)},
		{"Projects", regexp.MustCompile(`(?im)^\s*(projects|personal projects|open source)\b`)},
	}
)

// heuristicATS is a transparent rule-based scorer used when no model is configured.
func heuristicATS(in ATSInput) model.CVAudit {
	text := in.CVText
	words := len(strings.Fields(text))
	var breakdown []model.ATSBreakdownItem
	var recs []model.ATSRecommendation
	add := func(cat string, score int, notes string) {
		breakdown = append(breakdown, model.ATSBreakdownItem{Category: cat, Score: clamp(score), Notes: notes})
	}
	rec := func(cat, prio, issue, fix string) {
		recs = append(recs, model.ATSRecommendation{Category: cat, Priority: prio, Issue: issue, Suggestion: fix})
	}

	// Contact details (weight 10).
	contact := 0
	if emailRe.MatchString(text) {
		contact += 50
	} else {
		rec("contact", "high", "No email address was found.", "Add a professional email address in the header, as plain text.")
	}
	if phoneRe.MatchString(text) {
		contact += 25
	} else {
		rec("contact", "medium", "No phone number was found.", "Add a phone number with country code in the header.")
	}
	if profileRe.MatchString(text) {
		contact += 25
	} else {
		rec("contact", "medium", "No GitHub or LinkedIn link was found.", "Add your GitHub and DevLedgr portfolio URLs so reviewers can verify your work.")
	}
	add("contact", contact, "Email, phone and profile links")

	// Standard sections (weight 25).
	found := 0
	for _, s := range sectionChecks {
		if s.re.MatchString(text) {
			found++
		} else {
			rec("formatting", "high", fmt.Sprintf("No %q section heading was detected.", s.name),
				fmt.Sprintf("Add a plain-text heading named %q on its own line; ATS parsers map content by standard headings.", s.name))
		}
	}
	add("formatting", found*25, fmt.Sprintf("%d of %d standard sections detected", found, len(sectionChecks)))

	// Keyword coverage (weight 30).
	var matched, missing []string
	for _, k := range targetKeywords(in) {
		if skills.InText(text, k) {
			matched = append(matched, k)
		} else {
			missing = append(missing, k)
		}
	}
	kw := 60
	if total := len(matched) + len(missing); total > 0 {
		kw = len(matched) * 100 / total
		if len(missing) > 0 {
			rec("keywords", "high", "Keywords expected for the target role are missing: "+strings.Join(missing[:min(8, len(missing))], ", ")+".",
				"Where you genuinely have the skill, name it explicitly in your skills section and in the bullet that proves it.")
		}
	}
	add("keywords", kw, fmt.Sprintf("%d of %d target keywords present", len(matched), len(matched)+len(missing)))

	// Quantified achievements (weight 20).
	quant := len(quantifiedRe.FindAllString(text, -1))
	add("achievements", quant*20, fmt.Sprintf("%d quantified results found", quant))
	if quant < 5 {
		rec("achievements", "high", fmt.Sprintf("Only %d quantified results were found.", quant),
			"Rewrite bullets as action + result with numbers, e.g. p99 latency, throughput, test coverage or users served.")
	}

	// Length and readability (weight 15).
	length := 100
	switch {
	case words < 250:
		length = 40
		rec("readability", "medium", fmt.Sprintf("The CV is short (%d words).", words), "Aim for 400-900 words: describe what you built, how, and the measured outcome.")
	case words > 1200:
		length = 50
		rec("readability", "medium", fmt.Sprintf("The CV is long (%d words).", words), "Trim to one or two pages; keep the most relevant, recent and quantified work.")
	}
	if strings.Count(text, "|") > 10 || strings.Count(text, "\t") > 20 {
		length -= 30
		rec("formatting", "high", "The text looks like it came from tables or multi-column layout.", "Use a single-column layout without tables or text boxes; many ATS parsers scramble them.")
	}
	add("readability", length, fmt.Sprintf("%d words", words))

	// Weights: contact 10, sections 25, keywords 30, achievements 20, readability 15.
	score := (contact*10 + found*25*25 + kw*30 + clamp(quant*20)*20 + clamp(length)*15) / 100
	slices.SortStableFunc(recs, func(a, b model.ATSRecommendation) int {
		rank := map[string]int{"high": 0, "medium": 1, "low": 2}
		return rank[a.Priority] - rank[b.Priority]
	})
	if recs == nil {
		recs = []model.ATSRecommendation{}
	}
	return model.CVAudit{
		Score:           clamp(score),
		Summary:         fmt.Sprintf("Rule-based ATS check: %d/100. Configure ANTHROPIC_API_KEY for a detailed AI review.", clamp(score)),
		Breakdown:       breakdown,
		Recommendations: recs,
		MatchedKeywords: capList(matched, 50),
		MissingKeywords: capList(missing, 50),
		Engine:          "heuristic",
	}
}
