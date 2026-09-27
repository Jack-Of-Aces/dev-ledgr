package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/security"
)

// Ledger entries live in public.submissions. Test results and metrics are
// JSON columns; the certificate stamp is stored in proof_signature.
const submissionSelect = `
	select s.hash, coalesce(s.problem_id::text, ''), coalesce(pr.title, ''),
		coalesce(p.username, s.author_username), coalesce(nullif(p.full_name, ''), s.author_name),
		coalesce(p.avatar_url, s.author_avatar, ''), s.repo_url, coalesce(s.demo_url, ''), coalesce(s.commit_sha, ''),
		s.pr_number, s.architecture_notes, coalesce(s.created_at, now()), coalesce(s.status, 'verified'),
		s.test_results::text, s.metrics::text, coalesce(s.review_notes, ''), s.proof_signature, s.certified_at, s.valid_until
	from public.submissions s
	left join public.problems pr on pr.id = s.problem_id
	left join public.profiles p on p.id = s.profile_id`

func scanSubmission(row pgx.Row) (*model.Submission, error) {
	var s model.Submission
	var tests, metrics string
	var cert *string
	var certifiedAt, validUntil *time.Time
	err := row.Scan(&s.Hash, &s.IdeaID, &s.IdeaTitle, &s.AuthorUsername, &s.AuthorName, &s.AuthorAvatar,
		&s.RepoURL, &s.DemoURL, &s.CommitHash, &s.PRNumber, &s.ArchitectureNotes, &s.Timestamp, &s.Status,
		&tests, &metrics, &s.ReviewNotes, &cert, &certifiedAt, &validUntil)
	if err != nil {
		return nil, mapErr(err)
	}
	// Lenient decoding: rows written by other tools may carry extra keys.
	_ = json.Unmarshal([]byte(tests), &s.TestResults)
	var m model.Metrics
	if json.Unmarshal([]byte(metrics), &m) == nil && !m.Empty() {
		s.Metrics = &m
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
		where ($1 = '' or lower(coalesce(p.username, s.author_username)) = lower($1))
		  and ($2 = '' or coalesce(s.status, 'verified') = $2)
		order by s.created_at desc nulls last`, f.Username, f.Status)
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
	return scanSubmission(s.pool.QueryRow(ctx, submissionSelect+` where lower(s.hash) = lower($1)`, hash))
}

type NewSubmission struct {
	IdeaID            string
	AuthorID          string
	RepoURL           string
	DemoURL           string
	CommitSHA         string
	PRNumber          *int
	ArchitectureNotes string
}

// CreateSubmission records a pending ledger entry and bumps the problem's
// submission counter in the same transaction. The public ledger hash is a
// random 7-char hex id, regenerated on the rare collision.
func (s *Store) CreateSubmission(ctx context.Context, n NewSubmission) (string, error) {
	if !IsUUID(n.IdeaID) {
		return "", ErrNotFound
	}
	for attempt := 0; attempt < 5; attempt++ {
		hash := security.RandomHex(7)
		err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
			tag, err := tx.Exec(ctx, `update public.problems set submission_count = coalesce(submission_count, 0) + 1
				where id = $1`, n.IdeaID)
			if err != nil {
				return err
			}
			if tag.RowsAffected() == 0 {
				return ErrNotFound
			}
			// Author name fields are denormalized on submissions; copy them from the profile.
			_, err = tx.Exec(ctx, `
				insert into public.submissions (hash, problem_id, profile_id, author_username, author_name, author_avatar,
					repo_url, demo_url, commit_sha, pr_number, architecture_notes, status, test_results, metrics)
				select $1, $2, p.id, p.username, coalesce(nullif(p.full_name, ''), p.username), p.avatar_url,
					$4, nullif($5, ''), nullif($6, ''), $7, $8, 'pending', '{"passed": 0, "total": 0}'::jsonb, '{}'::jsonb
				from public.profiles p where p.id = $3`,
				hash, n.IdeaID, n.AuthorID, n.RepoURL, n.DemoURL, n.CommitSHA, n.PRNumber, n.ArchitectureNotes)
			return err
		})
		err = mapErr(err)
		if errors.Is(err, ErrConflict) {
			continue
		}
		return hash, err
	}
	return "", ErrConflict
}

// DuplicateSubmission reports whether the author already has a non-rejected
// entry for the same problem and commit.
func (s *Store) DuplicateSubmission(ctx context.Context, authorID, ideaID, commitSHA string) (bool, error) {
	if commitSHA == "" || !IsUUID(ideaID) {
		return false, nil
	}
	var dup bool
	err := s.pool.QueryRow(ctx, `select exists(select 1 from public.submissions
		where profile_id = $1 and problem_id = $2 and commit_sha = $3 and coalesce(status, 'verified') <> 'rejected')`,
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
	var tests, metrics, certHash, certAt, validUntil any
	if d.Tests != nil {
		b, _ := json.Marshal(d.Tests)
		tests = string(b)
	}
	if d.Metrics != nil {
		b, _ := json.Marshal(d.Metrics)
		metrics = string(b)
	}
	if d.Certificate != nil {
		certHash, certAt, validUntil = d.Certificate.Hash, d.Certificate.IssuedAt, d.Certificate.ValidUntil
	}
	return mapErr(pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		var authorID *string
		err := tx.QueryRow(ctx, `
			update public.submissions set
				status = $2,
				reviewed_by = $3,
				review_notes = $4,
				test_results = coalesce($5::jsonb, test_results),
				metrics = coalesce($6::jsonb, metrics),
				proof_signature = $7,
				certified_at = $8,
				valid_until = $9
			where lower(hash) = lower($1)
			returning profile_id::text`,
			d.Hash, d.Status, nullIfEmpty(d.ReviewerID), nullIfEmpty(d.Notes), tests, metrics,
			certHash, certAt, validUntil).Scan(&authorID)
		if err != nil {
			return err
		}
		if d.Certificate != nil && authorID != nil {
			_, err = tx.Exec(ctx, `update public.profiles
				set portfolio_valid_until = greatest(coalesce(portfolio_valid_until, $2), $2), updated_at = now()
				where id = $1`, *authorID, d.Certificate.ValidUntil)
		}
		return err
	}))
}
