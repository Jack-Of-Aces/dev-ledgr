// Package mail delivers transactional email (magic links).
package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

type Message struct {
	To, Subject, Text, HTML string
}

type Sender interface {
	Send(ctx context.Context, m Message) error
}

// Resend sends through the Resend HTTP API (https://resend.com).
type Resend struct {
	APIKey string
	From   string
	Client *http.Client
}

func (r *Resend) Send(ctx context.Context, m Message) error {
	body, _ := json.Marshal(map[string]any{
		"from": r.From, "to": []string{m.To}, "subject": m.Subject, "text": m.Text, "html": m.HTML,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+r.APIKey)
	req.Header.Set("Content-Type", "application/json")

	client := r.Client
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("resend: HTTP %d: %s", resp.StatusCode, msg)
	}
	return nil
}

// Log writes emails to the server log. Development only: it prints live sign-in links.
type Log struct{}

func (Log) Send(_ context.Context, m Message) error {
	slog.Warn("email not sent (no RESEND_API_KEY); logging instead", "to", m.To, "subject", m.Subject, "body", m.Text)
	return nil
}
