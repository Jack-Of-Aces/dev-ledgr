# DevLedgr API (Go)

The REST backend for DevLedgr. Identity is handled by **Supabase Auth**; data lives in **Supabase Postgres**.

- Go 1.25, standard-library `net/http` router, `pgx/v5`, `golang-jwt/jwt/v5`, Anthropic Go SDK
- Errors use one shape everywhere: `{ message, statusCode, code, errors? }`
- Failed writes always return an error. They never fall back to fake success.

## Quick start

```bash
cd backend
cp .env.example .env   # set DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY at minimum
go run ./cmd/api seed  # apply migrations + load demo problems, jobs and ledger
go run ./cmd/api       # serve on :8080 (migrations run on every start)
go test ./...
```

### Supabase setup

1. **Database.** Copy the connection string (Project Settings → Database) into `DATABASE_URL`. Tables are created on startup.
   Every table has Row Level Security on with no policies, so Supabase's public REST API cannot touch DevLedgr data;
   only this service (connecting as `postgres`) can.
2. **Auth keys.** Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` (Project Settings → API). Access tokens are verified against
   the project's JWKS (`/auth/v1/.well-known/jwks.json`). If your project still uses the legacy HS256 secret, also set `SUPABASE_JWT_SECRET`.
3. **GitHub sign-in.** Enable the GitHub provider under Authentication → Providers, and add `AUTH_REDIRECT_URL` to the allowed redirect URLs.
4. **Webhook.** Set `SUPABASE_WEBHOOK_SECRET`, then run [supabase/auth_webhook.sql](supabase/auth_webhook.sql) in the SQL editor
   (put your API URL and the same secret into Vault first). It sends user insert, update and delete events to `/api/auth/webhook`.
   The API also creates the dev record on a user's first authenticated request, so a missed webhook never locks anyone out.

## Authentication

- **Developers:** `Authorization: Bearer <supabase access token>`, or the `devledgr_session` cookie that the login routes set.
  An invalid or expired token gets `401 INVALID_TOKEN`; call `/api/auth/refresh`.
- **Internal services** (job scraper, CV parser): `X-Service-Key: <SERVICE_API_KEY>`.
- **Roles** (`user`, `reviewer`, `admin`) are stored on the dev record and checked with the same permission matrix as
  `frontend/src/types/auth.ts`. To promote someone: `update users set role = 'admin' where username = '...'`.

## Routes

`-` means public, `dev` means any signed-in developer, `service` means the `X-Service-Key` header.

### Auth

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | - | `{ email, password, username, name }`. Creates the Supabase user and the dev record. Returns a session, or `{ confirmationRequired: true }` when email confirmation is on. |
| POST | `/api/auth/login` | - | `{ email, password }` → session |
| POST | `/api/auth/refresh` | - | `{ refreshToken }`, or uses the `devledgr_refresh` cookie |
| POST | `/api/auth/logout` | - | Revokes the Supabase session and clears cookies. 204. |
| POST | `/api/auth/magic-link` | - | `{ email }`. Supabase emails a sign-in link. |
| GET | `/api/auth/oauth/github?redirectTo=` | - | 302 to Supabase's GitHub sign-in. Supabase returns tokens to the redirect URL fragment. |
| GET | `/api/auth/me` | dev | Current session and dev record |
| POST | `/api/auth/webhook` | webhook secret | Supabase `auth.users` events. INSERT creates the dev, UPDATE syncs email, DELETE removes the dev and reopens their in-progress problems. |

A session response is `{ token, refreshToken, expiresAt, username, name, role, avatarUrl, dev }`, which is a superset of the frontend's `UserSession`.

### Launchpad

A problem's status is one of `open`, `in_progress`, `seeking_contributors` or `complete`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/launchpad/problems?status=&domain=&difficulty=&search=` | - | Each problem includes `status` and `claimedBy` |
| GET | `/api/launchpad/problems/{id}` | - | |
| POST | `/api/launchpad/claim` | dev | `{ problemId }`, or use `/api/launchpad/claim/{problemId}`. Only works on `open` problems. Sets the caller as builder and moves the problem to `in_progress`. Max 3 active claims per dev. |
| GET | `/api/launchpad/claims?status=` | dev | The caller's claimed problems |
| POST | `/api/launchpad/status` | dev | `{ problemId, status }`. See the rules below. |
| GET | `/api/launchpad/status/{problemId}` | - | `{ problemId, status, claimedBy, claimedAt, statusUpdatedAt, completedAt }` |

Status rules:

- Only the builder or an admin can change a problem's status.
- The builder can switch between `in_progress` and `seeking_contributors`, mark the problem `complete`, or release it back to `open`, which clears the claim.
- Reopening a `complete` problem is admin-only.
- Concurrent updates are detected and return 409.

