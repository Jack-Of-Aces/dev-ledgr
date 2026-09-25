# ADR-002: Authentication Strategy & Providers

**Date:** 2026-09-25  
**Status:** Accepted  
**Deciders:** DevLedgr Core Team

---

## Context

DevLedgr has two distinct user audiences:

1. **Developers** — need GitHub identity (their ledger commits are linked to GitHub repos).
2. **Recruiters / Reviewers** — may not have GitHub; prefer passwordless options.

We also needed to make the product **fully evaluable offline** during the pre-backend MVP phase,
without shipping real credentials in the repo or forcing evaluators through OAuth setup.

---

## Decision

### Three supported sign-in methods:

| Provider | When Used | Flow |
|---|---|---|
| **GitHub OAuth** | `NEXT_PUBLIC_GITHUB_CLIENT_ID` is set in env | PKCE redirect → `/api/auth/callback/github` → session cookie |
| **Email Magic Link** | Always available | Email → backend sends link → `/api/auth/magic?token=...` → session cookie |
| **Instant Dev Persona Sandbox** | Always available (especially when no backend) | One-click → sets mock session cookies + Zustand state immediately |

### Two sign-in entry points (same `IAuthService` underneath):

| Entry Point | When Triggered | UX Behaviour |
|---|---|---|
| `/login` page | Direct navigation, expired session, email links | Full-page, shareable URL, callbackUrl query param |
| `<AuthModal>` | Contextual (e.g. clicking "Submit Solution" on an idea) | Overlay, preserves page scroll and draft state |

### Session persistence:

Sessions are synced via two client-set cookies:
- `devledgr_session` — opaque token string
- `devledgr_role` — `user | reviewer | admin`

These are read by Next.js Edge Middleware before page HTML renders, enabling server-side redirect
decisions without a database round-trip.

---

## Tools / Libraries Used

| Concern | Choice |
|---|---|
| Auth hooks | Custom `useAuth()` wrapping `IAuthService` |
| Session cookies | `js-cookie`-style helpers in `src/lib/cookies.ts` |
| Navigation post-auth | `useRouter().push()` (not `window.location`) |
| Edge protection | Next.js `middleware.ts` (to be renamed `proxy.ts` per Next.js 16.3+ convention) |

---

## Rejected Alternatives

| Option | Reason Rejected |
|---|---|
| NextAuth.js | Overkill for MVP; tightly couples auth to specific Next.js API routes; hard to swap for custom backend |
| JWT in localStorage | XSS attack surface; cookies with HttpOnly are safer at production |
| Single entry point only | Product research: users arrive from email links, shared URLs, and in-app prompts — two entry points serve all journeys |

---

## Consequences

- `authService` must be the single source of truth for session state.
- Never read `localStorage` directly in components — always read from `useAuth()` / `useAppStore()`.
- When real backend is ready: only `AuthService` changes; `useAuth`, `AuthModal`, and `/login` stay untouched.
