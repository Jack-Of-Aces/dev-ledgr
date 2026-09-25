# ADR-003: RBAC & Route Protection (Edge + Client)

**Date:** 2026-09-25  
**Status:** Accepted  
**Deciders:** DevLedgr Core Team

---

## Context

DevLedgr has three user roles with different capabilities:

| Role | Description |
|---|---|
| `user` | Standard developer — can submit solutions, apply to jobs, use AI coaching |
| `reviewer` | Platform auditor — can review and annotate submissions |
| `admin` | Full platform access — all `reviewer` capabilities plus admin console |

We needed to enforce these boundaries at two levels:
1. **Server-side** — prevent leaking admin HTML to unauthorized users.
2. **Client-side** — provide helpful, contextual UI feedback (not a hard crash).

---

## Decision

### Dual-layer protection:

**Layer 1 — Edge Middleware (`src/middleware.ts`):**
- Runs before any page renders using Next.js Edge Runtime (no Node.js APIs).
- Reads `devledgr_session` and `devledgr_role` cookies.
- Decision table:

| Route | No session cookie | Wrong role |
|---|---|---|
| `/dashboard`, `/settings` | Redirect → `/login?callbackUrl=...` | Redirect → `/login` |
| `/admin` | Redirect → `/login` | Rewrite → `/403` (Access Denied) |

**Layer 2 — Client Guard (`<AuthGuard>`):**
- Wraps page content with role checking.
- Shows a contextual "sign in" state instead of a loading spinner or blank screen.
- Does NOT replace Edge middleware — it handles cases where client-side navigation bypasses the server check.

### Permission matrix (`ROLE_PERMISSIONS` in `src/types/auth.ts`):

```ts
user:     ['view_ideas', 'submit_solution', 'view_dashboard', 'edit_own_profile', 'use_ai_scrutiny']
reviewer: [...user, 'review_submissions', 'view_admin']
admin:    [...reviewer, 'manage_users', 'manage_ideas', 'manage_jobs']
```

---

## Tools Used

| Concern | Choice |
|---|---|
| Edge protection | Next.js `middleware.ts` (Edge Runtime) |
| Client protection | `<AuthGuard requireRole="admin">` component |
| Permission checks | `hasPermission(session, 'permission_name')` pure function |
| Dev persona switching | `<RoleSwitcher>` floating toolbar |

---

## Rejected Alternatives

| Option | Reason Rejected |
|---|---|
| Client-only guards | Server sends admin HTML to any user who knows the URL |
| Server Components only | Admin UX is highly interactive; RSC alone can't provide contextual error states |
| Third-party RBAC library | Overkill; the permission matrix is simple enough to own with a 30-line TypeScript utility |

---

## Consequences

- Any new protected route must be added to **both** `middleware.ts` (the `PROTECTED_ROUTES` / `ADMIN_ROUTES` constants) and wrapped with `<AuthGuard>`.
- Role changes (e.g. promoting a user to reviewer) require updating both the session cookie AND the Zustand store — handled by `useAuth().switchRole()`.
- The `middleware.ts` file should be renamed to `proxy.ts` when upgrading to Next.js 16.4+.
