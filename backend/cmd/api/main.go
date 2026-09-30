// Command api runs the DevLedgr backend.
//
//	api [serve]   run migrations, then serve HTTP (default)
//	api migrate   apply database migrations and exit
//	api migrations list migration status and exit
//	api seed      apply migrations, load the coaching tracks and exit
//	api seed demo also add the sample problems and jobs (not in production)
//	api promote <username> <role>   set a dev's role (user|reviewer|admin)
//	api users [query]  list dev profiles, optionally filtered by a substring
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"text/tabwriter"
	"time"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/api"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/config"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/db"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/seed"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

func main() {
	// Serve every timestamp in UTC regardless of the host's zone.
	time.Local = time.UTC
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cmd := "serve"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Handled before config.Load: database-only commands must not require the
	// Supabase and signing secrets that only the HTTP server actually uses.
	if cmd == "migrate" {
		return runMigrate(ctx)
	}
	if cmd == "migrations" {
		return runMigrationsStatus(ctx)
	}
	if cmd == "approve-problems" {
		return runApproveProblems(ctx)
	}
	if cmd == "promote" {
		return promote(ctx, os.Args[2:])
	}
	if cmd == "users" {
		return listUsers(ctx, os.Args[2:])
	}

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool); err != nil {
		return err
	}
	st := store.New(pool)

	switch cmd {
	case "migrate":
		slog.Info("migrations up to date")
		return nil
	case "seed":
		if err := seed.Run(ctx, st); err != nil {
			return err
		}
		if len(os.Args) > 2 && os.Args[2] == "demo" {
			if cfg.IsProduction() {
				return errors.New("refusing to load demo data with APP_ENV=production")
			}
			return seed.RunDemo(ctx, st)
		}
		return nil
	case "serve":
		return serve(ctx, cfg, st)
	default:
		return fmt.Errorf("unknown command %q (want serve, migrate, seed, promote or users)", cmd)
	}
}

// runMigrate connects using only DATABASE_URL, runs any pending migrations,
// and exits. It does not require Supabase or signing credentials.
func runMigrate(ctx context.Context) error {
	databaseURL, err := config.DatabaseURL()
	if err != nil {
		return err
	}
	pool, err := db.Connect(ctx, databaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool); err != nil {
		return err
	}
	slog.Info("migrations up to date")
	return nil
}

