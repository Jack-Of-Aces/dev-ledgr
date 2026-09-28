// Command api runs the DevLedgr backend.
//
//	api [serve]   run migrations, then serve HTTP (default)
//	api migrate   apply database migrations and exit
//	api seed      apply migrations, load the coaching tracks and exit
//	api seed demo also add the sample problems and jobs (not in production)
//	api promote <username> <role>   set a dev's role (user|reviewer|admin)
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
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

	// Handled before config.Load: promoting the first admin must not require the
	// Supabase and signing secrets that only the HTTP server actually uses.
	if cmd == "promote" {
		return promote(ctx, os.Args[2:])
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
		return fmt.Errorf("unknown command %q (want serve, migrate, seed or promote)", cmd)
	}
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
		return fmt.Errorf("no profile for %q: they must sign in through the app once first", username)
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
