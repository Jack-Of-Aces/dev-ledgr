package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"maps"
	"net/http/httptest"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

// decodeInto runs a payload through the real strict decoder, so these tests
// fail on an unknown field exactly as a live request would. Server.store is a
// concrete *store.Store rather than an interface, so handler tests would need a
// database; the decoder and the validator are pure, so they are exercised here.
func decodeInto(t *testing.T, payload map[string]any, dst any) error {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	r := httptest.NewRequest("PATCH", "/api/v1/users/me", bytes.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	return decodeJSON(httptest.NewRecorder(), r, dst)
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// settingsPayload is the shape frontend/src/app/settings/page.tsx sends. Every
// key here must be accepted by profileUpdateRequest: decodeJSON runs with
// DisallowUnknownFields, so a single unrecognised key 400s the entire save.
func settingsPayload() map[string]any {
	return map[string]any{
		"name":                "Michael Ojekunle",
		"headline":            "Backend Engineer building ledgers",
		"bio":                 "Systems person.",
		"githubUrl":           "https://github.com/michojekunle",
		"contactEmail":        "michael@work.example.com",
		"plan":                "free",
		"statedSkills":        []string{"Go", "PostgreSQL"},
		"engineeringTrack":    "backend-systems",
		"targetRole":          "Backend Engineer",
		"experienceLevel":     "senior",
		"githubUsername":      "michojekunle",
		"githubConnected":     true,
		"onboardingCompleted": true,
	}
}

// TestProfileUpdateAcceptsSettingsFormFields is the regression test for the
// reported failure: saving settings returned "unknown field engineeringTrack",
// because the form collected six onboarding fields the API had no case for.
// DisallowUnknownFields makes that a hard 400, so nothing saved at all.
func TestProfileUpdateAcceptsSettingsFormFields(t *testing.T) {
	t.Parallel()

	var req profileUpdateRequest
	if err := decodeInto(t, settingsPayload(), &req); err != nil {
		t.Fatalf("settings form payload rejected: %v", err)
	}
	if err := req.validate(); err != nil {
		t.Fatalf("settings form payload failed validation: %v", err)
	}

	// Spot-check that the values survived decoding rather than just being allowed.
	if got := deref(req.ContactEmail); got != "michael@work.example.com" {
		t.Errorf("ContactEmail = %q, want %q", got, "michael@work.example.com")
	}
	if got := deref(req.EngineeringTrack); got != "backend-systems" {
		t.Errorf("EngineeringTrack = %q, want %q", got, "backend-systems")
	}
	if got := deref(req.TargetRole); got != "Backend Engineer" {
		t.Errorf("TargetRole = %q, want %q", got, "Backend Engineer")
	}
	if got := deref(req.ExperienceLevel); got != "senior" {
		t.Errorf("ExperienceLevel = %q, want %q", got, "senior")
	}
	if req.GitHubConnected == nil || !*req.GitHubConnected {
		t.Error("GitHubConnected did not decode as true")
	}
	if req.OnboardingCompleted == nil || !*req.OnboardingCompleted {
		t.Error("OnboardingCompleted did not decode as true")
	}
}

// TestProfileUpdateRejectsUnknownVocabularies proves the new fields are
// validated rather than stored blindly: a value the frontend could never
// produce must not reach the database.
func TestProfileUpdateRejectsUnknownVocabularies(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name  string
		key   string
		value any
		field string
	}{
		{"track", "engineeringTrack", "backend_systems", "engineeringTrack"},
		{"empty-ish track", "engineeringTrack", "unknown-track", "engineeringTrack"},
		{"level", "experienceLevel", "principal", "experienceLevel"},
		{"github handle", "githubUsername", "not a handle!", "githubUsername"},
		{"short github handle", "githubUsername", "ab", "githubUsername"},
		{"long target role", "targetRole", strings.Repeat("x", 81), "targetRole"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			payload := settingsPayload()
			payload[tc.key] = tc.value

			var req profileUpdateRequest
			if err := decodeInto(t, payload, &req); err != nil {
				t.Fatalf("decode: %v", err)
			}
			err := req.validate()
			if err == nil {
				t.Fatalf("validate accepted %s=%v", tc.key, tc.value)
			}
			// The per-field messages live in apiError.Errors, which the frontend
			// httpClient reads; the top-level message is the generic
			// "Validation failed".
			var apiErr *apiError
			if !errors.As(err, &apiErr) {
				t.Fatalf("validate returned %T, want *apiError", err)
			}
			if len(apiErr.Errors[tc.field]) == 0 {
				t.Errorf("no message for field %q; got fields %v", tc.field, slices.Collect(maps.Keys(apiErr.Errors)))
			}
		})
	}
}

