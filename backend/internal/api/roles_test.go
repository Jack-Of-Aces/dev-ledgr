package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

// TestSetUserRoleRequest pins the body contract for
// PATCH /api/v1/admin/users/{id}/role. The handler decodes with
// DisallowUnknownFields, so a client that sends a whole profile instead of a
// role change is refused before the store is reached.
func TestSetUserRoleRequest(t *testing.T) {
	t.Parallel()

	t.Run("accepts each grantable role", func(t *testing.T) {
		t.Parallel()
		for _, role := range []string{"user", "reviewer", "admin"} {
			body := `{"role":"` + role + `"}`
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/users/some-id/role", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			var got roleUpdateRequest
			if err := decodeJSON(httptest.NewRecorder(), req, &got); err != nil {
				t.Fatalf("role %q rejected: %v", role, err)
			}
			if model.Role(got.Role) != model.Role(role) {
				t.Errorf("decoded role = %q, want %q", got.Role, role)
			}
		}
	})

	t.Run("accepts surrounding whitespace", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/users/some-id/role", strings.NewReader(`{"role":" reviewer "}`))
		req.Header.Set("Content-Type", "application/json")
		var got roleUpdateRequest
		if err := decodeJSON(httptest.NewRecorder(), req, &got); err != nil {
			t.Fatalf("padded role rejected: %v", err)
		}
		// The handler trims before checking, so a padded value that survived the
		// decode must still be a valid role once trimmed.
		if model.Role(strings.TrimSpace(got.Role)) != model.RoleReviewer {
			t.Errorf("trimmed role = %q, want %q", strings.TrimSpace(got.Role), model.RoleReviewer)
		}
	})

	// 'candidate' is the stored representation of RoleUser, not a role clients
	// may set. Accepting it would make two spellings of the same state.
	for _, tc := range []struct{ name, body string }{
		{"the stored candidate label", `{"role":"candidate"}`},
		{"an empty role", `{"role":""}`},
		{"an unknown role", `{"role":"superuser"}`},
		{"no role at all", `{}`},
	} {
		t.Run("refuses "+tc.name, func(t *testing.T) {
			t.Parallel()
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/users/some-id/role", strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			var got roleUpdateRequest
			if err := decodeJSON(httptest.NewRecorder(), req, &got); err != nil {
				return // the strict decode already refused it
			}
			if model.Role(strings.TrimSpace(got.Role)).Valid() {
				t.Fatalf("body %s yielded a valid role %q; it should not have passed validation", tc.body, got.Role)
			}
		})
	}

	t.Run("refuses a full profile body", func(t *testing.T) {
		t.Parallel()
		// What a client sending a UserProfile would post. Every field other than
		// role is server-owned and must not be settable through this route.
		req := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/users/some-id/role",
			strings.NewReader(`{"role":"reviewer","username":"attacker","plan":"byok","hasApiKey":true}`))
		req.Header.Set("Content-Type", "application/json")
		var got roleUpdateRequest
		if err := decodeJSON(httptest.NewRecorder(), req, &got); err == nil {
			t.Fatal("a profile-shaped body decoded cleanly; DisallowUnknownFields should have refused it")
		}
	})
}

// TestRoleFromDBRoundTrip guards the mapping the roster and the role endpoint
// both depend on: a role set through the API must read back as the same role.
func TestRoleFromDBRoundTrip(t *testing.T) {
	t.Parallel()
	for _, role := range []model.Role{model.RoleUser, model.RoleReviewer, model.RoleAdmin} {
		if got := model.RoleFromDB(model.RoleToDB(role)); got != role {
			t.Errorf("round trip of %q = %q (stored as %q)", role, got, model.RoleToDB(role))
		}
	}
	// Anything unrecognised must collapse to the base role rather than
	// acquiring a permission set the database did not intend to grant.
	for _, stored := range []string{"", "candidate", "owner", "ADMIN", "REVIEWER"} {
		if got := model.RoleFromDB(stored); got != model.RoleUser {
			t.Errorf("RoleFromDB(%q) = %q, want %q", stored, got, model.RoleUser)
		}
	}
}

// TestAssignRolesIsSeparateFromManagePlatform pins the split that lets a
// reviewer staff the review queue. assign_roles is granted to reviewers so they
// can promote peers; manage_platform is not, because it also guards job
// ingestion and problem seeding, which must stay admin-only. If these two ever
// merge again, a reviewer silently gains those.
func TestAssignRolesIsSeparateFromManagePlatform(t *testing.T) {
	t.Parallel()

	for role, want := range map[model.Role]bool{
		model.RoleUser:     false,
		model.RoleReviewer: true,
		model.RoleAdmin:    true,
	} {
		if got := model.HasPermission(role, model.PermAssignRoles); got != want {
			t.Errorf("HasPermission(%q, assign_roles) = %v, want %v", role, got, want)
		}
	}
	for role, want := range map[model.Role]bool{
		model.RoleUser:     false,
		model.RoleReviewer: false,
		model.RoleAdmin:    true,
	} {
		if got := model.HasPermission(role, model.PermManagePlatform); got != want {
			t.Errorf("HasPermission(%q, manage_platform) = %v, want %v", role, got, want)
		}
	}

	// The powers a reviewer exists for must survive the split.
	for _, p := range []model.Permission{
		model.PermStampSolution, model.PermReviewSubmissions, model.PermAssignRoles,
	} {
		if !model.HasPermission(model.RoleReviewer, p) {
			t.Errorf("reviewer lost %q", p)
		}
	}
	// Seeding problems stays admin-only even though reviewers assign roles.
	for _, p := range []model.Permission{model.PermSeedIdeas, model.PermManagePlatform} {
		if model.HasPermission(model.RoleReviewer, p) {
			t.Errorf("reviewer must not hold %q", p)
		}
	}
}

// TestRolePermissionsListsAreNotAliased guards the shared-slice bug the
// permission lists are exposed to: RolePermissions hands out package-level
// slices, and an append that reuses a backing array would give one role
// another's permissions.
func TestRolePermissionsListsAreNotAliased(t *testing.T) {
	t.Parallel()

	user := model.RolePermissions[model.RoleUser]
	reviewer := model.RolePermissions[model.RoleReviewer]
	admin := model.RolePermissions[model.RoleAdmin]

	if model.HasPermission(model.RoleUser, model.PermAssignRoles) {
		t.Error("the base role holds assign_roles; the role lists share a backing array")
	}
	if model.HasPermission(model.RoleUser, model.PermManagePlatform) {
		t.Error("the base role holds manage_platform; the role lists share a backing array")
	}
	if model.HasPermission(model.RoleReviewer, model.PermManagePlatform) {
		t.Error("reviewer holds manage_platform; the role lists share a backing array")
	}
	if len(user) >= len(reviewer) || len(reviewer) >= len(admin) {
		t.Errorf("permissions should grow user(%d) < reviewer(%d) < admin(%d)", len(user), len(reviewer), len(admin))
	}
	// admin is built from a clone of reviewer, so reviewer must not have gained
	// the admin-only entries.
	for _, p := range admin {
		if p == model.PermManagePlatform || p == model.PermSeedIdeas {
			continue
		}
		if !model.HasPermission(model.RoleReviewer, p) {
			t.Errorf("admin has %q but reviewer does not", p)
		}
	}
}
