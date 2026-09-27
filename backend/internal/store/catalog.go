package store

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

// Jobs live in public.jobs. required_skills doubles as the matching tags;
// only admin-approved, active jobs are listed publicly.
const jobSelect = `
	select j.id::text, j.title, j.company, j.location, j.employment_type, j.salary, j.required_skills,
		coalesce(j.match_score, 0), j.job_description, coalesce(j.gap_problem_id::text, ''), coalesce(j.gap_reason, ''),
		j.level, j.apply_url, coalesce(j.source_url, ''), j.posted_at, j.scraped_at, j.admin_approved, j.is_active
	from public.jobs j`

func scanJob(row pgx.Row) (*model.Job, error) {
	var j model.Job
	var scrapedAt time.Time
	err := row.Scan(&j.ID, &j.Title, &j.Company, &j.Location, &j.Type, &j.Salary, &j.Tags, &j.MatchScore,
		&j.Description, &j.GapIdeaID, &j.GapReason, &j.Level, &j.ApplyURL, &j.SourceURL, &j.PostedAt, &scrapedAt,
		&j.AdminApproved, &j.IsActive)
	if err != nil {
		return nil, mapErr(err)
	}
	j.ScrapedAt = &scrapedAt
	j.Tags = nonNil(j.Tags)
	j.RequiredSkills = j.Tags
	j.MatchedIdeaIDs = []string{}
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

const jobOrder = ` order by coalesce(j.posted_at, j.scraped_at) desc, j.id`

// ListJobs returns the publicly visible jobs, newest first.
func (s *Store) ListJobs(ctx context.Context) ([]model.Job, error) {
	return collectJobs(s.pool.Query(ctx, jobSelect+` where j.admin_approved and j.is_active`+jobOrder))
}

type JobFilters struct {
	Level  string
	Search string
	Limit  int // max rows scanned
}

// SearchJobs returns publicly visible jobs, newest first, for ranking in the handler.
func (s *Store) SearchJobs(ctx context.Context, f JobFilters) ([]model.Job, error) {
	q := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(strings.TrimSpace(f.Search))
	return collectJobs(s.pool.Query(ctx, jobSelect+`
		where j.admin_approved and j.is_active
		  and ($1 = '' or j.level = $1)
		  and ($2 = '' or j.title ilike '%' || $2 || '%' or j.company ilike '%' || $2 || '%'
		       or exists (select 1 from unnest(j.required_skills) t where t ilike '%' || $2 || '%'))`+jobOrder+`
		limit $3`, f.Level, q, f.Limit))
}

func (s *Store) GetJob(ctx context.Context, id string) (*model.Job, error) {
	if !IsUUID(id) {
		return nil, ErrNotFound
	}
	return scanJob(s.pool.QueryRow(ctx, jobSelect+` where j.id = $1`, id))
}

// CreateJob publishes a job entered by an admin (approved immediately).
func (s *Store) CreateJob(ctx context.Context, j model.Job) (*model.Job, error) {
	if j.Level == "" {
		j.Level = "unspecified"
	}
	var gap any
	if IsUUID(j.GapIdeaID) {
		gap = j.GapIdeaID
	}
	var id string
	err := s.pool.QueryRow(ctx, `
		insert into public.jobs (title, company, location, job_description, required_skills, apply_url, employment_type,
			level, salary, gap_problem_id, gap_reason, source_url, posted_at, admin_approved)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, nullif($11, ''), nullif($12, ''), $13, true)
		returning id::text`,
		j.Title, j.Company, j.Location, j.Description, nonNil(j.Tags), j.ApplyURL, j.Type, j.Level, j.Salary,
		gap, j.GapReason, j.SourceURL, j.PostedAt).Scan(&id)
	if err != nil {
		return nil, mapErr(err)
	}
	return s.GetJob(ctx, id)
}

// ScrapedJob is one listing from the job scraper, identified by its listing URL.
type ScrapedJob struct {
	SourceURL                             string
	Title, Company, Location, Type, Level string
	Salary, Description, ApplyURL         string
	Skills                                []string
	PostedAt                              *time.Time
}

// UpsertScrapedJobs refreshes listings already stored for the same
// source_url and inserts the rest. New rows take the table's admin_approved default.
func (s *Store) UpsertScrapedJobs(ctx context.Context, jobs []ScrapedJob) (inserted, updated int, err error) {
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		for _, j := range jobs {
			args := []any{j.SourceURL, j.Title, j.Company, j.Location, j.Type, j.Level, j.Salary,
				j.Description, j.ApplyURL, nonNil(j.Skills), j.PostedAt}
			tag, err := tx.Exec(ctx, `
				update public.jobs set title = $2, company = $3, location = $4, employment_type = $5, level = $6,
					salary = $7, job_description = $8, apply_url = $9, required_skills = $10,
					posted_at = coalesce($11, posted_at), scraped_at = timezone('utc', now()), is_active = true
				where source_url = $1`, args...)
			if err != nil {
				return err
			}
			if tag.RowsAffected() > 0 {
				updated++
				continue
			}
			if _, err := tx.Exec(ctx, `
				insert into public.jobs (source_url, title, company, location, employment_type, level, salary,
					job_description, apply_url, required_skills, posted_at)
				values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, args...); err != nil {
				return err
			}
			inserted++
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
