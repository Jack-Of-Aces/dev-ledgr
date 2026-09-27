package supabase

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func claimsFor(iss string, mod func(*jwt.MapClaims)) jwt.MapClaims {
	c := jwt.MapClaims{
		"iss": iss, "aud": "authenticated", "sub": "11111111-1111-1111-1111-111111111111",
		"role": "authenticated", "email": "dev@example.com", "exp": time.Now().Add(time.Hour).Unix(),
		"user_metadata": map[string]any{"user_name": "octodev"},
	}
	if mod != nil {
		mod(&c)
	}
	return c
}

func TestVerifierES256ViaJWKS(t *testing.T) {
	key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	pub, _ := key.PublicKey.Bytes() // 0x04 || X || Y
	fetches := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fetches++
		json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
			"kty": "EC", "crv": "P-256", "kid": "k1", "alg": "ES256",
			"x": base64.RawURLEncoding.EncodeToString(pub[1:33]),
			"y": base64.RawURLEncoding.EncodeToString(pub[33:]),
		}}})
	}))
	defer srv.Close()

	v := NewVerifier(srv.URL, "", srv.Client())
	sign := func(c jwt.MapClaims, kid string) string {
		tok := jwt.NewWithClaims(jwt.SigningMethodES256, c)
		tok.Header["kid"] = kid
		s, err := tok.SignedString(key)
		if err != nil {
			t.Fatal(err)
		}
		return s
	}
	iss := srv.URL + "/auth/v1"

	got, err := v.Verify(context.Background(), sign(claimsFor(iss, nil), "k1"))
	if err != nil {
		t.Fatalf("valid token rejected: %v", err)
	}
	if got.Subject != "11111111-1111-1111-1111-111111111111" || got.UserMetadata["user_name"] != "octodev" {
		t.Fatalf("claims = %+v", got)
	}
	if _, err := v.Verify(context.Background(), sign(claimsFor(iss, nil), "k1")); err != nil || fetches != 1 {
		t.Fatalf("JWKS should be cached (fetches=%d, err=%v)", fetches, err)
	}

	bad := map[string]string{
		"wrong issuer":   sign(claimsFor("https://evil.example/auth/v1", nil), "k1"),
		"wrong audience": sign(claimsFor(iss, func(c *jwt.MapClaims) { (*c)["aud"] = "anon" }), "k1"),
		"expired":        sign(claimsFor(iss, func(c *jwt.MapClaims) { (*c)["exp"] = time.Now().Add(-time.Hour).Unix() }), "k1"),
		"anonymous user": sign(claimsFor(iss, func(c *jwt.MapClaims) { (*c)["is_anonymous"] = true }), "k1"),
		"unknown kid":    sign(claimsFor(iss, nil), "other"),
		"garbage":        "not.a.jwt",
	}
	for name, tok := range bad {
		if _, err := v.Verify(context.Background(), tok); !errors.Is(err, ErrInvalidToken) {
			t.Errorf("%s: expected ErrInvalidToken, got %v", name, err)
		}
	}
}

func TestVerifierHS256OnlyWithSecret(t *testing.T) {
	iss := "https://proj.supabase.co/auth/v1"
	tok, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claimsFor(iss, nil)).SignedString([]byte("legacy-secret"))

	if _, err := NewVerifier("https://proj.supabase.co", "legacy-secret", nil).Verify(context.Background(), tok); err != nil {
		t.Fatalf("HS256 with secret rejected: %v", err)
	}
	// Without a configured secret, HS256 must not be accepted (no alg confusion).
	if _, err := NewVerifier("https://proj.supabase.co", "", nil).Verify(context.Background(), tok); err == nil {
		t.Fatal("HS256 accepted without a configured secret")
	}
	if _, err := NewVerifier("https://proj.supabase.co", "other-secret", nil).Verify(context.Background(), tok); err == nil {
		t.Fatal("HS256 accepted with the wrong secret")
	}
}

func TestAuthClient(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("apikey") != "anon" {
			w.WriteHeader(401)
			return
		}
		switch r.URL.Path {
		case "/auth/v1/signup":
			// Email confirmation on: only the user is returned.
			if r.URL.Query().Get("redirect_to") != "http://app/cb" {
				t.Errorf("redirect_to = %q", r.URL.Query().Get("redirect_to"))
			}
			w.Write([]byte(`{"id":"u1","email":"a@b.co","user_metadata":{"username":"alice"}}`))
		case "/auth/v1/token":
			if r.URL.Query().Get("grant_type") == "password" {
				w.WriteHeader(400)
				w.Write([]byte(`{"error":"invalid_grant","error_description":"Invalid login credentials"}`))
				return
			}
			w.Write([]byte(`{"access_token":"at","refresh_token":"rt","expires_in":3600,"expires_at":1900000000,"user":{"id":"u1","email":"a@b.co"}}`))
		case "/auth/v1/otp":
			w.WriteHeader(429)
			w.Write([]byte(`{"code":429,"error_code":"over_email_send_rate_limit","msg":"email rate limit exceeded"}`))
		}
	}))
	defer srv.Close()
	c := &AuthClient{BaseURL: srv.URL, AnonKey: "anon", HTTP: srv.Client()}
	ctx := context.Background()

	u, sess, err := c.SignUp(ctx, "a@b.co", "password1", map[string]any{"username": "alice"}, "http://app/cb")
	if err != nil || sess != nil || u.ID != "u1" {
		t.Fatalf("signup = %+v %+v %v", u, sess, err)
	}

	_, err = c.PasswordLogin(ctx, "a@b.co", "wrong")
	var se *Error
	if !errors.As(err, &se) || se.Status != 400 || se.Code != "invalid_grant" || se.Message != "Invalid login credentials" {
		t.Fatalf("login error = %#v", err)
	}

	s, err := c.Refresh(ctx, "rt")
	if err != nil || s.AccessToken != "at" || s.User.ID != "u1" {
		t.Fatalf("refresh = %+v %v", s, err)
	}

	err = c.SendMagicLink(ctx, "a@b.co", "")
	if !errors.As(err, &se) || se.Status != 429 || se.Code != "over_email_send_rate_limit" {
		t.Fatalf("otp error = %#v", err)
	}
}
