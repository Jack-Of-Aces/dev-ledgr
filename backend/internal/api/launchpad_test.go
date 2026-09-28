package api

import (
	"fmt"
	"strings"
	"testing"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/skills"
)

func TestDifficultyFit(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name       string
		difficulty string
		level      string
		want       int
	}{
		{"junior gets the foundational build", "foundational", "junior", 10},
		{"mid gets the intermediate build", "intermediate", "mid", 10},
		{"senior gets the production build", "production-grade", "senior", 10},
		{"one step up costs five points", "intermediate", "junior", 5},
		{"one step down costs five points", "foundational", "mid", 5},
		{"two steps apart is a wash", "production-grade", "junior", 0},
		{"unknown difficulty stays neutral", "spicy", "senior", 0},
		{"unknown level stays neutral", "intermediate", "wizard", 0},
		{"casing and padding are ignored", " Intermediate ", " Junior ", 5},
		{"empty level scores zero", "intermediate", "", 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := difficultyFit(tc.difficulty, tc.level); got != tc.want {
				t.Errorf("difficultyFit(%q, %q) = %d, want %d", tc.difficulty, tc.level, got, tc.want)
			}
		})
	}
}

func TestRankProblems(t *testing.T) {
	t.Parallel()
	problems := []model.Idea{
		{ID: "1", Title: "Ledger Reconciler", Difficulty: "intermediate", Tags: []string{"Go", "PostgreSQL"}},
		{ID: "2", Title: "Webhook Dedup", Difficulty: "intermediate", Tags: []string{"Redis", "Go"}},
		{ID: "3", Title: "Design System", Difficulty: "foundational", Tags: []string{"React", "CSS"}},
		{ID: "4", Title: "Route Optimizer", Difficulty: "foundational", Tags: []string{"Go"}},
	}

	t.Run("ranks by skill overlap, stable for ties", func(t *testing.T) {
		t.Parallel()
		got := rankProblems(problems, skills.Set([]string{"Go", "PostgreSQL"}), "mid")
		// "Ledger Reconciler" leads on skill overlap; the two single-skill Go
		// problems tie and keep their incoming order.
		want := []string{"1", "4", "2", "3"}
		assertOrder(t, got, want)
	})

	t.Run("a matching skill set scores 100 with no gaps", func(t *testing.T) {
		t.Parallel()
		got := rankProblems(problems[:1], skills.Set([]string{"golang", "postgres"}), "junior")
		m := got[0].Match
		if m == nil || m.Score != 100 {
			t.Fatalf("score = %+v, want 100", m)
		}
		if len(m.MissingSkills) != 0 {
			t.Errorf("missingSkills = %v, want none", m.MissingSkills)
		}
	})

	t.Run("reports the skills a dev already has", func(t *testing.T) {
		t.Parallel()
		got := rankProblems(problems[3:], skills.Set([]string{"Go"}), "senior")
		m := got[0].Match
		if m == nil {
			t.Fatal("match is nil")
		}
		if len(m.MatchedSkills) != 1 || m.MatchedSkills[0] != "Go" {
			t.Errorf("matchedSkills = %v, want [Go]", m.MatchedSkills)
		}
		if len(m.MissingSkills) != 0 {
			t.Errorf("missingSkills = %v, want none", m.MissingSkills)
		}
	})

	t.Run("reports the gap a dev still has to close", func(t *testing.T) {
		t.Parallel()
		got := rankProblems(problems[2:4], skills.Set([]string{"React"}), "mid")
		m := got[1].Match // "Route Optimizer" needs Go, which they lack
		if m.Score != 0 {
			t.Errorf("score = %d, want 0 for no overlapping skill", m.Score)
		}
		if len(m.MissingSkills) != 1 || m.MissingSkills[0] != "Go" {
			t.Errorf("missingSkills = %v, want [Go]", m.MissingSkills)
		}
	})

	t.Run("an empty skill set still ranks, on difficulty alone", func(t *testing.T) {
		t.Parallel()
		got := rankProblems(problems, map[string]string{}, "mid")
		for _, r := range got {
			if r.Match == nil || r.Match.Score != 0 {
				t.Errorf("problem %q match = %+v, want a zero skill score", r.ID, r.Match)
			}
		}
		// intermediate suits a mid exactly (10) and foundational is one step
		// under (5); within each band the incoming order is preserved.
		assertOrder(t, got, []string{"1", "2", "3", "4"})
	})

	t.Run("seniority only nudges an otherwise equal pair", func(t *testing.T) {
		t.Parallel()
		equal := []model.Idea{
			{ID: "easy", Difficulty: "foundational", Tags: []string{"Go"}},
			{ID: "hard", Difficulty: "production-grade", Tags: []string{"Go"}},
		}
		have := skills.Set([]string{"Go"})
		// Same skill score, so the level decides which one leads.
		if first := rankProblems(equal, have, "junior")[0].ID; first != "easy" {
			t.Errorf("junior lead = %q, want %q", first, "easy")
		}
		if first := rankProblems(equal, have, "lead")[0].ID; first != "hard" {
			t.Errorf("lead lead = %q, want %q", first, "hard")
		}
		// Without a level the two are indistinguishable and order is kept.
		assertOrder(t, rankProblems(equal, have, ""), []string{"easy", "hard"})
	})

	t.Run("matches on the suggested stack as well as the tags", func(t *testing.T) {
		t.Parallel()
		withStack := []model.Idea{{ID: "1", Tags: []string{"Rust"}, SuggestedStack: []string{"Kafka"}}}
		got := rankProblems(withStack, skills.Set([]string{"rust", "kafka"}), "senior")
		if got[0].Match.Score != 100 {
			t.Fatalf("score = %d, want 100 when the tag and the stack are both covered", got[0].Match.Score)
		}
	})

	t.Run("an uncovered tag lowers the score", func(t *testing.T) {
		t.Parallel()
		// "Payments" is an editorial tag rather than a skill, so a dev who
		// cannot match it still has 2 of the 3 requirements.
		problem := []model.Idea{{ID: "1", Tags: []string{"Payments"}, SuggestedStack: []string{"Rust", "Kafka"}}}
		got := rankProblems(problem, skills.Set([]string{"rust", "kafka"}), "senior")
		if got[0].Match.Score != 67 {
			t.Fatalf("score = %d, want 67 (2 of 3 requirements met)", got[0].Match.Score)
		}
		if len(got[0].Match.MissingSkills) != 1 || got[0].Match.MissingSkills[0] != "Payments" {
			t.Errorf("missingSkills = %v, want [Payments]", got[0].Match.MissingSkills)
		}
	})

	t.Run("does not mutate the caller's problems", func(t *testing.T) {
		t.Parallel()
		in := []model.Idea{{ID: "1", Tags: []string{"Go", "Redis"}}}
		rankProblems(in, skills.Set([]string{"Go"}), "mid")
		if len(in[0].Tags) != 2 {
			t.Errorf("tags = %v, want the original two entries", in[0].Tags)
		}
	})

	t.Run("handles an empty bank", func(t *testing.T) {
		t.Parallel()
		if got := rankProblems(nil, skills.Set([]string{"Go"}), "mid"); len(got) != 0 {
			t.Errorf("rankProblems(nil) = %v, want empty", got)
		}
	})
}