// runMigrationsStatus connects using only DATABASE_URL, queries schema_migrations,
// and prints the status of all embedded migrations.
func runMigrationsStatus(ctx context.Context) error {
	databaseURL, err := config.DatabaseURL()
	if err != nil {
		return err
	}
	pool, err := db.Connect(ctx, databaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	records, err := db.Status(ctx, pool)
	if err != nil {
		return err
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)
	fmt.Fprintln(w, "VERSION\tSTATUS\tAPPLIED AT")
	for _, r := range records {
		status := "pending"
		applied := "-"
		if r.AppliedAt != nil {
			status = "applied"
			applied = r.AppliedAt.Format("2006-01-02 15:04:05 UTC")
		}
		fmt.Fprintf(w, "%s\t%s\t%s\n", r.Version, status, applied)
	}
	return w.Flush()
}

// runApproveProblems marks all unapproved problems in the database as approved.
func runApproveProblems(ctx context.Context) error {
	databaseURL, err := config.DatabaseURL()
	if err != nil {
		return err
	}
	pool, err := db.Connect(ctx, databaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	var total, approved, unapproved int
	if err := pool.QueryRow(ctx, `select count(*), count(*) filter (where admin_approved = true), count(*) filter (where admin_approved = false) from public.problems`).Scan(&total, &approved, &unapproved); err != nil {
		return err
	}
	slog.Info("problems before approval", "total", total, "approved", approved, "unapproved", unapproved)

	st := store.New(pool)
	n, err := st.ApproveAllProblems(ctx)
	if err != nil {
		return err
	}
	slog.Info("approved problems", "newly_approved", n)
	return nil
}

// promote bootstraps or repairs a role directly in the database. The admin
// console is the normal path, but it needs an existing admin to call, and the
// first one has to exist before that route is reachable. Only DATABASE_URL is
// required: nothing here starts the server or verifies a token. Pending
// migrations are applied first, so this works against a stale schema.
func promote(ctx context.Context, args []string) error {
	if len(args) != 2 {
		return errors.New("usage: api promote <username> <user|reviewer|admin>")
	}
	username := strings.TrimSpace(args[0])
	role := model.Role(strings.ToLower(strings.TrimSpace(args[1])))
	if !role.Valid() {
		return fmt.Errorf("unknown role %q (want user, reviewer or admin)", args[1])
	}

	databaseURL, err := config.DatabaseURL()
	if err != nil {
		return err
	}
	pool, err := db.Connect(ctx, databaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	// Apply pending migrations, as serve and seed do. Promoting the first admin
	// is the one job most likely to run against a database the current code has
	// never touched, and GetUserByUsername reads the same profile columns the
	// newest migrations add — so without this the bootstrap path failed on
	// "column p.engineering_track does not exist" and gave no hint that the fix
	// was to run a migration. This needs only the pool, not the full config, so
	// it does not reintroduce the secret requirement this path exists to avoid.
	if err := db.Migrate(ctx, pool); err != nil {
		return err
	}

	st := store.New(pool)

	dev, err := st.GetUserByUsername(ctx, username)
	if errors.Is(err, store.ErrNotFound) {
		// Name the command that answers this. The handle a dev picks at sign-up
		// is not the handle that reaches the table: the on_auth_user_created
		// trigger names the row after the account's email and pads it when that
		// is taken, so "michojekunle_551" and "michojekunle1_551" look like a
		// typo to the person holding the account and are not. Without this
		// pointer the only way to recover the real handle is to query by hand.
		return fmt.Errorf("no profile for %q: check the handle with `api users`, or have them sign in through the app once first", username)
	}
	if err != nil {
		return err
	}
	if dev.Role == role {
		slog.Info("role unchanged", "username", dev.Username, "role", string(role))
		return nil
	}
	if err := st.SetRole(ctx, dev.ID, role); err != nil {
		return err
	}
	slog.Info("role set", "username", dev.Username, "from", string(dev.Role), "to", string(role))
	return nil
}

// listUsers prints the dev roster, optionally filtered by a substring of the
// username, name or email.
//
// The handles are the reason this exists. Sign-up does not use the handle you
// pick: a Supabase on_auth_user_created trigger creates the row and names it
// after the account's email, padding it with a random suffix when that is
// already taken. So the handle a dev chose is often not the one in the
// database, promote then fails with "no profile for X" naming a handle that
// never existed, and the only way to recover it is to query the table by hand.
func listUsers(ctx context.Context, args []string) error {
	query := ""
	if len(args) > 0 {
		query = strings.TrimSpace(args[0])
	}

	databaseURL, err := config.DatabaseURL()
	if err != nil {
		return err
	}
	pool, err := db.Connect(ctx, databaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool); err != nil {
		return err
	}

	users, err := store.New(pool).ListPlatformUsers(ctx, query, 200)
	if err != nil {
		return err
	}
	if len(users) == 0 {
		if query != "" {
			slog.Info("no profiles matched", "query", query)
			return nil
		}
		slog.Info("no profiles yet", "hint", "they appear here after their first sign-in")
		return nil
	}

	if err := writeUserTable(os.Stdout, users); err != nil {
		return err
	}
	slog.Info("profiles listed", "count", len(users), "query", query)
	return nil
}

// writeUserTable renders the roster as an aligned table.
//
// Emails are included because the handle is derived from the account email and
// is frequently not the one the dev recognises, which is the whole reason the
// command exists. This is operator tooling run against the database directly,
// not a public surface.
func writeUserTable(w io.Writer, users []model.PlatformUser) error {
	tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
	fmt.Fprintln(tw, "USERNAME\tNAME\tEMAIL\tROLE\tUPDATED")
	for _, u := range users {
		fmt.Fprintf(tw, "%s\t%s\t%s\t%s\t%s\n",
			u.Username, u.Name, u.Email, string(u.Role), u.UpdatedAt.Format(time.DateOnly))
	}
	return tw.Flush()
}

func serve(ctx context.Context, cfg *config.Config, st *store.Store) error {
	srv, err := api.NewServer(cfg, st)
	if err != nil {
		return err
	}
	httpServer := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("listening", "addr", httpServer.Addr, "env", cfg.Env, "claude_ats", cfg.AnthropicAPIKey != "")
		errCh <- httpServer.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		slog.Info("shutting down")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	return httpServer.Shutdown(shutdownCtx)
}