// TestProfileUpdateAcceptsEmptyOnboardingFields covers a profile that has never
// onboarded. The form sends defaults rather than omitting them, so rejecting
// empty strings here would make a first save impossible.
func TestProfileUpdateAcceptsEmptyOnboardingFields(t *testing.T) {
	t.Parallel()

	payload := settingsPayload()
	payload["engineeringTrack"] = ""
	payload["targetRole"] = ""
	payload["experienceLevel"] = ""
	payload["githubUsername"] = ""

	var req profileUpdateRequest
	if err := decodeInto(t, payload, &req); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if err := req.validate(); err != nil {
		t.Fatalf("empty onboarding fields rejected: %v", err)
	}
	if got := deref(req.EngineeringTrack); got != "" {
		t.Errorf("EngineeringTrack = %q, want empty", got)
	}
}

// TestProfileUpdateRejectsLegacyEmailKey is the regression test for a field with
// nowhere to go.
//
// The settings form had an editable address labelled "used exclusively for
// receiving high-signal match inquiries from hiring managers". The request
// struct accepted "email" and then never used it, so the save returned 200 and
// the edit was gone with no error anywhere. It is now "contactEmail" and is
// stored, and the old key is rejected outright rather than silently dropped: a
// stale client that still sends "email" would otherwise keep losing the edit
// with nothing to show for it.
func TestProfileUpdateRejectsLegacyEmailKey(t *testing.T) {
	t.Parallel()

	payload := settingsPayload()
	delete(payload, "contactEmail")
	payload["email"] = "michael@example.com"

	var req profileUpdateRequest
	err := decodeInto(t, payload, &req)
	if err == nil {
		t.Fatal(`"email" was accepted; it is not a settable field and must not be ` +
			"silently discarded, because that is how the dev's edit was lost in the first place")
	}
	if !strings.Contains(err.Error(), "email") {
		t.Errorf("error = %q, want it to name the rejected field", err)
	}
}

// TestProfileUpdateValidatesContactEmail covers the shape check, including the
// empty case: leaving the field blank means "use my registered address" and is
// how a dev with no separate contact address stores their profile.
func TestProfileUpdateValidatesContactEmail(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name    string
		value   any
		wantErr bool
	}{
		{name: "empty is allowed and means fall back", value: ""},
		{name: "omitted is allowed", value: nil, wantErr: false},
		{name: "ordinary address", value: "michael@work.example.com"},
		{name: "no at sign", value: "michael.example.com", wantErr: true},
		{name: "no domain dot", value: "michael@localhost", wantErr: true},
		{name: "no local part", value: "@example.com", wantErr: true},
		{name: "no domain part", value: "michael@", wantErr: true},
		{name: "trailing dot", value: "michael@example.", wantErr: true},
		{name: "embedded space", value: "michael o@example.com", wantErr: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			payload := settingsPayload()
			if tc.value == nil {
				delete(payload, "contactEmail")
			} else {
				payload["contactEmail"] = tc.value
			}

			var req profileUpdateRequest
			if err := decodeInto(t, payload, &req); err != nil {
				t.Fatalf("decode: %v", err)
			}
			err := req.validate()

			if tc.wantErr {
				var apiErr *apiError
				if !errors.As(err, &apiErr) {
					t.Fatalf("validate() = %v, want a validation error", err)
				}
				if _, reported := apiErr.Errors["contactEmail"]; !reported {
					t.Errorf("errors = %v, want one keyed contactEmail", apiErr.Errors)
				}
				return
			}
			if err != nil {
				t.Fatalf("validate() = %v, want accepted", err)
			}
		})
	}
}

