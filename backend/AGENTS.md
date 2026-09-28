# AGENTS.md — Go Backend

Guidance for AI agents working in this repo. Follow it, and prefer the repo's existing conventions over anything here when they conflict.

## 0. Ground rules for editing

- **Read before writing.** Inspect neighbouring files, existing patterns, and `go.mod` before changing anything. Match the style already in use.
- **Smallest correct diff.** Change only what the task needs. No drive-by refactors, renames, or reformatting of untouched code.
- **Never invent APIs.** If unsure a function, package, or method exists, check the source, `go doc`, or the vendored/module code. Do not guess signatures.
- **Don't add dependencies casually.** Prefer the standard library. If a new module is truly needed, say why and pick a well-maintained one.
- **Respect the Go version in `go.mod`.** Use modern features only if that version supports them. Never bump the `go` directive unprompted.
- **Never edit generated files** (`*.pb.go`, `*_gen.go`, sqlc output, mocks, etc.). Change the source and regenerate.
- **Don't touch secrets, `.env` files, or CI/deploy config** unless asked.

## 1. Verify every change

Run these before declaring work done, and report any that fail:

```bash
gofmt -l .            # or goimports; must output nothing
go vet ./...
go build ./...
go test -race ./...   # at minimum for touched packages
golangci-lint run     # if a config exists in the repo
```

- Add or update tests for every behaviour change or bug fix. A bug fix starts with a failing test.
- Do not delete, skip, or weaken tests to make them pass.

## 2. Project layout

- `cmd/<app>/main.go` — thin entrypoint: parse config, wire dependencies, start, handle shutdown.
- `internal/` — application code (not importable by other modules). Default to `internal` over `pkg`.
- Organise by domain/feature (`internal/orders`, `internal/auth`), not by type (`models/`, `handlers/`, `utils/`).
- No `util`, `common`, or `helpers` packages. Name packages for what they provide: short, lowercase, singular, no underscores.
- Avoid package-level mutable state and `init()` side effects. Wire dependencies explicitly in `main`.

## 3. Code style and idioms

- Accept interfaces, return concrete types. **Define interfaces where they are consumed**, keep them small, and don't create one until there are two implementations or a real test seam.
- Make the zero value useful. Use functional options or a config struct for constructors with many parameters.
- Early returns; keep the happy path unindented. Avoid deep nesting.
- Naming: `MixedCaps`, no stutter (`orders.Service`, not `orders.OrdersService`), initialisms stay uppercase (`ID`, `URL`, `HTTP`). Receiver names are short and consistent.
- Doc comments on all exported identifiers, starting with the identifier's name.
- Prefer modern stdlib when the Go version allows: `slices`, `maps`, `cmp`, built-in `min`/`max`/`clear`, `for i := range n`, `errors.Join`, `context.WithCancelCause`, `sync.OnceValue`, `strings.CutPrefix`.
- Use `any`, not `interface{}`.

## 4. Errors

- Return errors; never `panic` in request paths or library code. Panic only for unrecoverable programmer errors at startup.
- Wrap with context using `%w`: `fmt.Errorf("create order %s: %w", id, err)`. Lowercase, no trailing punctuation, no "failed to" chains.
- Inspect with `errors.Is` / `errors.As`, never string matching or `==` on wrapped errors.
- Use sentinel errors (`var ErrNotFound = errors.New(...)`) or typed errors for conditions callers must branch on.
- **Handle an error once**: either log it or return it, not both.
- Never ignore errors silently. If deliberately discarded, comment why (`_ = f.Close() // best effort`). Check `defer` close errors on writes.

## 5. Context and concurrency

- `context.Context` is the first parameter of anything doing I/O or long work. Never store it in a struct. Propagate it; never use `context.Background()` mid-request.
- Always `defer cancel()` after `WithCancel`/`WithTimeout`. Set timeouts on all outbound calls.
- Every goroutine needs a clear owner and a defined way to stop. No fire-and-forget goroutines in request handlers.
- Use `errgroup` (`golang.org/x/sync/errgroup`) for fan-out with error propagation; use `sync.WaitGroup.Go` if the Go version supports it.
- Guard shared state with `sync.Mutex`/`RWMutex` or channels. Don't copy structs containing mutexes. Run tests with `-race`.
- The sender closes channels, never the receiver. Bound queues and worker pools.
- Never launch a goroutine capturing a loop variable on Go < 1.22 without rebinding it.

