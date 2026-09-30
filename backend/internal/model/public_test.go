package model

import "testing"

// TestPublicStripsPrivateFields pins what a visitor to /p/[slug] may see.
//
// The scrubber is the only thing between a dev's account and a public page, and
// it is a denylist, so every field added to UserProfile has to be added here or
// it ships. ContactEmail is the one that prompted this: it is a new column, and
// the whole reason the auth address is already stripped is that these are real,
// reachable addresses rather than display text.
//
// Role, Plan, and AuthProvider were stripped in the same pass: surfacing them
// let any caller enumerate the staff roster, billing tiers and identity
// providers for every dev on the platform.
func TestPublicStripsPrivateFields(t *testing.T) {
	t.Parallel()

	owner := UserProfile{
		Username:     "michojekunle",
		Name:         "Michael Ojekunle",
		Headline:     "Backend Engineer",
		Email:        "login@example.com",
		ContactEmail: "michael@work.example.com",
		HasAPIKey:    true,
		AuthProvider: "github",
		Role:         RoleAdmin,
		Plan:         "full-service",
		GitHubURL:    "https://github.com/michojekunle",
	}

	public := owner.Public()

	for _, tc := range []struct {
		field    string
		got      string
		wantGone bool
	}{
		{"Email", public.Email, true},
		{"ContactEmail", public.ContactEmail, true},
		{"AuthProvider", public.AuthProvider, true},
		{"Role", string(public.Role), true},
		{"Plan", public.Plan, true},
	} {
		if tc.wantGone && tc.got != "" {
			t.Errorf("public %s = %q, want stripped (private field)", tc.field, tc.got)
		}
	}

	if public.HasAPIKey {
		t.Error("public HasAPIKey = true, want false")
	}

	// The rest of the profile is the point of a public page and must survive.
	if public.Username != owner.Username || public.Name != owner.Name || public.Headline != owner.Headline {
		t.Errorf("public profile lost identity fields: %+v", public)
	}
	if public.GitHubURL != owner.GitHubURL {
		t.Errorf("public GitHubURL = %q, want %q", public.GitHubURL, owner.GitHubURL)
	}
}

// TestPublicDoesNotMutateReceiver guards the value-receiver copy. Public is
// called on values held elsewhere, including the one the request is about to
// serialize for the owner.
func TestPublicDoesNotMutateReceiver(t *testing.T) {
	t.Parallel()

	owner := UserProfile{Email: "login@example.com", ContactEmail: "michael@work.example.com"}
	_ = owner.Public()

	if owner.Email == "" || owner.ContactEmail == "" {
		t.Errorf("Public() mutated the receiver: %+v", owner)
	}
}
