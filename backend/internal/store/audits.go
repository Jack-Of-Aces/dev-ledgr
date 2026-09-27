package store

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

const auditSelect = `
	select a.id::text, u.username, a.job_id::text, a.score, a.summary, a.breakdown::text, a.recommendations::text,
		a.matched_keywords, a.missing_keywords, a.engine, a.model, a.cv_chars, a.created_at, a.profile_id::text
	from public.cv_audits a join public.profiles u on u.id = a.profile_id`

// scanAudit returns the audit and the owning dev id.
func scanAudit(row pgx.Row) (*model.CVAudit, string, error) {
	var a model.CVAudit
	var jobID, mdl *string
	var breakdown, recs, devID string
	err := row.Scan(&a.ID, &a.DevUsername, &jobID, &a.Score, &a.Summary, &breakdown, &recs,
		&a.MatchedKeywords, &a.MissingKeywords, &a.Engine, &mdl, &a.CVChars, &a.CreatedAt, &devID)
	if err != nil {
		return nil, "", mapErr(err)
	}
	a.JobID, a.Model = deref(jobID), deref(mdl)
	if err := json.Unmarshal([]byte(breakdown), &a.Breakdown); err != nil {
		return nil, "", err
	}
	if err := json.Unmarshal([]byte(recs), &a.Recommendations); err != nil {
		return nil, "", err
	}
	a.MatchedKeywords, a.MissingKeywords = nonNil(a.MatchedKeywords), nonNil(a.MissingKeywords)
	return &a, devID, nil
}

type NewAudit struct {
	DevID    string
	JobID    string
	Result   model.CVAudit
	CVSHA256 string
}

func (s *Store) CreateAudit(ctx context.Context, n NewAudit) (*model.CVAudit, error) {
	breakdown, err := json.Marshal(n.Result.Breakdown)
	if err != nil {
		return nil, err
	}
	recs, err := json.Marshal(n.Result.Recommendations)
	if err != nil {
		return nil, err
	}
	var id string
	err = s.pool.QueryRow(ctx, `
		insert into public.cv_audits (profile_id, job_id, score, summary, breakdown, recommendations, matched_keywords,
			missing_keywords, engine, model, cv_sha256, cv_chars)
		values ($1, $2::uuid, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12)
		returning id::text`,
		n.DevID, nullIfEmpty(n.JobID), n.Result.Score, n.Result.Summary, string(breakdown), string(recs),
		nonNil(n.Result.MatchedKeywords), nonNil(n.Result.MissingKeywords), n.Result.Engine,
		nullIfEmpty(n.Result.Model), n.CVSHA256, n.Result.CVChars).Scan(&id)
	if err != nil {
		return nil, mapErr(err)
	}
	a, _, err := s.GetAudit(ctx, id)
	return a, err
}

// GetAudit returns an audit and the id of the dev who owns it.
func (s *Store) GetAudit(ctx context.Context, id string) (*model.CVAudit, string, error) {
	if !IsUUID(id) {
		return nil, "", ErrNotFound
	}
	return scanAudit(s.pool.QueryRow(ctx, auditSelect+` where a.id = $1`, id))
}

func (s *Store) ListAudits(ctx context.Context, devID string, limit int) ([]model.CVAudit, error) {
	rows, err := s.pool.Query(ctx, auditSelect+` where a.profile_id = $1 order by a.created_at desc limit $2`, devID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.CVAudit{}
	for rows.Next() {
		a, _, err := scanAudit(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}