### Job board

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/jobBoard/jobs?level=&search=&limit=&offset=` | - | Signed-in devs get jobs ranked by skill match, each with a `match: { score, matchedSkills, missingSkills }` object. Anonymous callers get the newest jobs first. `level` is one of `intern`, `junior`, `mid`, `senior`, `lead`, `unspecified`. |
| GET | `/api/jobBoard/jobs/{id}` | - | Includes `match` when signed in |
| POST | `/api/jobBoard/jobs` | service or admin | Scraper ingest: `{ jobs: [{ source, externalId, title, company, location?, type?, level?, salary?, skills[], description?, url?, postedAt? }] }`, up to 500 per call. Upserts by `(source, externalId)` and returns `{ inserted, updated }`. Free-text level and type are normalized. |
| POST | `/api/jobBoard/audit` | dev or service | `{ cvText, jobId? }`. Service callers also send `devId` or `username`. Returns the stored audit: `{ id, score, summary, breakdown[], recommendations[], matchedKeywords, missingKeywords, engine, model }`. |
| GET | `/api/jobBoard/audit` | dev or service | The caller's audit history (service callers pass `?devId=` or `?username=`) |
| GET | `/api/jobBoard/audit/{id}` | owner, admin or service | |

Skill matching compares the job's skills against the dev's stated skills plus **proven** skills (tags of problems with a
verified submission or a completed Launchpad build). Common aliases are treated as equal, e.g. Golang = Go and Postgres = PostgreSQL.

**ATS audit.** With `ANTHROPIC_API_KEY` set, the CV (and the target job, if given) goes to Claude (`claude-opus-5` by default).
Claude returns a structured JSON verdict, and scores are clamped to 0-100. Server-side refusal fallbacks are enabled, so if
a safety classifier declines, the API re-serves the request on a fallback model. If Claude is configured but unavailable,
the endpoint returns `503 AI_UNAVAILABLE`; it does not silently switch scorers. Without a key, a transparent rule-based scorer
answers with `engine: "heuristic"`. The CV text is not stored, only its SHA-256 hash and the results. Limits: 200 to 60,000 characters.

### Developer portfolio

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/dev/portfolio?username=` or `/api/dev/portfolio/{username}` | - | Everything the public portfolio page needs: `dev`, `skills`, `provenSkills`, `stats`, `activeBuilds`, `completedProblems`, and `ledger` (verified submissions with certificates). With no username, returns the signed-in dev's own portfolio. The owner also sees their email and pending or rejected submissions. |
| GET, PATCH | `/api/dev/profile` | dev | Read or update your own profile (same validation as the frontend's `UserProfileUpdateSchema`) |

### `/api/v1` (current frontend service layer)

These routes back `frontend/src/services/*` and use the same Supabase auth:

- `users/me`, `users/available`, `users/{username}`
- `ideas`
- `submissions`, plus the ledger stamping endpoints `/{hash}/verify`, `/{hash}/reject` and `/{hash}/certificate`
- `jobs` and `coaching`
- `ai/scrutiny` and `ai/coach`

Stamping details: `verify` requires every harness test to pass and issues an HMAC-signed 365-day certificate
(keyed by `LEDGER_SIGNING_SECRET`). `certificate` recomputes the signature, so any tampering shows `valid: false`.
Reviewers cannot stamp their own submissions.

## Frontend integration

The frontend signs users in with supabase-js (GitHub/Google OAuth, `/auth/callback`). The backend
schema is the only DevLedgr schema: the frontend never writes Supabase tables directly. After
sign-in it calls `GET /api/auth/me`, which creates the dev record on first use and returns the
authoritative role. Supabase `user_metadata` is never trusted for roles, because users can edit it.

Remaining follow-ups: the jobs, Launchpad and portfolio pages still read local mock data. Their
endpoints are ready.

## Layout

```
cmd/api            entrypoint: serve | migrate | seed
internal/api       handlers (auth, launchpad, jobboard, portfolio, v1), middleware, validation
internal/supabase  JWT verification (JWKS + legacy HS256) and the Supabase Auth REST client
internal/store     SQL data access (pgx)
internal/ai        Claude ATS audit + heuristic scorer; scrutiny/coach engine
internal/skills    skill normalization and matching
internal/db        connection pool + embedded migrations
internal/model     wire types
internal/security  AES-GCM for BYOK keys, certificate signing
internal/seed      demo data generated from frontend/src/lib/mock-data.ts
supabase/          SQL to install the auth webhook trigger
```

## Operational notes

- Rate limits (auth: 20/min/IP; AI and audit: 30/min/IP) are in-memory and per process. With multiple replicas, add a shared limiter at the edge.
- In production (`APP_ENV=production`), startup fails without `LEDGER_SIGNING_SECRET` (32+ chars) and `ENCRYPTION_KEY`.
- Supabase access tokens are short-lived. Logout revokes the refresh token, but an already-issued access token stays valid until it expires (about 1 hour by default).
