package model

import "testing"

// Mirrors ROLE_PERMISSIONS in frontend/src/types/auth.ts. If this test fails,
// the frontend matrix and the API have drifted apart.
func TestRolePermissionsMatchFrontend(t *testing.T) {
	cases := []struct {
		role    Role
		perm    Permission
		allowed bool
	}{
		{RoleUser, PermSubmitSolution, true},
		{RoleUser, PermEditOwnProfile, true},
		{RoleUser, PermStampSolution, false},
		{RoleUser, PermSeedIdeas, false},
		{RoleReviewer, PermReviewSubmissions, true},
		{RoleReviewer, PermStampSolution, true},
		{RoleReviewer, PermSeedIdeas, false},
		{RoleReviewer, PermManagePlatform, false},
		{RoleAdmin, PermSeedIdeas, true},
		{RoleAdmin, PermManagePlatform, true},
		{Role("hacker"), PermViewIdeas, false},
	}
	for _, c := range cases {
		if got := HasPermission(c.role, c.perm); got != c.allowed {
			t.Errorf("HasPermission(%s, %s) = %v, want %v", c.role, c.perm, got, c.allowed)
		}
	}
	if n := len(RolePermissions[RoleUser]); n != 7 {
		t.Errorf("user has %d permissions, want 7", n)
	}
}
