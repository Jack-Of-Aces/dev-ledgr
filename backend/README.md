# DevLedgr API (Go)

The REST backend for the DevLedgr frontend. It implements the contracts in
`frontend/src/services/*` and the backend section of
`DevLedgr_Architecture_Team_Blueprint.pdf`, using Supabase Postgres for storage.

- Go 1.25, standard-library `net/http` router, `pgx/v5`
- Responses are the raw objects the frontend types expect (`IdeaItem[]`, `UserProfile`, ...)
- Errors use the frontend's `ApiErrorPayload` shape: `{ message, statusCode, code, errors? }`
- Writes never fake success. Every failed mutation returns a non-2xx status (the blueprint's mutation safety rule).

## Quick start

```bash
cd backend
cp .env.example .env         # fill in DATABASE_URL at minimum
go run ./cmd/api seed        # apply migrations + load the demo Idea Bank, jobs, coaching and ledger
go run ./cmd/api             # serve on :8080 (migrations run on every start)
go test ./...
```

Then point the frontend at it (`frontend/.env.local`):

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_USE_MOCKS=false
# AIService only calls the API when this is non-empty; it still posts to NEXT_PUBLIC_API_URL.
NEXT_PUBLIC_AI_GATEWAY_URL=http://localhost:8080
```

### Supabase setup

1. Create a project and copy the connection string from **Project Settings → Database**.
   The direct connection (5432) and the transaction pooler (6543) both work.
2. Set it as `DATABASE_URL`. The API creates its tables on startup (`internal/db/migrations`).
3. Every table has **Row Level Security enabled with no policies**. Supabase's auto-generated REST API
   (anon and authenticated keys) therefore cannot read or write DevLedgr data. Only this service,
   connecting as `postgres`, can. Do not add permissive policies unless you mean to expose a table publicly.

## Authentication

Sessions are opaque 256-bit tokens. Only their SHA-256 hash is stored (`sessions` table).
The login endpoints return a `UserSession` (`{ token, username, name, role, avatarUrl, expiresAt }`) and set:

| Cookie | Flags | Purpose |
|---|---|---|
| `devledgr_session` | HttpOnly, SameSite=Lax | Session token |
| `devledgr_role` | SameSite=Lax | Routing hint for `proxy.ts`. The API never trusts it and always authorizes against the role in the database. |

Requests authenticate with `Authorization: Bearer <token>` (what `httpClient.ts` sends) or the session cookie.
RBAC uses the same permission matrix as `frontend/src/types/auth.ts`, and a unit test fails if the two drift apart.

## Endpoints

All paths are prefixed with `/api/v1`, matching the frontend services. Auth: `-` public, `auth` any signed-in user,
otherwise the permission required.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/github` | - | `{ code, redirectUri? }` → `UserSession`. Exchanges the OAuth code with GitHub. |
| POST | `/auth/magic-link` | - | `{ email }` → `{ success, message }`. Single-use link, 15 min TTL, 3 per email per 15 min. |
| POST | `/auth/magic-link/verify` | - | `{ token }` → `UserSession`. Creates the account on first sign-in. |
| POST | `/auth/logout` | - | Revokes the session and clears cookies. 204. |
| GET | `/auth/me` | auth | Current `UserSession`. |
| POST | `/auth/dev/login` | - | `{ username, name?, role }`. Persona sandbox. Only when `ENABLE_DEV_LOGIN=true`, never in production. |
| GET | `/users/me` | auth | Full `UserProfile` (the BYOK key is never returned; see `hasApiKey`). |
| PATCH, PUT | `/users/me` | `edit_own_profile` | Body = `UserProfileUpdateSchema`. Omitted optional fields keep their value. |
| GET | `/users/available?username=` | - | `{ available }` |
| GET | `/users/{username}` | - | Public profile (email hidden unless you are the owner). |
| GET | `/ideas?domain=&difficulty=&search=` | - | `IdeaItem[]` |
| GET | `/ideas/{id}` | - | `IdeaItem` |
| POST | `/ideas` | `seed_ideas` | `Omit<IdeaItem, 'submissionCount'>` → 201 |
| GET | `/submissions?username=&status=` | - | `SubmissionEntry[]`, newest first |
| GET | `/submissions/{hash}` | - | `SubmissionEntry` |
| POST | `/submissions` | `submit_solution` | `CreateSubmissionInput` + optional `commitHash`, `prNumber`. The author is always the caller. Created as `pending`. |
| POST | `/submissions/{hash}/verify` | `stamp_solution` | Optional `{ testResults?, metrics?, notes? }`. Issues the 365-day certificate. |
| POST | `/submissions/{hash}/reject` | `review_submissions` | `{ notes }` (required) |
| GET | `/submissions/{hash}/certificate` | - | `{ valid, expired, reason?, certificate, submission }`. Public stamp verification. |
| GET | `/jobs`, `/jobs/{id}` | - | `JobOpportunity` |
| POST | `/jobs` | `manage_platform` | `JobOpportunity` → 201 |
| GET | `/coaching`, `/coaching/{id}` | - | `CoachingItinerary` |
| POST | `/ai/scrutiny` | `apply_job` | `{ jobId, forceGap? }` → `ScrutinyResult`. Send `Accept: text/event-stream` to stream `log` events, then a `result` event. |
| POST | `/ai/coach` | `run_ai_coach` | `CoachPromptParams` → `{ advice, engine }` |
| GET | `/healthz`, `/readyz` | - | Liveness, and readiness including a database ping |

### Ledger stamping

`POST /submissions/{hash}/verify` requires all harness tests to pass (`passed == total`). With no telemetry
(a manual review) it records the suite as "Manual Reviewer Audit". Reviewers cannot stamp their own submissions,
and a submission can be reviewed only once.

The certificate is an HMAC-SHA256 (keyed by `SESSION_SECRET`) over the submission hash, idea, author, repo,
commit SHA, test results and validity window. `GET /submissions/{hash}/certificate` recomputes it, so any later
edit to the recorded submission shows `valid: false`. Stamping also extends the author's `portfolioValidUntil`.
Rotating `SESSION_SECRET` invalidates every existing certificate.

### AI

With `AI_GATEWAY_URL` set, `/ai/*` forwards to `{AI_GATEWAY_URL}/scrutiny` and `/coach`, with a 15 s timeout. The
payload includes the job, the profile and the verified ledger, and a BYOK key (if stored) goes in `X-Provider-Key`.
If the gateway is unset or fails, the built-in Heuristic Reasoning Engine answers from the user's real verified
submissions (ADR-005). The `engine` field says which one answered.

## Frontend integration gaps

The API covers every call the frontend service layer makes today. These frontend pieces still need work before
live mode is complete:

1. **GitHub callback route.** `authService.loginWithGitHub` redirects to `/api/auth/callback/github`, which does not
   exist yet. It should POST `{ code, redirectUri }` to `/api/v1/auth/github`, then store the returned session.
   Add the `user:email` scope so accounts can be linked by verified email.
2. **Magic-link landing.** Emailed links go to `MAGIC_LINK_URL?token=...` (default `FRONTEND_URL/api/auth/magic`).
   That route should POST the token to `/api/v1/auth/magic-link/verify`.
3. **Profile after login.** `useAuth` fills the store with the mock `DEFAULT_USER` / `ADMIN_USER` after sign-in. It
   should fetch `GET /api/v1/users/me` instead.
4. **Jobs and coaching.** These pages read from the Zustand seed data. The `/jobs` and `/coaching` endpoints are ready
   for a service adapter.
5. **Path prefix.** The blueprint lists `/api/auth/...` and `/api/ai/audit`. This API follows the frontend code
   (`/api/v1/...`, `/api/v1/ai/scrutiny`), because that is what the services actually call.

## Layout

```
cmd/api            entrypoint: serve | migrate | seed
internal/api       HTTP handlers, middleware (auth, RBAC, CORS, rate limits), validation
internal/store     SQL data access (pgx)
internal/db        connection pool + embedded migrations
internal/model     wire types mirroring frontend/src/types
internal/security  tokens, AES-GCM for BYOK keys, certificate signing
internal/ai        scrutiny/coach engine + gateway client
internal/github    OAuth code exchange
internal/mail      Resend sender / dev log sender
internal/seed      demo data generated from frontend/src/lib/mock-data.ts
```

## Operational notes

- Rate limits (auth: 20/min/IP, AI: 30/min/IP) are in-memory and per process. With multiple replicas, add a
  shared limiter at the edge. Client IP comes from `RemoteAddr`, so behind a proxy, have it set that correctly.
- Expired sessions and magic links are purged hourly.
- In production (`APP_ENV=production`) startup fails without `SESSION_SECRET` (32+ chars) and `ENCRYPTION_KEY`, and
  refuses `ENABLE_DEV_LOGIN=true`. Magic-link requests return 503 until `RESEND_API_KEY` is set.