## 6. HTTP and API layer

- Use `net/http` with the enhanced `ServeMux` (`mux.HandleFunc("GET /orders/{id}", ...)`, `r.PathValue("id")`) unless the repo already standardises on a router (chi, gin, echo). Follow the existing one.
- Handlers only: decode → validate → call service → encode. **No business logic or SQL in handlers.**
- Always set server timeouts (`ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`, `IdleTimeout`) and limit bodies with `http.MaxBytesReader`.
- Validate and sanitise all input at the boundary. Return consistent error shapes and correct status codes; never leak internal error text to clients.
- Implement **graceful shutdown**: `signal.NotifyContext` → `srv.Shutdown(ctx)`.
- Add `/healthz` (liveness) and `/readyz` (readiness) endpoints.
- Middleware for request IDs, panic recovery, structured request logging, and auth.

## 7. Database

- Use `database/sql` with `pgx`, or `sqlx`/`sqlc` if the repo does. **Always parameterised queries**; never build SQL with string concatenation or `fmt.Sprintf`.
- Pass `ctx` to every query (`QueryContext`, `ExecContext`). Always `defer rows.Close()` and check `rows.Err()`.
- Configure pool limits (`SetMaxOpenConns`, `SetMaxIdleConns`, `SetConnMaxLifetime`).
- Wrap multi-step writes in transactions; roll back with `defer tx.Rollback()` and commit explicitly.
- Schema changes go through migration files (never edit applied migrations). Keep them reversible where the tool allows.
- Map `sql.ErrNoRows` (or driver equivalent) to a domain `ErrNotFound`.

## 8. Logging and observability

- Use `log/slog` with structured key/value attributes (`slog.InfoContext(ctx, "order created", "order_id", id)`). No `fmt.Println` or `log.Printf` in app code.
- Never log secrets, tokens, passwords, or full PII.
- Include request/trace IDs. Use OpenTelemetry for tracing/metrics if the repo already does.

## 9. Configuration and security

- Config comes from environment variables (or the repo's config loader), parsed and validated once at startup. Fail fast on missing required values.
- No hardcoded secrets, credentials, or URLs.
- Compare secrets with `crypto/subtle.ConstantTimeCompare`. Use `crypto/rand`, never `math/rand`, for tokens/IDs.
- Hash passwords with bcrypt/argon2. Use TLS for external connections.
- Run `govulncheck ./...` when touching dependencies.

## 10. JSON and data

- Use explicit struct tags (`json:"created_at"`); use `omitempty`/`omitzero` deliberately. Use pointers only when "absent" differs from zero value.
- Use `time.Time` (UTC) and `time.Duration`, not raw ints/strings. Money as integer minor units or a decimal type, never `float64`.
- Prefer `json.NewDecoder(r.Body).Decode` with `DisallowUnknownFields` for strict APIs.
- Preallocate slices/maps when size is known. Don't optimise without a benchmark or profile.

## 11. Testing

- Table-driven tests with `t.Run` subtests; call `t.Parallel()` where safe. Use `t.Helper()`, `t.Cleanup()`, `t.TempDir()`, and `t.Setenv()`.
- Test behaviour through public APIs. Prefer hand-written fakes over heavy mocking frameworks.
- Use `net/http/httptest` for handlers. Use real dependencies (e.g. testcontainers) for DB integration tests, gated by a build tag or `-short`.
- Compare with `cmp.Diff` or `testify` only if already in the repo. Tests must be deterministic: no sleeps, no wall-clock or network dependence.
- Add benchmarks (`b.Loop()` / `testing.B`) and fuzz tests for parsers and hot paths.

## 12. Do not

- Don't use `panic`/`log.Fatal` outside `main`.
- Don't use `reflect`, `unsafe`, or `cgo` without strong justification.
- Don't use global `http.DefaultClient` for production calls (no timeout); build a configured client.
- Don't commit `vendor/` or `go.sum` changes you can't explain. Run `go mod tidy` after dependency edits.
- Don't leave TODOs, commented-out code, or debug prints in the final diff.
- Don't claim something works without running the checks in §1.

## 13. When finishing a task

Summarise what changed and why, list files touched, state which checks were run and their results, and flag any assumptions, risks, or follow-ups.