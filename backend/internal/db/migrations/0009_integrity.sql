-- Integrity constraints the API was already enforcing, but only in Go.
--
-- Every problem here is the same shape: the application checked something, the
-- database did not, and a race (or a direct write through the Supabase REST
-- API) could slip past it. These constraints make the rule the source of truth
-- and let the Go code stop compensating.

-- 1. submissions.status must never be unknown.
--
-- 0003_security.sql set the column default to 'pending' to stop forged ledger
-- entries, but left the column nullable, added no CHECK, and — critically —
-- never updated the read paths. submissionSelect still coalesced a NULL status
-- to 'verified', so a row with no status was served to the public portfolio as
-- a verified proof, and loadForReview then refused it with "already verified",
-- permanently stranding it in a state no reviewer could act on.
--
-- Backfill first, then constrain. A NULL here means "nobody said", which is
-- pending; it can never mean verified.
update public.submissions set status = 'pending' where status is null;

alter table public.submissions alter column status set not null;

alter table public.submissions drop constraint if exists submissions_status_check;
alter table public.submissions add constraint submissions_status_check
    check (status in ('pending', 'verified', 'rejected'));

-- 2. created_at is used for ordering and for the "how long ago" copy on the
-- dashboard. coalesce(created_at, now()) made that value change on every read.
update public.submissions set created_at = now() where created_at is null;
alter table public.submissions alter column created_at set not null;

-- 3. Usernames are compared case-insensitively everywhere in the API
-- (availability checks, lookups, the portfolio filter), but the uniqueness
-- constraint was byte-wise. Two profiles differing only in case could both
-- exist, and GetUserByUsername would then silently serve one dev's ledger on
-- the other's portfolio. Index the same expression the queries use.
create unique index if not exists profiles_username_lower_key
    on public.profiles (lower(username));

-- 4. Submission de-duplication.
--
-- DuplicateSubmission keyed on (profile_id, problem_id, commit_sha) with no
-- backing constraint, and it ran in a separate transaction from the insert, so
-- two concurrent requests both passed the check and both inserted — minting two
-- independently signed certificates for one commit. The partial unique index
-- makes the second one fail at the database.
--
-- Rejected rows are excluded so a dev can resubmit after a rejection, matching
-- the predicate the store already used.
create unique index if not exists submissions_dedup_key
    on public.submissions (profile_id, problem_id, commit_sha)
    where commit_sha is not null and status <> 'rejected';

-- 5. The scraper addresses jobs by source_url and upserts, so it must be
-- unique. It was only indexed, never constrained: two concurrent ingests of a
-- new listing both took the INSERT path and created duplicate rows that every
-- later scrape then updated in lockstep, double-counting the listing forever.
--
-- The two live duplicates are identical rows a minute apart with no cv_audits
-- pointing at them (audits.job_id is on delete set null, but we keep the row the
-- audits reference). Keep the newest of each group and drop the rest.
with ranked as (
    select id,
           row_number() over (partition by source_url order by scraped_at desc, id desc) as rn,
           exists (select 1 from public.cv_audits a where a.job_id = jobs.id) as has_audits
    from public.jobs
    where source_url is not null
)
delete from public.jobs j
using ranked r
where j.id = r.id and r.rn > 1 and not r.has_audits;

create unique index if not exists jobs_source_url_key
    on public.jobs (source_url)
    where source_url is not null;
