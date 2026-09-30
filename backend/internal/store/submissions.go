package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/security"
)

// Ledger entries live in public.submissions. Test results and metrics are
// JSON columns; the certificate stamp is stored in proof_signature.
//
// Nothing here coalesces. The column used to be read as
// coalesce(s.status, 'verified'), which meant a row with no status was served
// to the public portfolio as a verified proof; migration 0009 makes status NOT
// NULL with a CHECK, so the database now guarantees a value and the read path
// can simply take it.
//
// s.author_username is the snapshot taken at insert time rather than the
// current profiles.username, for the same reason: it is the field the ledger
// certificate signs, and getCertificate recomputes the signature from this row.
// A live join would let a rename invalidate every certificate the dev holds,
// and would show a name that no signature attests to. The display name and
// avatar still track the profile — they are cosmetic and unsigned.
const submissionSelect = `
	select s.hash, coalesce(s.problem_id::text, ''), coalesce(pr.title, ''),
		s.author_username, coalesce(nullif(p.full_name, ''), s.author_name),
		coalesce(p.avatar_url, s.author_avatar, ''), s.repo_url, coalesce(s.demo_url, ''), coalesce(s.commit_sha, ''),
		s.pr_number, s.architecture_notes, s.created_at, s.status,
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

// Pagination bounds for ListSubmissions. The endpoint used to have neither, so
// a caller could ask for every submission on the platform — including other
// devs' pending, unverified work — in one response.
const (
	DefaultSubmissionLimit = 50
	MaxSubmissionLimit     = 200
)

type SubmissionFilters struct {
	Username string
	Status   string
	Limit    int
	Offset   int
}

// ListSubmissions returns ledger entries newest-first, optionally narrowed to
// one author and/or one status.
//
// The username filter compares against the same s.author_username snapshot the
// rows are displayed under, so a renamed dev's filter and their rendered
// entries can never disagree. It is case-insensitive to match how the API
// resolves usernames everywhere else.
func (s *Store) ListSubmissions(ctx context.Context, f SubmissionFilters) ([]model.Submission, error) {
	limit := f.Limit
	if limit <= 0 {
		limit = DefaultSubmissionLimit
	}
	if limit > MaxSubmissionLimit {
		limit = MaxSubmissionLimit
	}
	offset := max(f.Offset, 0)
	rows, err := s.pool.Query(ctx, submissionSelect+`
		where ($1 = '' or lower(s.author_username) = lower($1))
		  and ($2 = '' or s.status = $2)
		order by s.created_at desc
		limit $3 offset $4`, f.Username, f.Status, limit, offset)
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

// GetSubmission looks an entry up by its public hash. The comparison is
// byte-wise so the unique index on submissions.hash is usable; the previous
// lower(s.hash) = lower($1) could only ever be satisfied by a full scan, and
// RandomHex only ever emits lowercase anyway.
func (s *Store) GetSubmission(ctx context.Context, hash string) (*model.Submission, error) {
	return scanSubmission(s.pool.QueryRow(ctx, submissionSelect+` where s.hash = $1`, hash))
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

var (
	// ErrCommitRequired reports a submission with no commit hash. The hash is
	// the de-duplication key; without it the row escapes the dedup index and
	// the same work can be re-registered under a fresh ledger hash forever.
	ErrCommitRequired = errors.New("commitSha is required")
	// ErrDuplicateSubmission reports that this author already has a
	// non-rejected entry for the same problem and commit.
	ErrDuplicateSubmission = errors.New("commit already submitted for this idea")
)

// isDedupViolation distinguishes the dedup index from every other unique
// violation. Both surface as SQLSTATE 23505 and mapErr collapses them to the
// same ErrConflict, but only one of them is worth retrying: a submissions.hash
// collision means "mint a new hash", a submissions_dedup_key violation means
// "this exact commit is already on the ledger" and retrying cannot help.
func isDedupViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) &&
		pgErr.Code == "23505" &&
		pgErr.ConstraintName == "submissions_dedup_key"
}

// CreateSubmission records a pending ledger entry and bumps the problem's
// submission counter in the same transaction. The public ledger hash is a
// random 7-char hex id, regenerated on the rare collision.
func (s *Store) CreateSubmission(ctx context.Context, n NewSubmission) (string, error) {
	if !IsUUID(n.IdeaID) {
		return "", ErrNotFound
	}
	if n.CommitSHA == "" {
		return "", ErrCommitRequired
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
			tag, err = tx.Exec(ctx, `
				insert into public.submissions (hash, problem_id, profile_id, author_username, author_name, author_avatar,
					repo_url, demo_url, commit_sha, pr_number, architecture_notes, status, test_results, metrics)
				select $1, $2, p.id, p.username, coalesce(nullif(p.full_name, ''), p.username), p.avatar_url,
					$4, nullif($5, ''), nullif($6, ''), $7, $8, 'pending', '{"passed": 0, "total": 0}'::jsonb, '{}'::jsonb
				from public.profiles p where p.id = $3`,
				hash, n.IdeaID, n.AuthorID, n.RepoURL, n.DemoURL, n.CommitSHA, n.PRNumber, n.ArchitectureNotes)
			if err != nil {
				return err
			}
			// The insert is a select from profiles, so an unknown author id
			// matches no row and reports success. Without this check the
			// counter was still incremented and a hash was returned for an
			// entry that does not exist.
			if tag.RowsAffected() == 0 {
				return ErrNotFound
			}
			return nil
		})
		if isDedupViolation(err) {
			return "", ErrDuplicateSubmission
		}
		err = mapErr(err)
		if errors.Is(err, ErrConflict) {
			continue // ledger hash collision: mint another
		}
		return hash, err
	}
	return "", ErrConflict
}

// HasVerifiedSubmission reports whether this dev has a verified ledger entry
// for the problem. Completing a problem requires one, so that a dev cannot
// mark someone else's verified work complete and collect its skills as their
// own — the self-grant that the claim -> complete -> provenSkills path allowed.
func (s *Store) HasVerifiedSubmission(ctx context.Context, devID, ideaID string) (bool, error) {
	if !IsUUID(ideaID) {
		return false, nil
	}
	var ok bool
	err := s.pool.QueryRow(ctx, `select exists(select 1 from public.submissions
		where profile_id = $1 and problem_id = $2 and status = 'verified')`, devID, ideaID).Scan(&ok)
	return ok, err
}

// DuplicateSubmission reports whether the author already has a non-rejected
// entry for the same problem and commit.
//
// This is an advisory pre-check for a friendlier error message. The real
// guarantee is the submissions_dedup_key index: the check and the insert ran
// in separate transactions, so two concurrent requests both passed it and both
// inserted, minting two independently signed certificates for one commit.
func (s *Store) DuplicateSubmission(ctx context.Context, authorID, ideaID, commitSHA string) (bool, error) {
	if commitSHA == "" || !IsUUID(ideaID) {
		return false, nil
	}
	var dup bool
	err := s.pool.QueryRow(ctx, `select exists(select 1 from public.submissions
		where profile_id = $1 and problem_id = $2 and commit_sha = $3 and status <> 'rejected')`,
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

// ErrAlreadyReviewed reports a review decision against an entry that was no
// longer pending. The API checks the status before deciding, then wrote the
// decision in a separate transaction, so two reviewers racing on the same
// pending entry both passed the check and both stamped it — the second
// overwriting the first reviewer's tests, metrics and certificate.
var ErrAlreadyReviewed = errors.New("submission is no longer pending")

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
		// status = 'pending' is the compare-and-set. It is what makes the
		// decision exclusive; without it the row is overwritten.
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
			where hash = $1 and status = 'pending'
			returning profile_id::text`,
			d.Hash, d.Status, nullIfEmpty(d.ReviewerID), nullIfEmpty(d.Notes), tests, metrics,
			certHash, certAt, validUntil).Scan(&authorID)
		if errors.Is(err, pgx.ErrNoRows) {
			// Either it is gone or someone else decided first. Say so rather
			// than silently reporting the reviewer's own decision back.
			return ErrAlreadyReviewed
		}
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
