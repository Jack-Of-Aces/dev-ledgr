// Command api runs the DevLedgr backend.
//
//	api [serve]   run migrations, then serve HTTP (default)
//	api migrate   apply database migrations and exit
//	api seed      apply migrations, load seed data and exit
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/api"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/config"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/db"
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

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

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
		return seed.Run(ctx, st, cfg)
	case "serve":
		return serve(ctx, cfg, st)
	default:
		return fmt.Errorf("unknown command %q (want serve, migrate or seed)", cmd)
	}
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

	go purgeLoop(ctx, st)

	errCh := make(chan error, 1)
	go func() {
		slog.Info("listening", "addr", httpServer.Addr, "env", cfg.Env, "dev_login", cfg.EnableDevLogin)
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

// purgeLoop periodically deletes expired sessions and magic links.
func purgeLoop(ctx context.Context, st *store.Store) {
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		if err := st.PurgeExpired(ctx); err != nil && ctx.Err() == nil {
			slog.Warn("purge expired sessions", "err", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}
