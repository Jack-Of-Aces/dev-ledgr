-- Baseline: the DevLedgr schema as it exists in the team's Supabase project
-- (profiles, problems, claimed_projects, jobs, submissions). Every statement
-- is guarded with IF NOT EXISTS, so on the live project this is a no-op; it
-- lets a fresh Supabase project (or a local copy) be built from scratch.
--
-- Not included: the handle_new_user() trigger on auth.users and the RLS
-- policies. Both are managed in Supabase directly. The API creates missing
-- profiles itself, so it does not depend on the trigger.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id                    uuid primary key references auth.users (id) on delete cascade,
    username              text not null unique,
    full_name             text,
    avatar_url            text,
    bio                   text,
    skills                text[],
    portfolio_url         text,
    updated_at            timestamptz not null default timezone('utc', now()),
    headline              text,
    role                  text default 'candidate',
    github_url            text,
    portfolio_valid_until timestamptz default (now() + interval '1 year'),
    created_at            timestamptz default now()
);

create table if not exists public.problems (
    id                     uuid primary key default gen_random_uuid(),
    title                  text not null unique,
    problem_statement      text not null,
    suggested_stack        text[] not null,
    regional_hurdles       text not null,
    status                 text not null default 'Available',
    created_at             timestamptz not null default timezone('utc', now()),
    source_url             text,
    admin_approved         boolean not null default false,
    tagline                text,
    domain                 text default 'infrastructure',
    difficulty             text default 'hard',
    estimated_hours        integer default 18,
    origin_story           text,
    technical_requirements text[] default '{}',
    mock_infra             jsonb default '{}'::jsonb,
    tags                   text[] default '{}',
    submission_count       integer default 0
);
create index if not exists idx_problems_status on public.problems (status);

create table if not exists public.claimed_projects (
    id                   uuid primary key default gen_random_uuid(),
    profile_id           uuid not null references public.profiles (id) on delete cascade,
    problem_id           uuid not null references public.problems (id) on delete cascade,
    collaboration_status text not null default 'Active',
    github_repo_url      text,
    claimed_at           timestamptz not null default timezone('utc', now()),
    unique (profile_id, problem_id)
);
create index if not exists idx_claimed_projects_profile on public.claimed_projects (profile_id);
create index if not exists idx_claimed_projects_problem on public.claimed_projects (problem_id);

create table if not exists public.jobs (
    id              uuid primary key default gen_random_uuid(),
    title           text not null,
    company         text not null,
    location        text not null,
    job_description text not null,
    required_skills text[] not null,
    apply_url       text not null,
    scraped_at      timestamptz not null default timezone('utc', now()),
    source_url      text,
    admin_approved  boolean not null default true,
    gap_problem_id  uuid references public.problems (id) on delete set null,
    gap_reason      text,
    match_score     integer default 85
);

create table if not exists public.submissions (
    id                 uuid primary key default gen_random_uuid(),
    hash               text not null unique,
    problem_id         uuid references public.problems (id) on delete cascade,
    profile_id         uuid references public.profiles (id) on delete set null,
    author_username    text not null,
    author_name        text not null,
    author_avatar      text,
    repo_url           text not null,
    demo_url           text,
    architecture_notes text not null,
    status             text default 'verified',
    test_results       jsonb not null default '{"total": 0, "passed": 0}'::jsonb,
    metrics            jsonb not null default '{"latencyP99": "0ms", "throughput": "0 req/s"}'::jsonb,
    proof_signature    text,
    created_at         timestamptz default now()
);
