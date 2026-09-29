-- Admin job lifecycle: hide a listing, or remove it.
--
-- public.jobs.is_active has existed since 0002_backend, but nothing could write
-- it: the only mutations were the admin create and the scraper upsert. An admin
-- had no way to take a bad or expired listing off the board.
--
-- Two operations are needed and they mean different things:
--
--   * is_active = false — hide the listing from developers. Reversible from the
--     console, which is the right tool for a role that is simply filled.
--   * deleted_at        — remove it for good. The scraper addresses rows by
--     source_url and upserts them, so a hard DELETE would be undone the next
--     time that listing is scraped; the tombstone is what makes a removal
--     stick. Keeping the row also leaves cv_audits.job_id pointing at the audit
--     it belongs to, where a hard delete would null it (on delete set null) and
--     orphan every stored ATS audit for that role.
--
-- Every public read path filters `deleted_at is null`. The moderation list does
-- not, so a removed job stays inspectable.

alter table public.jobs
    add column if not exists deleted_at timestamptz;

-- The public board reads admin_approved and is_active and skips tombstones;
-- the moderation list reads is_active and deleted_at. One composite index
-- serves both.
create index if not exists jobs_lifecycle_idx
    on public.jobs (admin_approved, is_active, deleted_at);
