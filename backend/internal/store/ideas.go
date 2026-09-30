package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

var (
	ErrNotOpen     = errors.New("problem is not open for claiming")
	ErrNotApproved = errors.New("problem has not been approved")
	ErrClaimLimit  = errors.New("active claim limit reached")
	ErrStale       = errors.New("problem changed concurrently")
)

// Problems (the Launchpad / Idea Bank) live in public.problems; the current
// builder is the Active (or, once finished, Completed) row in claimed_projects.
const ideaSelect = `
	select pr.id::text, pr.title, coalesce(pr.tagline, ''), coalesce(pr.domain, ''), coalesce(pr.difficulty, ''),
		coalesce(pr.estimated_hours, 0), coalesce(pr.origin_story, ''), pr.problem_statement,
		coalesce(pr.technical_requirements, '{}'), coalesce(pr.mock_infra, '{}'::jsonb)::text, coalesce(pr.tags, '{}'),
		coalesce(pr.submission_count, 0), pr.suggested_stack, pr.regional_hurdles, coalesce(pr.source_url, ''),
		pr.admin_approved, pr.created_at, pr.status, pr.status_updated_at, pr.completed_at,
		c.claimed_at, d.id::text, d.username, coalesce(nullif(d.full_name, ''), d.username), coalesce(d.avatar_url, '')
	from public.problems pr
	left join lateral (
		select cp.profile_id, cp.claimed_at from public.claimed_projects cp
		where cp.problem_id = pr.id and cp.collaboration_status in ('Active', 'Completed')
		order by cp.collaboration_status = 'Active' desc, cp.claimed_at desc
		limit 1
	) c on true
	left join public.profiles d on d.id = c.profile_id`

func scanIdea(row pgx.Row) (*model.Idea, error) {
	var i model.Idea
	var infra, dbStatus string
	var cID, cUsername, cName, cAvatar *string
	err := row.Scan(&i.ID, &i.Title, &i.Tagline, &i.Domain, &i.Difficulty, &i.EstimatedHours, &i.OriginStory,
		&i.ProblemStatement, &i.TechnicalRequirements, &infra, &i.Tags, &i.SubmissionCount,
		&i.SuggestedStack, &i.RegionalHurdles, &i.SourceURL, &i.AdminApproved, &i.CreatedAt,
		&dbStatus, &i.StatusUpdatedAt, &i.CompletedAt,
		&i.ClaimedAt, &cID, &cUsername, &cName, &cAvatar)
	if err != nil {
		return nil, mapErr(err)
	}
	if err := json.Unmarshal([]byte(infra), &i.MockInfra); err != nil {
		return nil, fmt.Errorf("decode mock_infra for %s: %w", i.ID, err)
	}
	i.Status = model.StatusFromDB(dbStatus)
	if cID != nil {
		i.ClaimedBy = &model.DevRef{ID: *cID, Username: deref(cUsername), Name: deref(cName), AvatarURL: deref(cAvatar)}
	}
	i.TechnicalRequirements = nonNil(i.TechnicalRequirements)
	i.Tags = nonNil(i.Tags)
	i.SuggestedStack = nonNil(i.SuggestedStack)
	if i.MockInfra.Endpoints == nil {
		i.MockInfra.Endpoints = []model.MockEndpoint{}
	}
	i.MockInfra.TestCriteria = nonNil(i.MockInfra.TestCriteria)
	return &i, nil
}

func collectIdeas(rows pgx.Rows, err error) ([]model.Idea, error) {
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ideas := []model.Idea{}
	for rows.Next() {
		i, err := scanIdea(rows)
		if err != nil {
			return nil, err
		}
		ideas = append(ideas, *i)
	}
	return ideas, rows.Err()
}

// IdeaFilters narrows the problem list. Status is an API status; Approved
// nil means both approved and unapproved problems.
type IdeaFilters struct {
	Domain, Difficulty, Search, Status string
	Approved                           *bool
}

