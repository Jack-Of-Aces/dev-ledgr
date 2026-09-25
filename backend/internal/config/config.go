// Package config loads runtime configuration from environment variables.
package config

import (
	"bufio"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Env         string // development | production
	Port        string
	DatabaseURL string

	// FrontendURL is the Next.js origin; used for CORS and magic link URLs.
	FrontendURL    string
	AllowedOrigins []string

	// SessionSecret signs ledger certificates. EncryptionKey (32 bytes, hex)
	// encrypts BYOK API keys at rest.
	SessionSecret []byte
	EncryptionKey []byte
	SessionTTL    time.Duration
	CookieDomain  string
	CookieSecure  bool

	GitHubClientID     string
	GitHubClientSecret string

	// MagicLinkURL is where the emailed link points; the token is appended as ?token=.
	MagicLinkURL string
	ResendAPIKey string
	EmailFrom    string

	// AIGatewayURL, when set, receives /ai/* requests; otherwise the built-in
	// heuristic reasoning engine answers them.
	AIGatewayURL string

	// EnableDevLogin exposes POST /api/v1/auth/dev/login for persona sandboxing.
	EnableDevLogin bool
}

func (c *Config) IsProduction() bool { return c.Env == "production" }

// Load reads configuration, first loading a .env file if one exists.
func Load() (*Config, error) {
	loadDotEnv(".env")

	c := &Config{
		Env:                getenv("APP_ENV", "development"),
		Port:               getenv("PORT", "8080"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		FrontendURL:        strings.TrimRight(getenv("FRONTEND_URL", "http://localhost:3000"), "/"),
		CookieDomain:       os.Getenv("COOKIE_DOMAIN"),
		GitHubClientID:     os.Getenv("GITHUB_CLIENT_ID"),
		GitHubClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
		ResendAPIKey:       os.Getenv("RESEND_API_KEY"),
		EmailFrom:          getenv("EMAIL_FROM", "DevLedgr <auth@devledgr.io>"),
		AIGatewayURL:       strings.TrimRight(os.Getenv("AI_GATEWAY_URL"), "/"),
	}

	var errs []error
	if c.DatabaseURL == "" {
		errs = append(errs, errors.New("DATABASE_URL is required"))
	}

	c.AllowedOrigins = splitList(getenv("ALLOWED_ORIGINS", c.FrontendURL))
	c.MagicLinkURL = getenv("MAGIC_LINK_URL", c.FrontendURL+"/api/auth/magic")
	c.CookieSecure = getbool("COOKIE_SECURE", c.IsProduction())
	c.EnableDevLogin = getbool("ENABLE_DEV_LOGIN", !c.IsProduction())

	ttlHours, err := strconv.Atoi(getenv("SESSION_TTL_HOURS", "168"))
	if err != nil || ttlHours <= 0 {
		errs = append(errs, errors.New("SESSION_TTL_HOURS must be a positive integer"))
	}
	c.SessionTTL = time.Duration(ttlHours) * time.Hour

	secret := os.Getenv("SESSION_SECRET")
	switch {
	case len(secret) >= 32:
		c.SessionSecret = []byte(secret)
	case c.IsProduction():
		errs = append(errs, errors.New("SESSION_SECRET must be at least 32 characters in production"))
	default:
		c.SessionSecret = []byte("dev-only-insecure-session-secret-change-me")
	}

	if key := os.Getenv("ENCRYPTION_KEY"); key != "" {
		b, err := hex.DecodeString(key)
		if err != nil || len(b) != 32 {
			errs = append(errs, errors.New("ENCRYPTION_KEY must be 64 hex characters (32 bytes)"))
		}
		c.EncryptionKey = b
	} else if c.IsProduction() {
		errs = append(errs, errors.New("ENCRYPTION_KEY is required in production"))
	} else {
		c.EncryptionKey = make([]byte, 32) // dev only: all-zero key
	}

	if c.IsProduction() && c.EnableDevLogin {
		errs = append(errs, errors.New("ENABLE_DEV_LOGIN must be false in production"))
	}

	if len(errs) > 0 {
		return nil, fmt.Errorf("invalid configuration: %w", errors.Join(errs...))
	}
	return c, nil
}

func getenv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func getbool(key string, fallback bool) bool {
	v, err := strconv.ParseBool(os.Getenv(key))
	if err != nil {
		return fallback
	}
	return v
}

func splitList(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimRight(strings.TrimSpace(part), "/"); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// loadDotEnv sets variables from a KEY=VALUE file without overriding the real environment.
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		k = strings.TrimSpace(strings.TrimPrefix(k, "export "))
		v = strings.Trim(strings.TrimSpace(v), `"'`)
		if _, exists := os.LookupEnv(k); !exists {
			os.Setenv(k, v)
		}
	}
}
