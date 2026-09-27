// Package supabase integrates with Supabase Auth: it verifies access tokens
// and wraps the Auth (GoTrue) REST API used by the /api/auth routes.
package supabase

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims are the Supabase access-token claims the API relies on.
type Claims struct {
	jwt.RegisteredClaims
	Email        string         `json:"email"`
	Role         string         `json:"role"`
	IsAnonymous  bool           `json:"is_anonymous"`
	UserMetadata map[string]any `json:"user_metadata"`
	AppMetadata  map[string]any `json:"app_metadata"`
}

var ErrInvalidToken = errors.New("invalid access token")

// Verifier validates Supabase access tokens. Asymmetric (ES256/RS256) tokens
// are checked against the project's JWKS; legacy HS256 tokens are accepted
// only when the project's JWT secret is configured.
type Verifier struct {
	issuer    string
	hmacKey   []byte
	jwks      *jwksCache
	now       func() time.Time
	validAlgs []string
}

func NewVerifier(supabaseURL, jwtSecret string, client *http.Client) *Verifier {
	v := &Verifier{
		issuer:    supabaseURL + "/auth/v1",
		jwks:      &jwksCache{url: supabaseURL + "/auth/v1/.well-known/jwks.json", client: client, keys: map[string]any{}},
		now:       time.Now,
		validAlgs: []string{"ES256", "RS256"},
	}
	if jwtSecret != "" {
		v.hmacKey = []byte(jwtSecret)
		v.validAlgs = append(v.validAlgs, "HS256")
	}
	return v
}

func (v *Verifier) Verify(ctx context.Context, token string) (*Claims, error) {
	var claims Claims
	_, err := jwt.ParseWithClaims(token, &claims, func(t *jwt.Token) (any, error) {
		switch t.Method.(type) {
		case *jwt.SigningMethodHMAC:
			return v.hmacKey, nil
		default:
			kid, _ := t.Header["kid"].(string)
			return v.jwks.key(ctx, kid)
		}
	},
		jwt.WithValidMethods(v.validAlgs),
		jwt.WithIssuer(v.issuer),
		jwt.WithAudience("authenticated"),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(30*time.Second),
		jwt.WithTimeFunc(v.now),
	)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidToken, err)
	}
	if claims.Subject == "" || claims.Role != "authenticated" || claims.IsAnonymous {
		return nil, fmt.Errorf("%w: not an authenticated user token", ErrInvalidToken)
	}
	return &claims, nil
}

// jwksCache fetches signing keys lazily and refreshes on an unknown kid,
// at most once per minRefresh, so key rotation works without a restart.
type jwksCache struct {
	url     string
	client  *http.Client
	mu      sync.Mutex
	keys    map[string]any
	fetched time.Time
}

const minRefresh = 30 * time.Second

func (c *jwksCache) key(ctx context.Context, kid string) (any, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if k, ok := c.keys[kid]; ok {
		return k, nil
	}
	if time.Since(c.fetched) < minRefresh {
		return nil, fmt.Errorf("unknown signing key %q", kid)
	}
	if err := c.refresh(ctx); err != nil {
		return nil, err
	}
	if k, ok := c.keys[kid]; ok {
		return k, nil
	}
	return nil, fmt.Errorf("unknown signing key %q", kid)
}

type jwk struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
	N   string `json:"n"`
	E   string `json:"e"`
}

func (c *jwksCache) refresh(ctx context.Context) error {
	c.fetched = time.Now()
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url, nil)
	if err != nil {
		return err
	}
	client := c.client
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch jwks: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("fetch jwks: HTTP %d", resp.StatusCode)
	}
	var set struct {
		Keys []jwk `json:"keys"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&set); err != nil {
		return fmt.Errorf("decode jwks: %w", err)
	}
	keys := map[string]any{}
	for _, k := range set.Keys {
		pub, err := k.publicKey()
		if err != nil {
			continue // skip unsupported key types
		}
		keys[k.Kid] = pub
	}
	c.keys = keys
	return nil
}

func b64(s string) ([]byte, error) { return base64.RawURLEncoding.DecodeString(s) }

func (k jwk) publicKey() (any, error) {
	switch k.Kty {
	case "EC":
		if k.Crv != "P-256" {
			return nil, fmt.Errorf("unsupported curve %s", k.Crv)
		}
		x, err := b64(k.X)
		if err != nil {
			return nil, err
		}
		y, err := b64(k.Y)
		if err != nil {
			return nil, err
		}
		if len(x) != 32 || len(y) != 32 {
			return nil, errors.New("bad P-256 coordinates")
		}
		return ecdsa.ParseUncompressedPublicKey(elliptic.P256(), append(append([]byte{4}, x...), y...))
	case "RSA":
		n, err := b64(k.N)
		if err != nil {
			return nil, err
		}
		e, err := b64(k.E)
		if err != nil {
			return nil, err
		}
		return &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: int(new(big.Int).SetBytes(e).Int64())}, nil
	}
	return nil, fmt.Errorf("unsupported key type %s", k.Kty)
}