func (s *Store) ListIdeas(ctx context.Context, f IdeaFilters) ([]model.Idea, error) {
	var where []string
	var args []any
	add := func(cond string, v any) {
		args = append(args, v)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}
	if f.Domain != "" {
		add("lower(pr.domain) = lower($%d)", f.Domain)
	}
	if f.Difficulty != "" {
		add("lower(pr.difficulty) = lower($%d)", f.Difficulty)
	}
	if f.Status != "" {
		add("pr.status = $%d", model.StatusToDB(f.Status))
	}
	if f.Approved != nil {
		add("pr.admin_approved = $%d", *f.Approved)
	}
	if q := strings.TrimSpace(f.Search); q != "" {
		// Escape LIKE wildcards so user input is matched literally.
		q = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(q)
		add(`(pr.title ilike '%%' || $%[1]d || '%%' or pr.tagline ilike '%%' || $%[1]d || '%%'
			or pr.problem_statement ilike '%%' || $%[1]d || '%%'
			or exists (select 1 from unnest(coalesce(pr.tags, '{}') || pr.suggested_stack) t where t ilike '%%' || $%[1]d || '%%'))`, q)
	}
	sql := ideaSelect
	if len(where) > 0 {
		sql += ` where ` + strings.Join(where, " and ")
	}
	sql += ` order by pr.created_at desc, pr.id`
	return collectIdeas(s.pool.Query(ctx, sql, args...))
}

func (s *Store) GetIdea(ctx context.Context, id string) (*model.Idea, error) {
	if !IsUUID(id) {
		return nil, ErrNotFound
	}
	return scanIdea(s.pool.QueryRow(ctx, ideaSelect+` where pr.id = $1`, id))
}

// IdeasByClaimant lists problems a dev is building or has built, optionally
// filtered by API status.
func (s *Store) IdeasByClaimant(ctx context.Context, devID string, statuses ...string) ([]model.Idea, error) {
	db := make([]string, 0, len(statuses))
	for _, st := range statuses {
		db = append(db, model.StatusToDB(st))
	}
	return collectIdeas(s.pool.Query(ctx, ideaSelect+`
		where d.id = $1 and (cardinality($2::text[]) = 0 or pr.status = any($2))
		order by pr.status_updated_at desc`, devID, db))
}

// CreateIdea publishes a problem authored by an admin; it is approved immediately.
func (s *Store) CreateIdea(ctx context.Context, i model.Idea) (*model.Idea, error) {
	infra, err := json.Marshal(i.MockInfra)
	if err != nil {
		return nil, err
	}
	var id string
	err = s.pool.QueryRow(ctx, `
		insert into public.problems (title, tagline, domain, difficulty, estimated_hours, origin_story, problem_statement,
			technical_requirements, mock_infra, tags, suggested_stack, regional_hurdles, source_url, admin_approved)
		values ($1, nullif($2, ''), $3, $4, $5, nullif($6, ''), $7, $8, $9::jsonb, $10, $11, $12, nullif($13, ''), true)
		returning id::text`,
		i.Title, i.Tagline, i.Domain, i.Difficulty, i.EstimatedHours, i.OriginStory, i.ProblemStatement,
		nonNil(i.TechnicalRequirements), string(infra), nonNil(i.Tags), nonNil(i.SuggestedStack), i.RegionalHurdles,
		i.SourceURL).Scan(&id)
	if err != nil {
		return nil, mapErr(err)
	}
	return s.GetIdea(ctx, id)
}

// SetApproved approves or unpublishes a problem.
func (s *Store) SetApproved(ctx context.Context, id string, approved bool) (*model.Idea, error) {
	if !IsUUID(id) {
		return nil, ErrNotFound
	}
	tag, err := s.pool.Exec(ctx, `update public.problems set admin_approved = $2 where id = $1`, id, approved)
	if err != nil {
		return nil, mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return s.GetIdea(ctx, id)
}

// ApproveAllProblems marks all currently unapproved problems as admin_approved = true.
func (s *Store) ApproveAllProblems(ctx context.Context) (int64, error) {
	tag, err := s.pool.Exec(ctx, `update public.problems set admin_approved = true where admin_approved = false`)
	if err != nil {
		return 0, mapErr(err)
	}
	return tag.RowsAffected(), nil
}

// ClaimIdea makes a dev the builder of an approved, available problem and
// moves it to In Progress. maxActive caps a dev's in-flight claims.
func (s *Store) ClaimIdea(ctx context.Context, ideaID, devID string, maxActive int) (*model.Idea, error) {
	if !IsUUID(ideaID) {
		return nil, ErrNotFound
	}
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		// Serialize claims per dev so the limit check cannot be raced.
		if _, err := tx.Exec(ctx, `select pg_advisory_xact_lock(hashtext($1))`, "claim:"+devID); err != nil {
			return err
		}
		var active int
		if err := tx.QueryRow(ctx, `select count(*) from public.claimed_projects
			where profile_id = $1 and collaboration_status = 'Active'`, devID).Scan(&active); err != nil {
			return err
		}
		if active >= maxActive {
			return ErrClaimLimit
		}
		var status string
		var approved bool
		err := tx.QueryRow(ctx, `select status, admin_approved from public.problems where id = $1 for update`, ideaID).
			Scan(&status, &approved)
		if err != nil {
			return err
		}
		switch {
		case !approved:
			return ErrNotApproved
		case status != model.StatusToDB(model.StatusOpen):
			return ErrNotOpen
		}
		if _, err := tx.Exec(ctx, `
			insert into public.claimed_projects (profile_id, problem_id, collaboration_status)
			values ($1, $2, 'Active')
			on conflict (profile_id, problem_id) do update
				set collaboration_status = 'Active', claimed_at = timezone('utc', now())`, devID, ideaID); err != nil {
			if errors.Is(mapErr(err), ErrConflict) { // someone else holds the active claim
				return ErrNotOpen
			}
			return err
		}
		_, err = tx.Exec(ctx, `update public.problems set status = 'In Progress', status_updated_at = now(), completed_at = null
			where id = $1`, ideaID)
		return err
	})
	if err != nil {
		return nil, mapErr(err)
	}
	return s.GetIdea(ctx, ideaID)
}

