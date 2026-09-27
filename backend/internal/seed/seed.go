// Package seed loads reference data. The data is generated from
// frontend/src/lib/mock-data.ts so the API and the frontend's offline
// preview show the same content.
package seed

import (
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

//go:embed data.json
var raw []byte

type data struct {
	Ideas    []model.Idea              `json:"ideas"`
	Jobs     []model.Job               `json:"jobs"`
	Coaching []model.CoachingItinerary `json:"coaching"`
}

func load() (data, error) {
	var d data
	if err := json.Unmarshal(raw, &d); err != nil {
		return d, fmt.Errorf("decode seed data: %w", err)
	}
	return d, nil
}

// Run upserts the coaching tracks. It is safe to run against production.
func Run(ctx context.Context, st *store.Store) error {
	d, err := load()
	if err != nil {
		return err
	}
	for _, c := range d.Coaching {
		// Milestones referenced demo problems by slug; those ids do not exist
		// in the live problem bank (UUIDs), so the links are dropped.
		for i := range c.Milestones {
			c.Milestones[i].IdeaIDRef = ""
		}
		if err := st.UpsertItinerary(ctx, c); err != nil {
			return fmt.Errorf("seed itinerary %s: %w", c.ID, err)
		}
	}
	slog.Info("seed complete", "itineraries", len(d.Coaching))
	return nil
}

// RunDemo adds the sample problems and jobs from the frontend mock data, for
// local development. Existing rows (matched by title) are left alone.
func RunDemo(ctx context.Context, st *store.Store) error {
	d, err := load()
	if err != nil {
		return err
	}
	problems, jobs := 0, 0
	for _, idea := range d.Ideas {
		idea.SuggestedStack = idea.Tags
		idea.SubmissionCount = 0
		if _, err := st.CreateIdea(ctx, idea); err != nil {
			if errors.Is(err, store.ErrConflict) {
				continue
			}
			return fmt.Errorf("seed problem %q: %w", idea.Title, err)
		}
		problems++
	}
	for _, j := range d.Jobs {
		j.GapIdeaID = "" // referenced demo slugs, not problem UUIDs
		if _, err := st.CreateJob(ctx, j); err != nil {
			return fmt.Errorf("seed job %q: %w", j.Title, err)
		}
		jobs++
	}
	slog.Info("demo seed complete", "problems", problems, "jobs", jobs)
	return nil
}
