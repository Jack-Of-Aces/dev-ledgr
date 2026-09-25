package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/security"
)

const submissionSelect = `
	select s.hash, s.idea_id, i.title, u.username, u.name, u.avatar_url, s.repo_url, s.demo_url,
		s.commit_sha, s.pr_number, s.architecture_notes, s.created_at, s.status,
		s.tests_passed, s.tests_total, s.suite_name, s.latency_p99, s.throughput, s.coverage,
		s.review_notes, s.certificate_hash, s.certified_at, s.valid_until
	from submissions s
	join ideas i on i.id = s.idea_id
	join users u on u.id = s.author_id`

func scanSubmission(row pgx.Row) (*model.Submission, error) {
	var s model.Submission
	var demo, commit, latency, throughput, coverage, notes, cert *string
	var certifiedAt, validUntil *time.Time
	err := row.Scan(&s.Hash, &s.IdeaID, &s.IdeaTitle, &s.AuthorUsername, &s.AuthorName, &s.AuthorAvatar,
		&s.RepoURL, &demo, &commit, &s.PRNumber, &s.ArchitectureNotes, &s.Timestamp, &s.Status,
		&s.TestResults.Passed, &s.TestResults.Total, &s.TestResults.SuiteName,
		&latency, &throughput, &coverage, &notes, &cert, &certifiedAt, &validUntil)
	if err != nil {
		return nil, mapErr(err)
	}
	s.DemoURL = deref(demo)
	s.CommitHash = deref(commit)
	s.ReviewNotes = deref(notes)
	m := &model.Metrics{LatencyP99: deref(latency), Throughput: deref(throughput), Coverage: deref(coverage)}
	if !m.Empty() {
		s.Metrics = m
	}
	if cert != nil && certifiedAt != nil && validUntil != nil {
		s.Certificate = &model.Certificate{Hash: *cert, IssuedAt: *certifiedAt, ValidUntil: *validUntil}
	}
	return &s, nil
}

type SubmissionFilters struct {
	Username string
	Status   string
}

func (s *Store) ListSubmissions(ctx context.Context, f SubmissionFilters) ([]model.Submission, error) {
	rows, err := s.pool.Query(ctx, submissionSelect+`
		where ($1 = '' or lower(u.username) = lower($1))
		  and ($2 = '' or s.status = $2)
		order by s.created_at desc`, f.Username, f.Status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []model.Submission{}
	for rows.Next() {
		sub, err := scanSubmission(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *sub)
	}
	return out, rows.Err()
}

func (s *Store) GetSubmission(ctx context.Context, hash string) (*model.Submission, error) {
	return scanSubmission(s.pool.QueryRow(ctx, submissionSelect+` where s.hash = lower($1)`, hash))
}

type NewSubmission struct {
	Hash              string // optional; generated when empty
	IdeaID            string
	AuthorID          string
	RepoURL           string
	DemoURL           string
	CommitSHA         string
	PRNumber          *int
	ArchitectureNotes string
	Status            string
	CreatedAt         time.Time
	Tests             model.TestResults
	Metrics           model.Metrics
}

// CreateSubmission records a new ledger entry and bumps the idea's
// submission counter in the same transaction. The short ledger hash is a
// random 7-char hex id, regenerated on the rare collision.
func (s *Store) CreateSubmission(ctx context.Context, n NewSubmission) (string, error) {
	if n.Status == "" {
		n.Status = "pending"
	}
	if n.CreatedAt.IsZero() {
		n.CreatedAt = time.Now()
	}
	for attempt := 0; attempt < 5; attempt++ {
		hash := n.Hash
		if hash == "" {
			hash = security.RandomHex(7)
		}
		err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
			tag, err := tx.Exec(ctx, `update ideas set submission_count = submission_count + 1 where id = $1`, n.IdeaID)
			if err != nil {
				return err
			}
			if tag.RowsAffected() == 0 {
				return ErrNotFound
			}
			_, err = tx.Exec(ctx, `
				insert into submissions (hash, idea_id, author_id, repo_url, demo_url, commit_sha, pr_number,
					architecture_notes, status, created_at, tests_passed, tests_total, suite_name,
					latency_p99, throughput, coverage)
				values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
				hash, n.IdeaID, n.AuthorID, n.RepoURL, nullIfEmpty(n.DemoURL), nullIfEmpty(n.CommitSHA), n.PRNumber,
				n.ArchitectureNotes, n.Status, n.CreatedAt, n.Tests.Passed, n.Tests.Total, n.Tests.SuiteName,
				nullIfEmpty(n.Metrics.LatencyP99), nullIfEmpty(n.Metrics.Throughput), nullIfEmpty(n.Metrics.Coverage))
			return err
		})
		err = mapErr(err)
		if errors.Is(err, ErrConflict) && n.Hash == "" {
			continue
		}
		return hash, err
	}
	return "", ErrConflict
}

// DuplicateSubmission reports whether the author already has a non-rejected
// entry for the same idea and commit.
func (s *Store) DuplicateSubmission(ctx context.Context, authorID, ideaID, commitSHA string) (bool, error) {
	if commitSHA == "" {
		return false, nil
	}
	var dup bool
	err := s.pool.QueryRow(ctx, `select exists(select 1 from submissions
		where author_id = $1 and idea_id = $2 and commit_sha = $3 and status <> 'rejected')`,
		authorID, ideaID, commitSHA).Scan(&dup)
	return dup, err
}

type ReviewDecision struct {
	Hash        string
	ReviewerID  string
	Status      string // verified | rejected
	Tests       *model.TestResults
	Metrics     *model.Metrics
	Notes       string
	Certificate *model.Certificate
}

// RecordReview stores a reviewer decision. For verified entries it also
// extends the author's portfolio validity to the certificate expiry.
func (s *Store) RecordReview(ctx context.Context, d ReviewDecision) error {
	return mapErr(pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		var passed, total, suite, latency, throughput, coverage any
		if d.Tests != nil {
			passed, total, suite = d.Tests.Passed, d.Tests.Total, d.Tests.SuiteName
		}
		if d.Metrics != nil {
			latency, throughput, coverage = nullIfEmpty(d.Metrics.LatencyP99), nullIfEmpty(d.Metrics.Throughput), nullIfEmpty(d.Metrics.Coverage)
		}
		var certHash, certAt, validUntil any
		if d.Certificate != nil {
			certHash, certAt, validUntil = d.Certificate.Hash, d.Certificate.IssuedAt, d.Certificate.ValidUntil
		}
		var authorID string
		err := tx.QueryRow(ctx, `
			update submissions set
				status = $2,
				reviewed_by = $3,
				review_notes = $4,
				tests_passed = coalesce($5::int, tests_passed),
				tests_total = coalesce($6::int, tests_total),
				suite_name = coalesce($7::text, suite_name),
				latency_p99 = coalesce($8::text, latency_p99),
				throughput = coalesce($9::text, throughput),
				coverage = coalesce($10::text, coverage),
				certificate_hash = $11,
				certified_at = $12,
				valid_until = $13
			where hash = $1
			returning author_id::text`,
			d.Hash, d.Status, nullIfEmpty(d.ReviewerID), nullIfEmpty(d.Notes), passed, total, suite,
			latency, throughput, coverage, certHash, certAt, validUntil).Scan(&authorID)
		if err != nil {
			return err
		}
		if d.Certificate != nil {
			_, err = tx.Exec(ctx, `update users set portfolio_valid_until = greatest(coalesce(portfolio_valid_until, $2), $2),
				updated_at = now() where id = $1`, authorID, d.Certificate.ValidUntil)
		}
		return err
	}))
}
