package skills

import "testing"

func TestMatchUsesAliases(t *testing.T) {
	have := Set([]string{"Golang", "postgres", "Docker"})
	score, matched, missing := Match(have, []string{"Go", "PostgreSQL", "Kubernetes", "go"})
	if score != 67 || len(matched) != 2 || len(missing) != 1 || missing[0] != "Kubernetes" {
		t.Fatalf("score=%d matched=%v missing=%v", score, matched, missing)
	}
	if s, _, _ := Match(have, nil); s != 0 {
		t.Fatalf("empty job skills should score 0, got %d", s)
	}
}

func TestInText(t *testing.T) {
	cases := map[string]bool{"Go": true, "Rust": false, "PostgreSQL": true, "C": false}
	text := "Built services in Golang backed by Postgres; see C++ notes."
	for skill, want := range cases {
		if got := InText(text, skill); got != want {
			t.Errorf("InText(%q) = %v, want %v", skill, got, want)
		}
	}
}
