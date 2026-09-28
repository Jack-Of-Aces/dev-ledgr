package ai

import (
	"strings"
	"testing"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

// TestContactEmailPrefersTheDevsChoice pins which address ends up in a
// generated CV.
//
// It used to be the auth address or nothing. So a dev who had set a separate
// recruiter address in settings was still having their sign-in address
// published to anyone the document was shared with, and the field they had
// edited was read by nothing. The order is: what the dev chose, then what they
// registered with, then a synthetic address.
func TestContactEmailPrefersTheDevsChoice(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name string
		user model.UserProfile
		want string
	}{
		{
			name: "the dev's contact address wins over the login address",
			user: model.UserProfile{Username: "mj", Email: "login@example.com", ContactEmail: "mj@work.example.com"},
			want: "mj@work.example.com",
		},
		{
			name: "falls back to the registered address when unset",
			user: model.UserProfile{Username: "mj", Email: "login@example.com"},
			want: "login@example.com",
		},
		{
			name: "synthetic address when the dev has neither",
			user: model.UserProfile{Username: "mj"},
			want: "mj@devledgr.me",
		},
		{
			// An empty contact address must not shadow the registered one.
			name: "empty contact address does not blank the result",
			user: model.UserProfile{Username: "mj", Email: "login@example.com", ContactEmail: ""},
			want: "login@example.com",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := contactEmail(tc.user); got != tc.want {
				t.Errorf("contactEmail() = %q, want %q", got, tc.want)
			}
		})
	}
}

// TestBuildCVUsesTheContactAddress checks the resolved address actually reaches
// the document. contactEmail is unexported and easy to leave unwired.
func TestBuildCVUsesTheContactAddress(t *testing.T) {
	t.Parallel()

	u := model.UserProfile{
		Username:     "mj",
		Name:         "Michael Ojekunle",
		Headline:     "Backend Engineer",
		Email:        "login@example.com",
		ContactEmail: "mj@work.example.com",
	}

	cv := buildCV(u, nil)

	if !strings.Contains(cv, "mj@work.example.com") {
		t.Errorf("CV does not carry the contact address the dev chose:\n%s", cv)
	}
	if strings.Contains(cv, "login@example.com") {
		t.Errorf("CV leaked the login address despite an explicit contact address:\n%s", cv)
	}
}
