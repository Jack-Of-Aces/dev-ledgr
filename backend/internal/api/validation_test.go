package api

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func fieldErrors(t *testing.T, err error) map[string][]string {
	t.Helper()
	var ae *apiError
	if !errors.As(err, &ae) {
		t.Fatalf("expected *apiError, got %v", err)
	}
	return ae.Errors
}

func ptr(s string) *string { return &s }

func TestProfileValidationMirrorsZodSchema(t *testing.T) {
	ok := profileUpdateRequest{Name: "Alex", Headline: "Backend Engineer", Plan: "free", StatedSkills: []string{"Go"}}
	if err := ok.validate(); err != nil {
		t.Fatalf("valid profile rejected: %v", err)
	}

	bad := profileUpdateRequest{
		Name: "A", Headline: strings.Repeat("h", 121), Bio: strings.Repeat("b", 501),
		AvatarURL: ptr("not a url"), GitHubURL: ptr("javascript:alert(1)"), Email: ptr("x@"),
		Plan: "gold",
	}
	errs := fieldErrors(t, bad.validate())
	for _, f := range []string{"name", "headline", "bio", "avatarUrl", "githubUrl", "email", "plan", "statedSkills"} {
		if len(errs[f]) == 0 {
			t.Errorf("expected error for %s", f)
		}
	}

	// Empty strings for optional URLs/email are allowed, like z.literal('').
	empty := ok
	empty.AvatarURL, empty.GitHubURL, empty.Email = ptr(""), ptr(""), ptr("")
	if err := empty.validate(); err != nil {
		t.Fatalf("empty optional fields rejected: %v", err)
	}
}

func TestSubmissionValidation(t *testing.T) {
	ok := createSubmissionRequest{IdeaID: "x", RepoURL: "https://github.com/owner/repo/", ArchitectureNotes: "enough notes here", CommitHash: "ABCDEF1"}
	if err := ok.validate(); err != nil {
		t.Fatalf("valid submission rejected: %v", err)
	}
	if ok.RepoURL != "https://github.com/owner/repo" || ok.CommitHash != "abcdef1" {
		t.Fatalf("not normalized: %q %q", ok.RepoURL, ok.CommitHash)
	}

	zero := 0
	bad := createSubmissionRequest{RepoURL: "http://github.com/owner", CommitHash: "zzz", PRNumber: &zero, ArchitectureNotes: "short"}
	errs := fieldErrors(t, bad.validate())
	for _, f := range []string{"ideaId", "repoUrl", "commitHash", "prNumber", "architectureNotes"} {
		if len(errs[f]) == 0 {
			t.Errorf("expected error for %s", f)
		}
	}
}

func TestNormalizeEmail(t *testing.T) {
	for in, want := range map[string]string{"A@Example.com": "a@example.com", " b@x.io ": "b@x.io"} {
		if got, ok := normalizeEmail(in); !ok || got != want {
			t.Errorf("normalizeEmail(%q) = %q, %v", in, got, ok)
		}
	}
	for _, in := range []string{"", "nope", "a@b", "Name <a@b.co>", "a@b.co, c@d.co"} {
		if _, ok := normalizeEmail(in); ok {
			t.Errorf("normalizeEmail(%q) accepted", in)
		}
	}
}

func TestDecodeJSONRejectsUnknownFieldsAndWrongType(t *testing.T) {
	var dst struct {
		A string `json:"a"`
	}
	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"a":"x","b":1}`))
	if err := decodeJSON(httptest.NewRecorder(), r, &dst); err == nil {
		t.Fatal("unknown field accepted")
	}
	r = httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`a=x`))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if err := decodeJSON(httptest.NewRecorder(), r, &dst); err == nil {
		t.Fatal("form body accepted")
	}
	r = httptest.NewRequest(http.MethodPost, "/", strings.NewReader(``))
	if err := decodeOptionalJSON(httptest.NewRecorder(), r, &dst); err != nil {
		t.Fatalf("empty optional body rejected: %v", err)
	}
}

func TestRateLimiter(t *testing.T) {
	l := newRateLimiter(2, 1<<62)
	for i, want := range []bool{true, true, false} {
		if got := l.allow("a"); got != want {
			t.Fatalf("request %d allowed = %v, want %v", i+1, got, want)
		}
	}
	if !l.allow("b") {
		t.Fatal("limits leaked across keys")
	}
}
