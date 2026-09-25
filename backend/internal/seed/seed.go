// Package seed loads the initial Idea Bank, jobs, coaching tracks and demo
// ledger. The data is generated from frontend/src/lib/mock-data.ts so the
// live API and the frontend's offline preview show the same content.
package seed

import (
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/config"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/security"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

//go:embed data.json
var raw []byte

type data struct {
	Users       []model.UserProfile       `json:"users"`
	Ideas       []model.Idea              `json:"ideas"`
	Submissions []model.Submission        `json:"submissions"`
	Jobs        []model.Job               `json:"jobs"`
	Coaching    []model.CoachingItinerary `json:"coaching"`
}

// Run inserts seed rows that do not exist yet. It is safe to run repeatedly.
func Run(ctx context.Context, st *store.Store, cfg *config.Config) error {
	var d data
	if err := json.Unmarshal(raw, &d); err != nil {
		return fmt.Errorf("decode seed data: %w", err)
	}

	userIDs := map[string]string{}
	for _, u := range d.Users {
		p, err := st.EnsureDevUser(ctx, u.Username, u.Name, u.Role)
		if err != nil {
			return fmt.Errorf("seed user %s: %w", u.Username, err)
		}
		email := u.Email
		avatar, gh := u.AvatarURL, u.GitHubURL
		if _, err := st.UpdateProfile(ctx, p.ID, store.ProfileUpdate{
			Name: u.Name, Headline: u.Headline, Bio: u.Bio, AvatarURL: &avatar, GitHubURL: &gh,
			Email: &email, Plan: u.Plan, StatedSkills: u.StatedSkills,
		}); err != nil {
			return fmt.Errorf("seed profile %s: %w", u.Username, err)
		}
		userIDs[u.Username] = p.ID
	}

	for _, idea := range d.Ideas {
		// The counters in the mock data already include the seeded submissions.
		idea.SubmissionCount -= countFor(d.Submissions, idea.ID)
		if _, err := st.CreateIdea(ctx, idea, ""); err != nil && !errors.Is(err, store.ErrConflict) {
			return fmt.Errorf("seed idea %s: %w", idea.ID, err)
		}
	}

	for _, j := range d.Jobs {
		if _, err := st.CreateJob(ctx, j); err != nil && !errors.Is(err, store.ErrConflict) {
			return fmt.Errorf("seed job %s: %w", j.ID, err)
		}
	}

	for _, c := range d.Coaching {
		if err := st.UpsertItinerary(ctx, c); err != nil {
			return fmt.Errorf("seed itinerary %s: %w", c.ID, err)
		}
	}

	for _, s := range d.Submissions {
		if _, err := st.GetSubmission(ctx, s.Hash); err == nil {
			continue
		}
		var metrics model.Metrics
		if s.Metrics != nil {
			metrics = *s.Metrics
		}
		if _, err := st.CreateSubmission(ctx, store.NewSubmission{
			Hash: s.Hash, IdeaID: s.IdeaID, AuthorID: userIDs[s.AuthorUsername], RepoURL: s.RepoURL,
			DemoURL: s.DemoURL, ArchitectureNotes: s.ArchitectureNotes, Status: "pending",
			CreatedAt: s.Timestamp, Tests: s.TestResults, Metrics: metrics,
		}); err != nil {
			return fmt.Errorf("seed submission %s: %w", s.Hash, err)
		}
		if s.Status == "verified" {
			issued := s.Timestamp
			cert := &model.Certificate{IssuedAt: issued, ValidUntil: issued.Add(365 * 24 * time.Hour)}
			cert.Hash = security.SignCertificate(cfg.SessionSecret, security.CertificateInput{
				SubmissionHash: s.Hash, IdeaID: s.IdeaID, AuthorUsername: s.AuthorUsername, RepoURL: s.RepoURL,
				TestsPassed: s.TestResults.Passed, TestsTotal: s.TestResults.Total,
				IssuedAt: cert.IssuedAt, ValidUntil: cert.ValidUntil,
			})
			if err := st.RecordReview(ctx, store.ReviewDecision{
				Hash: s.Hash, ReviewerID: userIDs["lead_auditor"], Status: "verified", Certificate: cert,
			}); err != nil {
				return fmt.Errorf("stamp submission %s: %w", s.Hash, err)
			}
		}
	}

	slog.Info("seed complete", "users", len(d.Users), "ideas", len(d.Ideas), "jobs", len(d.Jobs),
		"itineraries", len(d.Coaching), "submissions", len(d.Submissions))
	return nil
}

func countFor(subs []model.Submission, ideaID string) int {
	n := 0
	for _, s := range subs {
		if s.IdeaID == ideaID {
			n++
		}
	}
	return n
}