// TestProfileUpdateTrimsAndNormalizes pins the normalization the write path
// relies on, so a stray space or leading @ never reaches the column.
func TestProfileUpdateTrimsAndNormalizes(t *testing.T) {
	t.Parallel()

	payload := settingsPayload()
	payload["targetRole"] = "  Backend Engineer  "
	payload["experienceLevel"] = " mid "
	payload["githubUsername"] = "@michojekunle"

	var req profileUpdateRequest
	if err := decodeInto(t, payload, &req); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if err := req.validate(); err != nil {
		t.Fatalf("validate: %v", err)
	}
	if got := deref(req.TargetRole); got != "Backend Engineer" {
		t.Errorf("TargetRole = %q, want trimmed", got)
	}
	if got := deref(req.ExperienceLevel); got != "mid" {
		t.Errorf("ExperienceLevel = %q, want trimmed", got)
	}
	if got := deref(req.GitHubUsername); got != "michojekunle" {
		t.Errorf("GitHubUsername = %q, want the @ stripped", got)
	}
}

// TestEngineeringTracksMatchFrontend guards the vocabulary the API validates
// against. The frontend keys ENGINEERING_TRACKS by this same set, so a track
// added there but not here is one the API would reject.
func TestEngineeringTracksMatchFrontend(t *testing.T) {
	t.Parallel()

	want := []string{
		"devops-infra", "backend-systems", "frontend-ui", "fullstack",
		"product-design", "ai-ml", "mobile",
	}
	if len(model.EngineeringTracks) != len(want) {
		t.Fatalf("EngineeringTracks has %d entries, want %d: %v",
			len(model.EngineeringTracks), len(want), model.EngineeringTracks)
	}
	for i, track := range want {
		if model.EngineeringTracks[i] != track {
			t.Errorf("EngineeringTracks[%d] = %q, want %q", i, model.EngineeringTracks[i], track)
		}
	}
}

// TestProfileVocabulariesAreDisjoint guards against a typo making the two
// onboarding enums accept each other's values.
func TestProfileVocabulariesAreDisjoint(t *testing.T) {
	t.Parallel()
	for _, track := range model.EngineeringTracks {
		for _, level := range model.ExperienceLevels {
			if track == level {
				t.Errorf("%q appears in both the track and the experience-level vocabulary", track)
			}
		}
	}
}

// TestProfileUpdateRequestCoversEverySettingsField pins the contract by
// reflection rather than by one example payload. decodeJSON rejects unknown
// fields, so the failure mode is silent until someone adds an input to the
// settings form: the save 400s and the dev's edits are lost. Adding a field to
// the form without adding it here is the bug this catches.
func TestProfileUpdateRequestCoversEverySettingsField(t *testing.T) {
	t.Parallel()

	accepted := map[string]bool{}
	typ := reflect.TypeOf(profileUpdateRequest{})
	for i := 0; i < typ.NumField(); i++ {
		tag := typ.Field(i).Tag.Get("json")
		name, _, _ := strings.Cut(tag, ",")
		if name != "" && name != "-" {
			accepted[name] = true
		}
	}

	for key := range settingsPayload() {
		if !accepted[key] {
			t.Errorf("profileUpdateRequest has no field for %q; the settings form sends it, "+
				"and DisallowUnknownFields will reject the whole save", key)
		}
	}
}
