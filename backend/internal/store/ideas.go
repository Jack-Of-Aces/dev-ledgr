package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

var (
	ErrNotOpen    = errors.New("problem is not open for claiming")
	ErrClaimLimit = errors.New("active claim limit reached")
	ErrStale      = errors.New("problem changed concurrently")
)

const ideaSelect = `
	select i.id, i.title, i.tagline, i.domain, i.difficulty, i.estimated_hours, i.origin_story, i.problem_statement,
		i.technical_requirements, i.mock_infra::text, i.tags, i.submission_count,
		i.status, i.claimed_at, i.status_updated_at, i.completed_at,
		c.id::text, c.username, c.name, c.avatar_url
	from ideas i
	left join users c on c.id = i.claimed_by`

func scanIdea(row pgx.Row) (*model.Idea, error) {
	var i model.Idea
	var infra string
	var cID, cUsername, cName, cAvatar *string
	err := row.Scan(&i.ID, &i.Title, &i.Tagline, &i.Domain, &i.Difficulty, &i.EstimatedHours, &i.OriginStory,
		&i.ProblemStatement, &i.TechnicalRequirements, &infra, &i.Tags, &i.SubmissionCount,
		&i.Status, &i.ClaimedAt, &i.StatusUpdatedAt, &i.CompletedAt,
		&cID, &cUsername, &cName, &cAvatar)
	if err != nil {
		return nil, mapErr(err)
	}
	if err := json.Unmarshal([]byte(infra), &i.MockInfra); err != nil {
		return nil, fmt.Errorf("decode mock_infra for %s: %w", i.ID, err)
	}
	if cID != nil {
		i.ClaimedBy = &model.DevRef{ID: *cID, Username: deref(cUsername), Name: deref(cName), AvatarURL: deref(cAvatar)}
	}
	i.TechnicalRequirements = nonNil(i.TechnicalRequirements)
	i.Tags = nonNil(i.Tags)
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

type IdeaFilters struct {
	Domain, Difficulty, Search, Status string
}

func (s *Store) ListIdeas(ctx context.Context, f IdeaFilters) ([]model.Idea, error) {
	var where []string
	var args []any
	add := func(cond string, v any) {
		args = append(args, v)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}
	if f.Domain != "" {
		add("i.domain = $%d", f.Domain)
	}
	if f.Difficulty != "" {
		add("i.difficulty = $%d", f.Difficulty)
	}
	if f.Status != "" {
		add("i.status = $%d", f.Status)
	}
	if q := strings.TrimSpace(f.Search); q != "" {
		// Escape LIKE wildcards so user input is matched literally.
		q = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(q)
		add(`(i.title ilike '%%' || $%[1]d || '%%' or i.tagline ilike '%%' || $%[1]d || '%%'
			or exists (select 1 from unnest(i.tags) t where t ilike '%%' || $%[1]d || '%%'))`, q)
	}
	sql := ideaSelect
	if len(where) > 0 {
		sql += ` where ` + strings.Join(where, " and ")
	}
	sql += ` order by i.created_at, i.id`
	return collectIdeas(s.pool.Query(ctx, sql, args...))
}

func (s *Store) GetIdea(ctx context.Context, id string) (*model.Idea, error) {
	return scanIdea(s.pool.QueryRow(ctx, ideaSelect+` where i.id = $1`, id))
}

// IdeasByClaimant lists problems a dev holds, optionally filtered by status.
func (s *Store) IdeasByClaimant(ctx context.Context, devID string, statuses ...string) ([]model.Idea, error) {
	return collectIdeas(s.pool.Query(ctx, ideaSelect+`
		where i.claimed_by = $1 and (cardinality($2::text[]) = 0 or i.status = any($2))
		order by i.status_updated_at desc`, devID, nonNil(statuses)))
}

// CreateIdea inserts a new challenge. createdBy may be empty (seed data).
func (s *Store) CreateIdea(ctx context.Context, i model.Idea, createdBy string) (*model.Idea, error) {
	infra, err := json.Marshal(i.MockInfra)
	if err != nil {
		return nil, err
	}
	_, err = s.pool.Exec(ctx, `
		insert into ideas (id, title, tagline, domain, difficulty, estimated_hours, origin_story, problem_statement,
			technical_requirements, mock_infra, tags, submission_count, created_by)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13)`,
		i.ID, i.Title, i.Tagline, i.Domain, i.Difficulty, i.EstimatedHours, i.OriginStory, i.ProblemStatement,
		nonNil(i.TechnicalRequirements), string(infra), nonNil(i.Tags), i.SubmissionCount, nullIfEmpty(createdBy))
	if err != nil {
		return nil, mapErr(err)
	}
	return s.GetIdea(ctx, i.ID)
}

// ClaimIdea assigns an open problem to a dev and moves it to in_progress.
// maxActive caps how many in-flight problems one dev may hold.
func (s *Store) ClaimIdea(ctx context.Context, ideaID, devID string, maxActive int) (*model.Idea, error) {
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		// Serialize claims per dev so the limit check cannot be raced.
		if _, err := tx.Exec(ctx, `select pg_advisory_xact_lock(hashtext($1))`, "claim:"+devID); err != nil {
			return err
		}
		var active int
		if err := tx.QueryRow(ctx, `select count(*) from ideas
			where claimed_by = $1 and status in ('in_progress', 'seeking_contributors')`, devID).Scan(&active); err != nil {
			return err
		}
		if active >= maxActive {
			return ErrClaimLimit
		}
		tag, err := tx.Exec(ctx, `
			update ideas set claimed_by = $2, claimed_at = now(), status = 'in_progress', status_updated_at = now()
			where id = $1 and status = 'open' and claimed_by is null`, ideaID, devID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			var exists bool
			if err := tx.QueryRow(ctx, `select exists(select 1 from ideas where id = $1)`, ideaID).Scan(&exists); err != nil {
				return err
			}
			if !exists {
				return ErrNotFound
			}
			return ErrNotOpen
		}
		return nil
	})
	if err != nil {
		return nil, mapErr(err)
	}
	return s.GetIdea(ctx, ideaID)
}

// SetIdeaStatus moves a problem to a new status, guarded by the status the
// caller last saw. Moving to open releases the claim.
func (s *Store) SetIdeaStatus(ctx context.Context, ideaID, from, to string) (*model.Idea, error) {
	var completedAt any
	if to == model.StatusComplete {
		completedAt = time.Now()
	}
	tag, err := s.pool.Exec(ctx, `
		update ideas set
			status = $3,
			status_updated_at = now(),
			completed_at = $4,
			claimed_by = case when $3 = 'open' then null else claimed_by end,
			claimed_at = case when $3 = 'open' then null else claimed_at end
		where id = $1 and status = $2`, ideaID, from, to, completedAt)
	if err != nil {
		return nil, mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrStale
	}
	return s.GetIdea(ctx, ideaID)
}

// ProvenSkills returns tags of problems a dev has proven: verified
// submissions or completed Launchpad builds.
func (s *Store) ProvenSkills(ctx context.Context, devID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		select distinct t from ideas i, unnest(i.tags) t
		where i.id in (select idea_id from submissions where author_id = $1 and status = 'verified')
		   or (i.claimed_by = $1 and i.status = 'complete')
		order by t`, devID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}
