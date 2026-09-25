# ADR-001: Service Layer & Adapter / Fallback Pattern

**Date:** 2026-09-25  
**Status:** Accepted  
**Deciders:** DevLedgr Core Team

---

## Context

The backend API and AI gateway do not exist yet. The frontend must still be fully functional for
demos, investor reviews, and developer evaluation — while being **completely ready to connect** to
real backends the moment they are deployed.

We needed a pattern that:
- Made backend connectivity **optional at runtime**, not optional at code-level.
- Prevented "zombie fallbacks" on writes (i.e. the UI lying to the user that a save succeeded).
- Was extensible to multiple services (auth, users, ideas, submissions, AI).

---

## Decision

We adopted the **Service Interface + Adapter + Fallback Decorator** pattern:

```
IXxxService (interface)
    ├── MockXxxService   → deterministic, seeded fake data
    └── XxxService       → real HTTP adapter, with conditional delegation to Mock
```

**One exported singleton per domain** (`authService`, `userService`, `aiService`, …) is consumed
by the rest of the app. The singleton chooses its adapter at construction time based on:

```ts
const useMocks = !envConfig.apiUrl || envConfig.useMocks;
```

**Mutation safety rule (hard constraint):**
> Read operations (`GET`) **may** fall back to mock data with an `[Offline Preview]` badge.
> Write operations (`POST / PUT / DELETE`) **must never silently fall back** — they throw an
> `ApiError` so callers can surface a retry UI to the user.

---

## Tools / Libraries Used

| Concern | Choice | Rationale |
|---|---|---|
| HTTP client | Native `fetch` | No extra dependency, built-in `AbortController` for timeouts |
| Schema validation | `zod` v4 | Type inference from schemas, best-in-class error messages |
| State management | `zustand` | Minimal boilerplate, fine-grained subscriptions |
| Type system | TypeScript strict mode | Compile-time safety across all service boundaries |

---

## Rejected Alternatives

| Option | Reason Rejected |
|---|---|
| `axios` | Unnecessary ~14KB dependency when `fetch` with `AbortController` covers the same surface |
| `react-query` / `SWR` | Premature: adds complexity before real API exists; easy to add later on top of service layer |
| Direct `fetch` in components | Violates SRP; untestable; couples UI to transport layer |

---

## Consequences

- Any new backend service requires: one interface file, one mock adapter, one real adapter.
- Swapping adapters (e.g., REST → GraphQL) requires changing only the concrete adapter, not the hooks or components.
- Build & lint must pass with `0 errors` before merging — the service layer is the most critical seam.
