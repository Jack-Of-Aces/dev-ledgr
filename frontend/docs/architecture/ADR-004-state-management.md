# ADR-004: State Management (Zustand + Custom Hooks)

**Date:** 2026-09-25  
**Status:** Accepted  
**Deciders:** DevLedgr Core Team

---

## Context

DevLedgr's UI is highly interactive: real-time AI terminal logs, optimistic profile edits,
toast notifications, theme preferences, and role-based conditional rendering all require
shared state that is:
- Fast (no unnecessary re-renders)
- Persistent across pages (without full-page reloads)
- Easy to reason about from the outside (no magic context pyramids)

---

## Decision

### Two-tier state architecture:

**Tier 1 — `zustand` store (`src/lib/store.ts`):**
- Global reactive cache for UI state and fast in-memory domain objects.
- Persisted to `localStorage` via `zustand/middleware/persist` (`devledgr_storage_v1`).
- Contains: `user`, `submissions`, `ideas`, `jobs`, `theme`, `isLoggedIn`, toast state.
- **Rule**: Store is the source of truth for **current UI state**. The service layer handles I/O.

**Tier 2 — Custom Hooks (thin orchestrators):**
- `useAuth()` — auth lifecycle, role checks, `can(permission)`
- `useProfile()` — Zod validation, optimistic updates, rollback on failure
- Each hook encapsulates one business concern and delegates to one service.

**Separation rule:**
> Components call hooks. Hooks call services. Services call HTTP or mocks.
> Components **never** import from `@/services/**` directly.

---

## Tools Used

| Concern | Choice |
|---|---|
| Global state | `zustand` v5 with `persist` middleware |
| Form validation | `zod` (schema-driven, type-inferred) |
| Optimistic updates | Manual rollback pattern in `useProfile()` |
| Theme persistence | `data-theme` attribute on `<html>` synced to localStorage |

---

## Rejected Alternatives

| Option | Reason Rejected |
|---|---|
| React Context + `useReducer` | Verbose; causes re-renders across unrelated subtrees |
| Redux Toolkit | Too much boilerplate for a focused MVP; `zustand` achieves the same with far less code |
| `react-query` cache as global state | Designed for server state, not UI preferences or auth state |
| Jotai | Valid alternative, but team has more experience with `zustand`'s `set()` model |

---

## Consequences

- All new UI state must go through the `useAppStore` slice or a new custom hook.
- Optimistic updates in `useProfile` must always store a `previousValue` before mutation and restore it in the `catch` block.
- Components should select only the slices they need (e.g. `const { user } = useAppStore()`) to avoid unnecessary re-renders.
