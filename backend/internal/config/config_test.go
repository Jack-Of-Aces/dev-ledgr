package config

import "testing"

// TestDatabaseURL covers the lightweight loader the `api promote` subcommand
// uses. It exists so bootstrapping the first admin does not require the Supabase
// and signing secrets that only the HTTP server actually needs.
func TestDatabaseURL(t *testing.T) {
	t.Run("returns the connection string", func(t *testing.T) {
		t.Setenv("DATABASE_URL", "postgres://user:pw@host:5432/db")
		got, err := DatabaseURL()
		if err != nil {
			t.Fatalf("DatabaseURL: %v", err)
		}
		if got != "postgres://user:pw@host:5432/db" {
			t.Errorf("DatabaseURL() = %q, want the configured URL", got)
		}
	})

	t.Run("trims surrounding whitespace", func(t *testing.T) {
		t.Setenv("DATABASE_URL", "  postgres://host/db\n")
		got, err := DatabaseURL()
		if err != nil {
			t.Fatalf("DatabaseURL: %v", err)
		}
		if got != "postgres://host/db" {
			t.Errorf("DatabaseURL() = %q, want the trimmed URL", got)
		}
	})

	// A missing value must fail before any connection is attempted, so the
	// command reports the cause instead of a driver error.
	for _, tc := range []struct{ name, value string }{
		{"unset", ""},
		{"whitespace only", "   "},
	} {
		t.Run("refuses when "+tc.name, func(t *testing.T) {
			t.Setenv("DATABASE_URL", tc.value)
			if _, err := DatabaseURL(); err == nil {
				t.Fatal("DatabaseURL() succeeded with no usable URL")
			}
		})
	}
}
