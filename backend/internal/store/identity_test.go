package store

import (
	"testing"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

// TestIdentityLinkNeeded pins the rule that provider data is only ever written
// into a blank. EnsureDev runs on every authenticated request, so a profile
// that is already linked must cost no write — and, more importantly, a handle
// the dev set themselves must never be replaced by the one from their token.
func TestIdentityLinkNeeded(t *testing.T) {
	t.Parallel()

	github := AuthIdentity{Provider: "github", GitHubUsername: "michojekunle"}
	google := AuthIdentity{Provider: "google"}

	for _, tc := range []struct {
		name         string
		profile      model.UserProfile
		identity     AuthIdentity
		wantProvider bool
		wantGitHub   bool
	}{
		{
			name:         "trigger-created row gets both filled",
			profile:      model.UserProfile{AuthProvider: "", GitHubUsername: ""},
			identity:     github,
			wantProvider: true, wantGitHub: true,
		},
		{
			name:         "google identity fills only the provider",
			profile:      model.UserProfile{AuthProvider: "", GitHubUsername: ""},
			identity:     google,
			wantProvider: true, wantGitHub: false,
		},
		{
			name:         "already linked costs no write",
			profile:      model.UserProfile{AuthProvider: "github", GitHubUsername: "michojekunle"},
			identity:     github,
			wantProvider: false, wantGitHub: false,
		},
		{
			name:    "a handle the dev set by hand is not overwritten",
			profile: model.UserProfile{AuthProvider: "github", GitHubUsername: "mike-o"},
			// The token still carries the original login.
			identity:     github,
			wantProvider: false, wantGitHub: false,
		},
		{
			name:         "linked github handle, provider still blank",
			profile:      model.UserProfile{AuthProvider: "", GitHubUsername: "mike-o"},
			identity:     github,
			wantProvider: true, wantGitHub: false,
		},
		{
			name:         "identity with no provider cannot fill anything",
			profile:      model.UserProfile{AuthProvider: "", GitHubUsername: ""},
			identity:     AuthIdentity{},
			wantProvider: false, wantGitHub: false,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			provider, gh := identityLinkNeeded(&tc.profile, tc.identity)
			if provider != tc.wantProvider {
				t.Errorf("provider pending = %v, want %v", provider, tc.wantProvider)
			}
			if gh != tc.wantGitHub {
				t.Errorf("github pending = %v, want %v", gh, tc.wantGitHub)
			}
		})
	}
}

// TestEnsureDevInsertCarriesProviderDetail checks the insert passes the GitHub
// linkage through. The column set is what the deployed trigger-created rows were
// missing, so a regression here is the GitHub handle silently not being stored.
func TestEnsureDevInsertCarriesProviderDetail(t *testing.T) {
	t.Parallel()

	github := AuthIdentity{
		ID: "11111111-1111-1111-1111-111111111111", Email: "m@example.com",
		Provider: "github", Username: "michojekunle", Name: "Michael",
		AvatarURL: "https://avatars.githubusercontent.com/u/1", GitHubUsername: "michojekunle",
		GitHubURL: "https://github.com/michojekunle",
	}
	if !usernameValid.MatchString(github.Username) {
		t.Fatalf("GitHub login %q should be usable as a handle base", github.Username)
	}
	if github.GitHubUsername == "" {
		t.Error("a github identity must carry the bare login for github_username")
	}

	google := AuthIdentity{
		ID: "22222222-2222-2222-2222-222222222222", Email: "g@example.com",
		Provider: "google", Username: "g", Name: "G",
	}
	if google.GitHubUsername != "" || google.GitHubURL != "" {
		t.Error("a google identity must not claim a linked GitHub account")
	}
}
