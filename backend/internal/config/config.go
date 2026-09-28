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
)

type Config struct {
	Env         string // development | production
	Port        string
	DatabaseURL string

	// FrontendURL is the Next.js origin; used for CORS and auth redirects.
	FrontendURL    string
	AllowedOrigins []string

	// Supabase Auth. SupabaseURL is the project URL (https://<ref>.supabase.co).
	// Access tokens are verified against the project's JWKS; SupabaseJWTSecret
	// additionally accepts legacy HS256-signed tokens.
	SupabaseURL           string
	SupabaseAnonKey       string
	SupabaseJWTSecret     string
	SupabaseWebhookSecret string
	// AuthRedirectURL is where Supabase sends users after OAuth / magic-link sign-in.
	AuthRedirectURL string

	// ServiceAPIKey authenticates internal callers (job scraper, CV parser).
	ServiceAPIKey string

	// SigningSecret signs ledger certificates. EncryptionKey (32 bytes, hex)
	// encrypts BYOK API keys at rest.
	SigningSecret []byte
	EncryptionKey []byte
	CookieDomain  string
	CookieSecure  bool

	// AnthropicAPIKey enables the Claude-powered ATS audit; without it the
	// heuristic scorer answers. AnthropicModel overrides the model id.
	AnthropicAPIKey string
	AnthropicModel  string

	// AIGatewayURL, when set, receives /api/v1/ai/* requests.
	AIGatewayURL string
}

func (c *Config) IsProduction() bool { return c.Env == "production" }

// Load reads configuration, first loading a .env file if one exists.
func Load() (*Config, error) {
	loadDotEnv(".env")

	c := &Config{
		Env:                   getenv("APP_ENV", "development"),
		Port:                  getenv("PORT", "8080"),
		DatabaseURL:           os.Getenv("DATABASE_URL"),
		FrontendURL:           strings.TrimRight(getenv("FRONTEND_URL", "http://localhost:3000"), "/"),
		SupabaseURL:           strings.TrimRight(os.Getenv("SUPABASE_URL"), "/"),
		SupabaseAnonKey:       getenv("SUPABASE_ANON_KEY", os.Getenv("SUPABASE_KEY")),
		SupabaseJWTSecret:     os.Getenv("SUPABASE_JWT_SECRET"),
		SupabaseWebhookSecret: os.Getenv("SUPABASE_WEBHOOK_SECRET"),
		ServiceAPIKey:         os.Getenv("SERVICE_API_KEY"),
		CookieDomain:          os.Getenv("COOKIE_DOMAIN"),
		AnthropicAPIKey:       os.Getenv("ANTHROPIC_API_KEY"),
		AnthropicModel:        getenv("ANTHROPIC_MODEL", "claude-opus-5"),
		AIGatewayURL:          strings.TrimRight(os.Getenv("AI_GATEWAY_URL"), "/"),
	}

	var errs []error
	if c.DatabaseURL == "" {
		errs = append(errs, errors.New("DATABASE_URL is required"))
	}
	if c.SupabaseURL == "" {
		errs = append(errs, errors.New("SUPABASE_URL is required"))
	}

	c.AllowedOrigins = splitList(getenv("ALLOWED_ORIGINS", c.FrontendURL))
	c.AuthRedirectURL = getenv("AUTH_REDIRECT_URL", c.FrontendURL+"/auth/callback")
	c.CookieSecure = getbool("COOKIE_SECURE", c.IsProduction())

	secret := os.Getenv("LEDGER_SIGNING_SECRET")
	switch {
	case len(secret) >= 32:
		c.SigningSecret = []byte(secret)
	case c.IsProduction():
		errs = append(errs, errors.New("LEDGER_SIGNING_SECRET must be at least 32 characters in production"))
	default:
		c.SigningSecret = []byte("dev-only-insecure-ledger-secret-change-me")
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

	if c.IsProduction() {
		if c.SupabaseWebhookSecret != "" && len(c.SupabaseWebhookSecret) < 24 {
			errs = append(errs, errors.New("SUPABASE_WEBHOOK_SECRET must be at least 24 characters"))
		}
		if c.ServiceAPIKey != "" && len(c.ServiceAPIKey) < 24 {
			errs = append(errs, errors.New("SERVICE_API_KEY must be at least 24 characters"))
		}
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
