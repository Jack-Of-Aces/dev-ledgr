package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/ai"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

// scrutinyRequest matches the body AIService.runScrutinyAudit posts.
// username is accepted for compatibility; the audit always runs for the caller.
type scrutinyRequest struct {
	JobID    string `json:"jobId"`
	Username string `json:"username"`
	ForceGap bool   `json:"forceGap"`
}

// POST /api/v1/ai/scrutiny audits the caller's verified ledger against a job.
// Send "Accept: text/event-stream" to receive each audit step as a `log`
// event followed by a final `result` event; otherwise a single JSON
// ScrutinyResult is returned.
func (s *Server) scrutiny(w http.ResponseWriter, r *http.Request) error {
	var req scrutinyRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	if req.JobID == "" {
		v := validationErrors{}
		v.add("jobId", "jobId is required")
		return v.err()
	}
	job, err := s.store.GetJob(r.Context(), req.JobID)
	if errors.Is(err, store.ErrNotFound) {
		return errNotFound("Job not found")
	}
	if err != nil {
		return err
	}
	user := principalFrom(r.Context()).User
	subs, err := s.store.ListSubmissions(r.Context(), store.SubmissionFilters{Username: user.Username, Status: "verified"})
	if err != nil {
		return err
	}
	in := ai.ScrutinyInput{Job: *job, User: *user, Submissions: subs, ForceGap: req.ForceGap}
	key := s.providerKey(r)

	flusher, canStream := w.(http.Flusher)
	if !canStream || !strings.Contains(r.Header.Get("Accept"), "text/event-stream") {
		writeJSON(w, http.StatusOK, s.ai.Scrutiny(r.Context(), in, key, nil))
		return nil
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	send := func(event string, v any) {
		b, _ := json.Marshal(v)
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, b)
		flusher.Flush()
	}
	res := s.ai.Scrutiny(r.Context(), in, key, func(line string) { send("log", line) })
	send("result", res)
	return nil
}

type coachRequest struct {
	ItineraryTitle string `json:"itineraryTitle"`
	MilestoneTitle string `json:"milestoneTitle"`
	Prompt         string `json:"prompt"`
	// APIKey is accepted for compatibility with CoachPromptParams; a key sent
	// here is used for this request only and never stored.
	APIKey string `json:"apiKey"`
}

// POST /api/v1/ai/coach returns architecture guidance for a milestone prompt.
func (s *Server) coach(w http.ResponseWriter, r *http.Request) error {
	var req coachRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	v := validationErrors{}
	if strings.TrimSpace(req.Prompt) == "" || len(req.Prompt) > 4000 {
		v.add("prompt", "Prompt is required (up to 4000 characters)")
	}
	if strings.TrimSpace(req.MilestoneTitle) == "" || len(req.MilestoneTitle) > 200 {
		v.add("milestoneTitle", "Milestone title is required (up to 200 characters)")
	}
	if len(req.ItineraryTitle) > 200 {
		v.add("itineraryTitle", "Itinerary title must be under 200 characters")
	}
	if err := v.err(); err != nil {
		return err
	}
	key := req.APIKey
	if key == "" {
		key = s.providerKey(r)
	}
	advice, engine := s.ai.Coach(r.Context(), ai.CoachInput{
		ItineraryTitle: req.ItineraryTitle, MilestoneTitle: req.MilestoneTitle, Prompt: req.Prompt,
	}, key)
	writeJSON(w, http.StatusOK, map[string]string{"advice": advice, "engine": engine})
	return nil
}
