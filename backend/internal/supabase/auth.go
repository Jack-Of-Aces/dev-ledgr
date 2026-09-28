package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// AuthClient calls the Supabase Auth (GoTrue) REST API with the project's
// anon (publishable) key.
type AuthClient struct {
	BaseURL string // https://<ref>.supabase.co
	AnonKey string
	HTTP    *http.Client
}

func (c *AuthClient) Configured() bool { return c.BaseURL != "" && c.AnonKey != "" }

// User is the subset of the Supabase auth user object the API uses.
type User struct {
	ID               string         `json:"id"`
	Email            string         `json:"email"`
	EmailConfirmedAt *time.Time     `json:"email_confirmed_at"`
	UserMetadata     map[string]any `json:"user_metadata"`
	AppMetadata      map[string]any `json:"app_metadata"`
}

type Session struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	ExpiresAt    int64  `json:"expires_at"`
	User         User   `json:"user"`
}

// Error is a non-2xx response from Supabase Auth.
type Error struct {
	Status  int
	Code    string
	Message string
}

func (e *Error) Error() string {
	return fmt.Sprintf("supabase auth: HTTP %d %s: %s", e.Status, e.Code, e.Message)
}

func (c *AuthClient) do(ctx context.Context, method, path string, query url.Values, body any, bearer string, dst any) error {
	u := c.BaseURL + "/auth/v1" + path
	if len(query) > 0 {
		u += "?" + query.Encode()
	}
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		rdr = bytes.NewReader(b)
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, method, u, rdr)
	if err != nil {
		return err
	}
	req.Header.Set("apikey", c.AnonKey)
	req.Header.Set("Content-Type", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	client := c.HTTP
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode >= 300 {
		// GoTrue uses two error shapes: {code,error_code,msg} and {error,error_description}.
		var e struct {
			ErrorCode        string `json:"error_code"`
			Msg              string `json:"msg"`
			Message          string `json:"message"`
			Error            string `json:"error"`
			ErrorDescription string `json:"error_description"`
		}
		_ = json.Unmarshal(raw, &e)
		out := &Error{Status: resp.StatusCode, Code: e.ErrorCode, Message: e.Msg}
		if out.Code == "" {
			out.Code = e.Error
		}
		for _, m := range []string{e.Message, e.ErrorDescription} {
			if out.Message == "" {
				out.Message = m
			}
		}
		if out.Message == "" {
			out.Message = http.StatusText(resp.StatusCode)
		}
		return out
	}
	if dst == nil || len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, dst)
}

// SignUp registers an email/password user. When email confirmation is on,
// Supabase returns only the user and the returned Session is nil.
func (c *AuthClient) SignUp(ctx context.Context, email, password string, metadata map[string]any, redirectTo string) (*User, *Session, error) {
	var raw json.RawMessage
	q := url.Values{}
	if redirectTo != "" {
		q.Set("redirect_to", redirectTo)
	}
	err := c.do(ctx, http.MethodPost, "/signup", q, map[string]any{"email": email, "password": password, "data": metadata}, "", &raw)
	if err != nil {
		return nil, nil, err
	}
	var s Session
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, nil, err
	}
	if s.AccessToken != "" {
		return &s.User, &s, nil
	}
	var u User
	if err := json.Unmarshal(raw, &u); err != nil {
		return nil, nil, err
	}
	if u.ID == "" {
		return nil, nil, errors.New("supabase auth: signup returned no user")
	}
	return &u, nil, nil
}

func (c *AuthClient) PasswordLogin(ctx context.Context, email, password string) (*Session, error) {
	var s Session
	err := c.do(ctx, http.MethodPost, "/token", url.Values{"grant_type": {"password"}},
		map[string]string{"email": email, "password": password}, "", &s)
	return &s, err
}

func (c *AuthClient) Refresh(ctx context.Context, refreshToken string) (*Session, error) {
	var s Session
	err := c.do(ctx, http.MethodPost, "/token", url.Values{"grant_type": {"refresh_token"}},
		map[string]string{"refresh_token": refreshToken}, "", &s)
	return &s, err
}

// Logout revokes the session's refresh tokens. The access token itself stays
// valid until it expires (Supabase access tokens are short-lived).
func (c *AuthClient) Logout(ctx context.Context, accessToken string) error {
	return c.do(ctx, http.MethodPost, "/logout", nil, nil, accessToken, nil)
}

// SendMagicLink emails a passwordless sign-in link, creating the user if needed.
func (c *AuthClient) SendMagicLink(ctx context.Context, email, redirectTo string) error {
	q := url.Values{}
	if redirectTo != "" {
		q.Set("redirect_to", redirectTo)
	}
	return c.do(ctx, http.MethodPost, "/otp", q, map[string]any{"email": email, "create_user": true}, "", nil)
}

// AuthorizeURL is the browser redirect that starts an OAuth sign-in (e.g. GitHub).
func (c *AuthClient) AuthorizeURL(provider, redirectTo, scopes string) string {
	q := url.Values{"provider": {provider}}
	if redirectTo != "" {
		q.Set("redirect_to", redirectTo)
	}
	if scopes != "" {
		q.Set("scopes", scopes)
	}
	return c.BaseURL + "/auth/v1/authorize?" + q.Encode()
}
