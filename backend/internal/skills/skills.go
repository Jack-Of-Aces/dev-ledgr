// Package skills normalizes technology/skill names so "Golang", "go" and
// "GO" compare equal when matching developers to jobs and CVs to keywords.
package skills

import (
	"regexp"
	"sort"
	"strings"
)

var aliases = map[string]string{
	"golang":              "go",
	"postgres":            "postgresql",
	"psql":                "postgresql",
	"js":                  "javascript",
	"ts":                  "typescript",
	"node":                "node.js",
	"nodejs":              "node.js",
	"k8s":                 "kubernetes",
	"py":                  "python",
	"react.js":            "react",
	"reactjs":             "react",
	"next":                "next.js",
	"nextjs":              "next.js",
	"cicd":                "ci/cd",
	"aws cloud":           "aws",
	"amazon web services": "aws",
	"gcp":                 "google cloud",
	"mongo":               "mongodb",
}

// Normalize lowercases, trims and resolves common aliases.
func Normalize(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.Join(strings.Fields(s), " ")
	if a, ok := aliases[s]; ok {
		return a
	}
	return s
}

// Set builds a normalized set from any number of skill lists.
func Set(lists ...[]string) map[string]string {
	out := map[string]string{}
	for _, l := range lists {
		for _, s := range l {
			if n := Normalize(s); n != "" {
				if _, ok := out[n]; !ok {
					out[n] = strings.TrimSpace(s)
				}
			}
		}
	}
	return out
}

// Match scores how many of want are covered by have (0-100) and returns the
// matched and missing skills in want's original spelling.
func Match(have map[string]string, want []string) (score int, matched, missing []string) {
	matched, missing = []string{}, []string{}
	seen := map[string]bool{}
	for _, w := range want {
		n := Normalize(w)
		if n == "" || seen[n] {
			continue
		}
		seen[n] = true
		if _, ok := have[n]; ok {
			matched = append(matched, w)
		} else {
			missing = append(missing, w)
		}
	}
	if total := len(matched) + len(missing); total > 0 {
		score = (len(matched)*100 + total/2) / total
	}
	return score, matched, missing
}

// Sorted returns the display names of a set, alphabetically.
func Sorted(set map[string]string) []string {
	out := make([]string, 0, len(set))
	for _, v := range set {
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i]) < strings.ToLower(out[j]) })
	return out
}

// InText reports whether a skill appears in free text as a whole term,
// accepting its aliases (so "Golang" in a CV satisfies "Go").
func InText(text, skill string) bool {
	lower := strings.ToLower(text)
	target := Normalize(skill)
	terms := []string{target}
	for alias, canon := range aliases {
		if canon == target {
			terms = append(terms, alias)
		}
	}
	for _, t := range terms {
		re := regexp.MustCompile(`(^|[^a-z0-9+#])` + regexp.QuoteMeta(t) + `($|[^a-z0-9+#])`)
		if re.MatchString(lower) {
			return true
		}
	}
	return false
}
