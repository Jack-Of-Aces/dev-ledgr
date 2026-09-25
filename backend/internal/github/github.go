// Package github implements the server side of the GitHub OAuth code exchange.
package github

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

var ErrBadCode = errors.New("github rejected the authorization code")

type Client struct {
	ClientID     string
	ClientSecret string
	HTTP         *http.Client
	// Overridable for tests.
	OAuthBase string // default https://github.com
	APIBase   string // default https://api.github.com
}

func (c *Client) Configured() bool { return c.ClientID != "" && c.ClientSecret != "" }

func (c *Client) httpClient() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return &http.Client{Timeout: 10 * time.Second}
}

func or(v, def string) string {
	if v == "" {
		return def
	}
	return v
}

// Exchange trades an OAuth code for an access token and returns the GitHub identity.
func (c *Client) Exchange(ctx context.Context, code, redirectURI string) (store.GitHubIdentity, error) {
	form := url.Values{"client_id": {c.ClientID}, "client_secret": {c.ClientSecret}, "code": {code}}
	if redirectURI != "" {
		form.Set("redirect_uri", redirectURI)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		or(c.OAuthBase, "https://github.com")+"/login/oauth/access_token", strings.NewReader(form.Encode()))
	if err != nil {
		return store.GitHubIdentity{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	var tok struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := c.do(req, &tok); err != nil {
		return store.GitHubIdentity{}, err
	}
	if tok.AccessToken == "" {
		return store.GitHubIdentity{}, fmt.Errorf("%w: %s", ErrBadCode, tok.Error)
	}

	var u struct {
		ID        int64  `json:"id"`
		Login     string `json:"login"`
		Name      string `json:"name"`
		AvatarURL string `json:"avatar_url"`
		HTMLURL   string `json:"html_url"`
	}
	if err := c.api(ctx, tok.AccessToken, "/user", &u); err != nil {
		return store.GitHubIdentity{}, err
	}
	id := store.GitHubIdentity{ID: u.ID, Login: u.Login, Name: u.Name, AvatarURL: u.AvatarURL, HTMLURL: u.HTMLURL}

	// Only a primary *verified* email is trusted, since it is used to link
	// accounts. This needs the user:email scope; without it we skip the email.
	var emails []struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}
	if err := c.api(ctx, tok.AccessToken, "/user/emails", &emails); err == nil {
		for _, e := range emails {
			if e.Primary && e.Verified {
				id.Email = e.Email
			}
		}
	}
	return id, nil
}

func (c *Client) api(ctx context.Context, token, path string, dst any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, or(c.APIBase, "https://api.github.com")+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	return c.do(req, dst)
}

func (c *Client) do(req *http.Request, dst any) error {
	resp, err := c.httpClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("github %s: HTTP %d: %s", req.URL.Path, resp.StatusCode, msg)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(dst)
}
