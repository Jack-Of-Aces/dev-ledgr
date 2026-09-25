package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

const ideaColumns = `id, title, tagline, domain, difficulty, estimated_hours, origin_story, problem_statement,
	technical_requirements, mock_infra::text, tags, submission_count`

func scanIdea(row pgx.Row) (*model.Idea, error) {
	var i model.Idea
	var infra string
	err := row.Scan(&i.ID, &i.Title, &i.Tagline, &i.Domain, &i.Difficulty, &i.EstimatedHours, &i.OriginStory,
		&i.ProblemStatement, &i.TechnicalRequirements, &infra, &i.Tags, &i.SubmissionCount)
	if err != nil {
		return nil, mapErr(err)
	}
	if err := json.Unmarshal([]byte(infra), &i.MockInfra); err != nil {
		return nil, fmt.Errorf("decode mock_infra for %s: %w", i.ID, err)
	}
	i.TechnicalRequirements = nonNil(i.TechnicalRequirements)
	i.Tags = nonNil(i.Tags)
	if i.MockInfra.Endpoints == nil {
		i.MockInfra.Endpoints = []model.MockEndpoint{}
	}
	i.MockInfra.TestCriteria = nonNil(i.MockInfra.TestCriteria)
	return &i, nil
}

type IdeaFilters struct {
	Domain, Difficulty, Search string
}

func (s *Store) ListIdeas(ctx context.Context, f IdeaFilters) ([]model.Idea, error) {
	var where []string
	var args []any
	add := func(cond string, v any) {
		args = append(args, v)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}
	if f.Domain != "" {
		add("domain = $%d", f.Domain)
	}
	if f.Difficulty != "" {
		add("difficulty = $%d", f.Difficulty)
	}
	if q := strings.TrimSpace(f.Search); q != "" {
		// Escape LIKE wildcards so user input is matched literally.
		q = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(q)
		add(`(title ilike '%%' || $%[1]d || '%%' or tagline ilike '%%' || $%[1]d || '%%'
			or exists (select 1 from unnest(tags) t where t ilike '%%' || $%[1]d || '%%'))`, q)
	}
	sql := `select ` + ideaColumns + ` from ideas`
	if len(where) > 0 {
		sql += ` where ` + strings.Join(where, " and ")
	}
	sql += ` order by created_at, id`

	rows, err := s.pool.Query(ctx, sql, args...)
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

func (s *Store) GetIdea(ctx context.Context, id string) (*model.Idea, error) {
	return scanIdea(s.pool.QueryRow(ctx, `select `+ideaColumns+` from ideas where id = $1`, id))
}

// CreateIdea inserts a new challenge. createdBy may be empty (seed data).
func (s *Store) CreateIdea(ctx context.Context, i model.Idea, createdBy string) (*model.Idea, error) {
	infra, err := json.Marshal(i.MockInfra)
	if err != nil {
		return nil, err
	}
	return scanIdea(s.pool.QueryRow(ctx, `
		insert into ideas (id, title, tagline, domain, difficulty, estimated_hours, origin_story, problem_statement,
			technical_requirements, mock_infra, tags, submission_count, created_by)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13)
		returning `+ideaColumns,
		i.ID, i.Title, i.Tagline, i.Domain, i.Difficulty, i.EstimatedHours, i.OriginStory, i.ProblemStatement,
		nonNil(i.TechnicalRequirements), string(infra), nonNil(i.Tags), i.SubmissionCount, nullIfEmpty(createdBy)))
}
