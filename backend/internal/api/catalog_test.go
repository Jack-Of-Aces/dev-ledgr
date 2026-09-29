package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestCreateIdeaRequestRejectsServerOwnedFields pins the request contract for
// POST /api/v1/ideas. The console used to post a whole IdeaItem, which carries
// id and submissionCount; the handler decodes with DisallowUnknownFields, so
// that payload is refused with a 400 before the store is ever reached. A client
// that omits the server-owned fields is accepted.
func TestCreateIdeaRequestRejectsServerOwnedFields(t *testing.T) {
	t.Parallel()

	// The draft the console now sends: no id, no submissionCount.
	draft := `{
		"title": "Distributed Rate Limiter",
		"tagline": "Token bucket across a Redis cluster",
		"domain": "systems",
		"difficulty": "intermediate",
		"estimatedHours": 12,
		"originStory": "From a payments lead",
		"problemStatement": "Thundering herd protection across shards",
		"technicalRequirements": ["Atomic Lua scripts"],
		"mockInfra": {"baseUrl":"","starterRepoUrl":"","endpoints":[],"curlExample":"","testCriteria":[]},
		"tags": ["Go","Redis"],
		"suggestedStack": [],
		"regionalHurdles": "",
		"sourceUrl": ""
	}`

	t.Run("accepts the draft shape", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodPost, "/api/v1/ideas", strings.NewReader(draft))
		req.Header.Set("Content-Type", "application/json")
		var got createIdeaRequest
		if err := decodeJSON(httptest.NewRecorder(), req, &got); err != nil {
			t.Fatalf("draft payload rejected: %v", err)
		}
		if err := got.validate(); err != nil {
			t.Fatalf("draft payload failed validation: %v", err)
		}
		if got.Title != "Distributed Rate Limiter" || len(got.TechnicalRequirements) != 1 {
			t.Errorf("decoded = %+v, want the title and its single requirement", got)
		}
	})

	// A whole IdeaItem also carries id and submissionCount. The id happens to
	// exist on the request struct, but it is minted server-side, so sending it
	// is at best ignored and at worst confusing; submissionCount is not a field
	// at all and fails the strict decode outright.
	for _, tc := range []struct{ name, extra string }{
		{"a full idea item", `,"id":"my-slug","submissionCount":0`},
		{"just the count", `,"submissionCount":0`},
		{"an idea with no id", `,"id":""`},
	} {
		t.Run("refuses "+tc.name, func(t *testing.T) {
			t.Parallel()
			body := strings.Replace(draft, "}", tc.extra+"}", 1)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/ideas", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			var got createIdeaRequest
			if err := decodeJSON(httptest.NewRecorder(), req, &got); err == nil {
				t.Fatalf("payload with %s decoded without error; DisallowUnknownFields should have refused it", tc.extra)
			}
		})
	}
}

// TestCreateIdeaRequestRoundTripsModelShape documents that the request struct
// covers every field the store writes, so no authored column is dropped on the
// way in. A field added without a json tag would be silently ignored by the
// strict decode, so the wire names are asserted explicitly.
func TestCreateIdeaRequestRoundTripsModelShape(t *testing.T) {
	t.Parallel()
	raw, err := json.Marshal(createIdeaRequest{})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var keys map[string]json.RawMessage
	if err := json.Unmarshal(raw, &keys); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	for _, want := range []string{
		"title", "tagline", "domain", "difficulty", "estimatedHours",
		"originStory", "problemStatement", "technicalRequirements",
		"mockInfra", "tags", "suggestedStack", "regionalHurdles", "sourceUrl",
	} {
		if _, ok := keys[want]; !ok {
			t.Errorf("createIdeaRequest is missing the %q field on the wire", want)
		}
	}
	// The id is accepted for symmetry with the model but is ignored by
	// CreateIdea, which mints its own UUID.
	if _, ok := keys["id"]; !ok {
		t.Error("createIdeaRequest no longer carries an id field")
	}
}

// TestSetJobActiveRequest pins the body contract for
// POST /api/v1/jobs/{id}/active. The handler decodes with
// DisallowUnknownFields, and the field is `active`; a client that posts the
// job's own `isActive` key is refused rather than silently defaulting the job
// back to visible.
func TestSetJobActiveRequest(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name string
		body string
		want bool
	}{
		{"hides explicitly", `{"active":false}`, false},
		{"shows explicitly", `{"active":true}`, true},
		{"defaults to showing when the field is absent", `{}`, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			req := httptest.NewRequest(http.MethodPost, "/api/v1/jobs/some-id/active", strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			var got activeRequest
			if err := decodeOptionalJSON(httptest.NewRecorder(), req, &got); err != nil {
				t.Fatalf("body %s rejected: %v", tc.body, err)
			}
			if active := got.Active == nil || *got.Active; active != tc.want {
				t.Errorf("body %s resolved to active=%v, want %v", tc.body, active, tc.want)
			}
		})
	}

	t.Run("accepts an empty body", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodPost, "/api/v1/jobs/some-id/active", nil)
		var got activeRequest
		if err := decodeOptionalJSON(httptest.NewRecorder(), req, &got); err != nil {
			t.Fatalf("empty body rejected: %v", err)
		}
		if got.Active != nil {
			t.Errorf("empty body set Active=%v, want nil", *got.Active)
		}
	})

	t.Run("refuses the job's own isActive key", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodPost, "/api/v1/jobs/some-id/active",
			strings.NewReader(`{"isActive":false}`))
		req.Header.Set("Content-Type", "application/json")
		var got activeRequest
		if err := decodeOptionalJSON(httptest.NewRecorder(), req, &got); err == nil {
			t.Fatal("a job-shaped body decoded cleanly; DisallowUnknownFields should have refused it")
		}
	})
}