func TestParseDraftSkills(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name    string
		raw     string
		want    []string
		wantErr bool
	}{
		{"blank means no draft", "", nil, false},
		{"splits and trims", "Go, Redis ,Kubernetes", []string{"Go", "Redis", "Kubernetes"}, false},
		{"drops empty entries", "Go,,  ,Redis", []string{"Go", "Redis"}, false},
		{"keeps the first spelling of a case-insensitive duplicate", "Go,go", []string{"Go"}, false},
		{"rejects too many entries", skillList(51), nil, true},
		{"rejects an oversized string", skillList(200), nil, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := parseDraftSkills(tc.raw)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("parseDraftSkills(%q) = %v, want an error", tc.raw, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("parseDraftSkills(%q): %v", tc.raw, err)
			}
			if len(got) != len(tc.want) {
				t.Fatalf("parseDraftSkills(%q) = %v, want %v", tc.raw, got, tc.want)
			}
			for i, s := range tc.want {
				if got[i] != s {
					t.Errorf("entry %d = %q, want %q", i, got[i], s)
				}
			}
		})
	}
}

func TestParseDraftSkillsBoundaries(t *testing.T) {
	t.Parallel()
	// A list at the entry budget is accepted; one entry more is not.
	if got, err := parseDraftSkills(skillList(maxDraftSkills)); err != nil {
		t.Errorf("parseDraftSkills rejected a list at the budget: %v", err)
	} else if len(got) != maxDraftSkills {
		t.Errorf("parseDraftSkills returned %d entries, want %d", len(got), maxDraftSkills)
	}
	if _, err := parseDraftSkills(skillList(maxDraftSkills + 1)); err == nil {
		t.Error("parseDraftSkills accepted a list one entry over the budget, want an error")
	}

	// The character budget is checked before splitting, so a handful of long
	// entries is refused on length even though it is within the entry count.
	long := func(entryLen, n int) string {
		entries := make([]string, n)
		for i := range entries {
			entries[i] = strings.Repeat(string(rune('a'+i%26)), entryLen)
		}
		return strings.Join(entries, ",")
	}
	if _, err := parseDraftSkills(long(130, 4)); err == nil {
		t.Error("parseDraftSkills accepted a string over the character budget, want an error")
	}
	got, err := parseDraftSkills(long(120, 4))
	if err != nil {
		t.Errorf("parseDraftSkills rejected a string within the budget: %v", err)
	} else if len(got) != 4 {
		t.Errorf("parseDraftSkills returned %d entries, want 4", len(got))
	}
}

func assertOrder(t *testing.T, got []problemRecommendation, want []string) {
	t.Helper()
	gotIDs := make([]string, len(got))
	for i, r := range got {
		gotIDs[i] = r.ID
	}
	if strings.Join(gotIDs, ",") != strings.Join(want, ",") {
		t.Errorf("order = %v, want %v", gotIDs, want)
	}
}

// skillList builds a comma-separated list of n distinct skill entries, so a
// length assertion is not confused by dedupe.
func skillList(n int) string {
	entries := make([]string, n)
	for i := range entries {
		entries[i] = fmt.Sprintf("skill%d", i)
	}
	return strings.Join(entries, ",")
}
