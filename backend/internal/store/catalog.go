package store

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

const jobColumns = `id, title, company, location, type, salary, tags, match_score, matched_idea_ids,
	required_skills, description, gap_idea_id, gap_reason`

func scanJob(row pgx.Row) (*model.Job, error) {
	var j model.Job
	var gapIdea, gapReason *string
	err := row.Scan(&j.ID, &j.Title, &j.Company, &j.Location, &j.Type, &j.Salary, &j.Tags, &j.MatchScore,
		&j.MatchedIdeaIDs, &j.RequiredSkills, &j.Description, &gapIdea, &gapReason)
	if err != nil {
		return nil, mapErr(err)
	}
	j.GapIdeaID, j.GapReason = deref(gapIdea), deref(gapReason)
	j.Tags, j.MatchedIdeaIDs, j.RequiredSkills = nonNil(j.Tags), nonNil(j.MatchedIdeaIDs), nonNil(j.RequiredSkills)
	return &j, nil
}

func (s *Store) ListJobs(ctx context.Context) ([]model.Job, error) {
	rows, err := s.pool.Query(ctx, `select `+jobColumns+` from jobs order by created_at, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	jobs := []model.Job{}
	for rows.Next() {
		j, err := scanJob(rows)
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, *j)
	}
	return jobs, rows.Err()
}

func (s *Store) GetJob(ctx context.Context, id string) (*model.Job, error) {
	return scanJob(s.pool.QueryRow(ctx, `select `+jobColumns+` from jobs where id = $1`, id))
}

func (s *Store) CreateJob(ctx context.Context, j model.Job) (*model.Job, error) {
	return scanJob(s.pool.QueryRow(ctx, `
		insert into jobs (id, title, company, location, type, salary, tags, match_score, matched_idea_ids,
			required_skills, description, gap_idea_id, gap_reason)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		returning `+jobColumns,
		j.ID, j.Title, j.Company, j.Location, j.Type, j.Salary, nonNil(j.Tags), j.MatchScore, nonNil(j.MatchedIdeaIDs),
		nonNil(j.RequiredSkills), j.Description, nullIfEmpty(j.GapIdeaID), nullIfEmpty(j.GapReason)))
}

func scanItinerary(row pgx.Row) (*model.CoachingItinerary, error) {
	var c model.CoachingItinerary
	var milestones string
	if err := row.Scan(&c.ID, &c.Title, &c.Subtitle, &c.TargetRole, &c.DurationWeeks, &milestones); err != nil {
		return nil, mapErr(err)
	}
	if err := json.Unmarshal([]byte(milestones), &c.Milestones); err != nil {
		return nil, err
	}
	if c.Milestones == nil {
		c.Milestones = []model.Milestone{}
	}
	return &c, nil
}

const itineraryColumns = `id, title, subtitle, target_role, duration_weeks, milestones::text`

func (s *Store) ListItineraries(ctx context.Context) ([]model.CoachingItinerary, error) {
	rows, err := s.pool.Query(ctx, `select `+itineraryColumns+` from coaching_itineraries order by created_at, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.CoachingItinerary{}
	for rows.Next() {
		c, err := scanItinerary(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

func (s *Store) GetItinerary(ctx context.Context, id string) (*model.CoachingItinerary, error) {
	return scanItinerary(s.pool.QueryRow(ctx, `select `+itineraryColumns+` from coaching_itineraries where id = $1`, id))
}

func (s *Store) UpsertItinerary(ctx context.Context, c model.CoachingItinerary) error {
	ms, err := json.Marshal(c.Milestones)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `
		insert into coaching_itineraries (id, title, subtitle, target_role, duration_weeks, milestones)
		values ($1, $2, $3, $4, $5, $6::jsonb)
		on conflict (id) do update set title = excluded.title, subtitle = excluded.subtitle,
			target_role = excluded.target_role, duration_weeks = excluded.duration_weeks, milestones = excluded.milestones`,
		c.ID, c.Title, c.Subtitle, c.TargetRole, c.DurationWeeks, string(ms))
	return err
}