// SetIdeaStatus moves a problem between API statuses, guarded by the status
// the caller last saw, and keeps the builder's claim in step:
// open releases the claim, complete marks it Completed, and leaving
// complete reactivates it.
func (s *Store) SetIdeaStatus(ctx context.Context, ideaID, from, to string) (*model.Idea, error) {
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			update public.problems set
				status = $3,
				status_updated_at = now(),
				completed_at = case when $3 = 'Completed' then now() end
			where id = $1 and status = $2`, ideaID, model.StatusToDB(from), model.StatusToDB(to))
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return ErrStale
		}
		switch {
		case to == model.StatusOpen:
			// Release the in-progress claim only. This used to delete rows
			// where collaboration_status in ('Active', 'Completed'), which
			// destroyed the permanent record of every dev who had previously
			// completed this problem — including their timestamps, and with
			// them the basis for the skills ProvenSkills grants. A Completed
			// row is history, not a claim, and reopening a problem is an
			// admin action that must not silently rewrite who built what.
			_, err = tx.Exec(ctx, `delete from public.claimed_projects
				where problem_id = $1 and collaboration_status = 'Active'`, ideaID)
		case to == model.StatusComplete:
			_, err = tx.Exec(ctx, `update public.claimed_projects set collaboration_status = 'Completed'
				where problem_id = $1 and collaboration_status = 'Active'`, ideaID)
		case from == model.StatusComplete:
			_, err = tx.Exec(ctx, `update public.claimed_projects set collaboration_status = 'Active'
				where id = (select id from public.claimed_projects where problem_id = $1 and collaboration_status = 'Completed'
				            order by claimed_at desc limit 1)`, ideaID)
		}
		return err
	})
	if err != nil {
		return nil, mapErr(err)
	}
	return s.GetIdea(ctx, ideaID)
}

// ProvenSkills returns the tags and stack of problems a dev has proven:
// verified submissions or completed Launchpad builds.
//
// A Completed claim only counts when the same dev also has a verified
// submission for that problem. updateProblemStatus already enforces that at
// the API, but the claim row is what this query reads, and a row written
// before that rule existed — or by a migration, or by hand — would otherwise
// still grant skills for work nobody can point a reviewer at. Proven skills
// feed the job match score and the AI cover letter, so it has to mean
// something was actually verified.
func (s *Store) ProvenSkills(ctx context.Context, devID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		select distinct t from public.problems pr, unnest(coalesce(pr.tags, '{}') || pr.suggested_stack) t
		where pr.id in (select problem_id from public.submissions where profile_id = $1 and status = 'verified')
		   or pr.id in (
				select cp.problem_id from public.claimed_projects cp
				where cp.profile_id = $1 and cp.collaboration_status = 'Completed'
				  and exists (select 1 from public.submissions su
				              where su.profile_id = cp.profile_id
				                and su.problem_id = cp.problem_id
				                and su.status = 'verified')
		   )
		order by t`, devID)
	if err != nil {
		return nil, err
	}
	out, err := pgx.CollectRows(rows, pgx.RowTo[string])
	return nonNil(out), err
}
