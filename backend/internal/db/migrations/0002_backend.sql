-- Additive changes the Go API needs on top of the existing schema.
-- Only adds columns, tables and indexes; never drops or rewrites existing data.
-- New tables have RLS enabled with no policies: only the API (connecting as
-- postgres) can use them, not the public Supabase REST API.

-- Profiles: subscription plan. BYOK keys live in profile_secrets, because
-- profiles are publicly readable.
alter table public.profiles
    add column if not exists plan text not null default 'free';

create table if not exists public.profile_secrets (
    profile_id        uuid primary key references public.profiles (id) on delete cascade,
    api_key_encrypted bytea not null,
    updated_at        timestamptz not null default now()
);
alter table public.profile_secrets enable row level security;

-- Problems: Launchpad status bookkeeping.
alter table public.problems
    add column if not exists status_updated_at timestamptz not null default now(),
    add column if not exists completed_at      timestamptz;

-- One active builder per problem at a time.
create unique index if not exists claimed_projects_one_active_idx
    on public.claimed_projects (problem_id) where collaboration_status = 'Active';

-- Jobs: fields the job board filters and ranks on.
alter table public.jobs
    add column if not exists level           text not null default 'unspecified',
    add column if not exists employment_type text not null default 'Full-time',
    add column if not exists salary          text not null default '',
    add column if not exists posted_at       timestamptz,
    add column if not exists is_active       boolean not null default true;
create index if not exists jobs_source_url_idx on public.jobs (source_url);

-- Submissions: ledger review and certificate fields.
alter table public.submissions
    add column if not exists commit_sha   text,
    add column if not exists pr_number    integer,
    add column if not exists review_notes text,
    add column if not exists reviewed_by  uuid references public.profiles (id) on delete set null,
    add column if not exists certified_at timestamptz,
    add column if not exists valid_until  timestamptz;
create index if not exists submissions_profile_idx on public.submissions (profile_id, created_at desc);

-- ATS audits of a dev's CV. The CV text itself is not stored, only its hash.
create table if not exists public.cv_audits (
    id               uuid primary key default gen_random_uuid(),
    profile_id       uuid not null references public.profiles (id) on delete cascade,
    job_id           uuid references public.jobs (id) on delete set null,
    score            integer not null check (score between 0 and 100),
    summary          text not null default '',
    breakdown        jsonb not null default '[]'::jsonb,
    recommendations  jsonb not null default '[]'::jsonb,
    matched_keywords text[] not null default '{}',
    missing_keywords text[] not null default '{}',
    engine           text not null,
    model            text,
    cv_sha256        text not null,
    cv_chars         integer not null,
    created_at       timestamptz not null default now()
);
create index if not exists cv_audits_profile_idx on public.cv_audits (profile_id, created_at desc);
alter table public.cv_audits enable row level security;

-- Coaching tracks.
create table if not exists public.coaching_itineraries (
    id             text primary key,
    title          text not null,
    subtitle       text not null default '',
    target_role    text not null default '',
    duration_weeks integer not null default 0,
    milestones     jsonb not null default '[]'::jsonb,
    created_at     timestamptz not null default now()
);
alter table public.coaching_itineraries enable row level security;
