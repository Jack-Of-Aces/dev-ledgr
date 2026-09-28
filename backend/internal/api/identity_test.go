package api

import (
	"reflect"
	"testing"
)

// TestIdentityFromClaimsExtractsProviderDetail pins the mapping from a Supabase
// session onto the dev record.
//
// The GitHub linkage used to live only in the browser: the API read only the
// provider's profile URL out of the token and stored nothing else, so the
// authoritative dev record came back with no provider and no handle. Every page
// that asked "is this a GitHub user?" was reading a value that had already been
// overwritten by the time it rendered.
func TestIdentityFromClaimsExtractsProviderDetail(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name           string
		userMeta       map[string]any
		appMeta        map[string]any
		wantProvider   string
		wantGitHubUser string
		wantGitHubURL  string
	}{
		{
			name:           "github login",
			userMeta:       map[string]any{"user_name": "michojekunle", "full_name": "Michael O", "avatar_url": "https://a/1.png"},
			appMeta:        map[string]any{"provider": "github"},
			wantProvider:   "github",
			wantGitHubUser: "michojekunle",
			wantGitHubURL:  "https://github.com/michojekunle",
		},
		{
			name:           "github preferred_username fallback",
			userMeta:       map[string]any{"preferred_username": "mj-o"},
			appMeta:        map[string]any{"provider": "github"},
			wantProvider:   "github",
			wantGitHubUser: "mj-o",
			wantGitHubURL:  "https://github.com/mj-o",
		},
		{
			name:         "google carries no github linkage",
			userMeta:     map[string]any{"full_name": "Michael O", "picture": "https://a/g.png"},
			appMeta:      map[string]any{"provider": "google"},
			wantProvider: "google",
		},
		{
			name:         "github without a login does not fabricate one",
			userMeta:     map[string]any{"full_name": "Michael O"},
			appMeta:      map[string]any{"provider": "github"},
			wantProvider: "github",
		},
		{
			name:     "no provider metadata",
			userMeta: map[string]any{"full_name": "Michael O"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			id := identityFromClaims("11111111-1111-1111-1111-111111111111", "m@example.com", tc.userMeta, tc.appMeta)

			if id.Provider != tc.wantProvider {
				t.Errorf("Provider = %q, want %q", id.Provider, tc.wantProvider)
			}
			if id.GitHubUsername != tc.wantGitHubUser {
				t.Errorf("GitHubUsername = %q, want %q", id.GitHubUsername, tc.wantGitHubUser)
			}
			if id.GitHubURL != tc.wantGitHubURL {
				t.Errorf("GitHubURL = %q, want %q", id.GitHubURL, tc.wantGitHubURL)
			}
		})
	}
}

// TestProfileUpdateRejectsAuthProvider guards the provenance boundary.
//
// auth_provider says which identity provider the account was created with. It
// is server-derived, and must stay that way: a dev able to write it could make
// the app treat their Google account as a GitHub one, which is exactly the
// check that gates the GitHub verification gate in settings and onboarding.
// github_connected is the user-settable field and is a different thing.
func TestProfileUpdateRejectsAuthProvider(t *testing.T) {
	t.Parallel()

	typ := reflect.TypeOf(profileUpdateRequest{})
	for i := 0; i < typ.NumField(); i++ {
		if name := typ.Field(i).Tag.Get("json"); name == "authProvider" {
			t.Fatal("authProvider is settable through PATCH /api/v1/users/me; " +
				"it describes provenance and must stay server-derived")
		}
	}

	// The field a dev *can* set, to link a GitHub account to a Google login.
	typ = reflect.TypeOf(profileUpdateRequest{})
	hasGitHubConnected := false
	for i := 0; i < typ.NumField(); i++ {
		if typ.Field(i).Tag.Get("json") == "githubConnected" {
			hasGitHubConnected = true
		}
	}
	if !hasGitHubConnected {
		t.Error("githubConnected must stay settable: linking GitHub to a Google account is a user action")
	}
}
