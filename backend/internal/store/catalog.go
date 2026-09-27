package store

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

const jobColumns = `id, title, company, location, type, salary, tags, match_score, matched_idea_ids,
	required_skills, description, gap_idea_id, gap_reason, level, source, source_url, posted_at, scraped_at`

func scanJob(row pgx.Row) (*model.Job, error) {
	var j model.Job
	var gapIdea, gapReason, sourceURL *string
	err := row.Scan(&j.ID, &j.Title, &j.Company, &j.Location, &j.Type, &j.Salary, &j.Tags, &j.MatchScore,
		&j.MatchedIdeaIDs, &j.RequiredSkills, &j.Description, &gapIdea, &gapReason,
		&j.Level, &j.Source, &sourceURL, &j.PostedAt, &j.ScrapedAt)
	if err != nil {
		return nil, mapErr(err)
	}
	j.GapIdeaID, j.GapReason, j.SourceURL = deref(gapIdea), deref(gapReason), deref(sourceURL)
	j.Tags, j.MatchedIdeaIDs, j.RequiredSkills = nonNil(j.Tags), nonNil(j.MatchedIdeaIDs), nonNil(j.RequiredSkills)
	return &j, nil
}

func collectJobs(rows pgx.Rows, err error) ([]model.Job, error) {
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

func (s *Store) ListJobs(ctx context.Context) ([]model.Job, error) {
	return collectJobs(s.pool.Query(ctx, `select `+jobColumns+` from jobs where is_active order by created_at, id`))
}

type JobFilters struct {
	Level  string
	Search string
	Limit  int // max rows scanned
}

// SearchJobs returns active jobs, newest first, for ranking in the handler.
func (s *Store) SearchJobs(ctx context.Context, f JobFilters) ([]model.Job, error) {
	q := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(strings.TrimSpace(f.Search))
	return collectJobs(s.pool.Query(ctx, `select `+jobColumns+` from jobs
		where is_active
		  and ($1 = '' or level = $1)
		  and ($2 = '' or title ilike '%' || $2 || '%' or company ilike '%' || $2 || '%'
		       or exists (select 1 from unnest(tags) t where t ilike '%' || $2 || '%'))
		order by coalesce(posted_at, created_at) desc, id
		limit $3`, f.Level, q, f.Limit))
}

func (s *Store) GetJob(ctx context.Context, id string) (*model.Job, error) {
	return scanJob(s.pool.QueryRow(ctx, `select `+jobColumns+` from jobs where id = $1`, id))
}

func (s *Store) CreateJob(ctx context.Context, j model.Job) (*model.Job, error) {
	if j.Level == "" {
		j.Level = "unspecified"
	}
	if j.Source == "" {
		j.Source = "curated"
	}
	return scanJob(s.pool.QueryRow(ctx, `
		insert into jobs (id, title, company, location, type, salary, tags, match_score, matched_idea_ids,
			required_skills, description, gap_idea_id, gap_reason, level, source, source_url, posted_at)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		returning `+jobColumns,
		j.ID, j.Title, j.Company, j.Location, j.Type, j.Salary, nonNil(j.Tags), j.MatchScore, nonNil(j.MatchedIdeaIDs),
		nonNil(j.RequiredSkills), j.Description, nullIfEmpty(j.GapIdeaID), nullIfEmpty(j.GapReason),
		j.Level, j.Source, nullIfEmpty(j.SourceURL), j.PostedAt))
}

// ScrapedJob is one listing from the job scraper.
type ScrapedJob struct {
	ID, Source, ExternalID                string
	Title, Company, Location, Type, Level string
	Salary, Description, SourceURL        string
	Skills                                []string
	PostedAt                              *time.Time
}

// UpsertScrapedJobs inserts or refreshes scraped listings keyed by
// (source, external_id) and reports how many were new.
func (s *Store) UpsertScrapedJobs(ctx context.Context, jobs []ScrapedJob) (inserted, updated int, err error) {
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		for _, j := range jobs {
			var isNew bool
			if err := tx.QueryRow(ctx, `
				insert into jobs (id, source, external_id, title, company, location, type, level, salary,
					description, source_url, tags, posted_at, scraped_at, is_active)
				values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), true)
				on conflict (source, external_id) do update set
					title = excluded.title, company = excluded.company, location = excluded.location,
					type = excluded.type, level = excluded.level, salary = excluded.salary,
					description = excluded.description, source_url = excluded.source_url, tags = excluded.tags,
					posted_at = coalesce(excluded.posted_at, jobs.posted_at), scraped_at = now(), is_active = true
				returning (xmax = 0)`,
				j.ID, j.Source, j.ExternalID, j.Title, j.Company, j.Location, j.Type, j.Level, j.Salary,
				j.Description, nullIfEmpty(j.SourceURL), nonNil(j.Skills), j.PostedAt).Scan(&isNew); err != nil {
				return err
			}
			if isNew {
				inserted++
			} else {
				updated++
			}
		}
		return nil
	})
	return inserted, updated, mapErr(err)
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
