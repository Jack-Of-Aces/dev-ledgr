package api

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/skills"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

type portfolioStats struct {
	VerifiedProofs      int        `json:"verifiedProofs"`
	PendingSubmissions  int        `json:"pendingSubmissions"`
	ActiveBuilds        int        `json:"activeBuilds"`
	CompletedProblems   int        `json:"completedProblems"`
	PortfolioValidUntil *time.Time `json:"portfolioValidUntil"`
}

// portfolio is everything the public portfolio page (/p/[slug]) renders.
type portfolio struct {
	Dev               model.UserProfile  `json:"dev"`
	IsOwner           bool               `json:"isOwner"`
	Skills            []string           `json:"skills"`       // stated + proven
	ProvenSkills      []string           `json:"provenSkills"` // backed by verified work
	Stats             portfolioStats     `json:"stats"`
	ActiveBuilds      []model.Idea       `json:"activeBuilds"`
	CompletedProblems []model.Idea       `json:"completedProblems"`
	Ledger            []model.Submission `json:"ledger"`
}

// GET /api/dev/portfolio?username= and GET /api/dev/portfolio/{username}.
// Without a username, returns the signed-in dev's own portfolio. The owner
// also sees their email and pending/rejected submissions.
func (s *Server) devPortfolio(w http.ResponseWriter, r *http.Request) error {
	username := r.PathValue("username")
	if username == "" {
		username = r.URL.Query().Get("username")
	}
	viewer := devFrom(r.Context())

	var dev *model.UserProfile
	switch {
	case username != "":
		u, err := s.store.GetUserByUsername(r.Context(), username)
		if errors.Is(err, store.ErrNotFound) {
			return errNotFound("Developer not found")
		}
		if err != nil {
			return err
		}
		dev = u
	case viewer != nil:
		dev = viewer
	default:
		return errBadRequest("Pass ?username= or sign in to view your own portfolio")
	}
	isOwner := viewer != nil && viewer.ID == dev.ID

	ctx := r.Context()
	f := store.SubmissionFilters{Username: dev.Username}
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			f.Limit = n
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if n, err := strconv.Atoi(o); err == nil && n >= 0 {
			f.Offset = n
		}
	}
	subs, err := s.store.ListSubmissions(ctx, f)
	if err != nil {
		return err
	}
	builds, err := s.store.IdeasByClaimant(ctx, dev.ID, model.StatusInProgress, model.StatusSeekingContributors)
	if err != nil {
		return err
	}
	completed, err := s.store.IdeasByClaimant(ctx, dev.ID, model.StatusComplete)
	if err != nil {
		return err
	}
	proven, err := s.store.ProvenSkills(ctx, dev.ID)
	if err != nil {
		return err
	}

	p := portfolio{
		Dev:               dev.Public(),
		IsOwner:           isOwner,
		Skills:            skills.Sorted(skills.Set(dev.StatedSkills, proven)),
		ProvenSkills:      nonNilStrings(proven),
		ActiveBuilds:      builds,
		CompletedProblems: completed,
		Ledger:            []model.Submission{},
	}
	if isOwner {
		p.Dev = *dev
	}
	for _, sub := range subs {
		switch sub.Status {
		case "verified":
			p.Stats.VerifiedProofs++
		case "pending":
			p.Stats.PendingSubmissions++
		}
		if sub.Status == "verified" || isOwner {
			p.Ledger = append(p.Ledger, sub)
		}
	}
	if !isOwner {
		p.Stats.PendingSubmissions = 0
	}
	p.Stats.ActiveBuilds = len(builds)
	p.Stats.CompletedProblems = len(completed)
	p.Stats.PortfolioValidUntil = dev.PortfolioValidUntil

	writeJSON(w, http.StatusOK, p)
	return nil
}

func nonNilStrings(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
