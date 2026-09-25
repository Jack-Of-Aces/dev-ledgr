-- DevLedgr core schema.
-- Targets Supabase Postgres (15+). The Go API connects with the service
-- (postgres) role, which bypasses RLS. RLS is enabled with no policies so the
-- public Supabase REST API (anon / authenticated keys) cannot read or write
-- any of these tables directly.

create extension if not exists pgcrypto;

create table if not exists users (
    id                    uuid primary key default gen_random_uuid(),
    username              text not null,
    name                  text not null,
    email                 text,
    avatar_url            text not null default '',
    headline              text not null default '',
    bio                   text not null default '',
    github_url            text not null default '',
    github_id             bigint unique,
    plan                  text not null default 'free' check (plan in ('free', 'full-service', 'byok')),
    api_key_encrypted     bytea,
    stated_skills         text[] not null default '{}',
    role                  text not null default 'user' check (role in ('user', 'reviewer', 'admin')),
    portfolio_valid_until timestamptz,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now(),
    constraint users_username_format check (username ~ '^[a-zA-Z0-9_-]{3,30}$')
);
create unique index if not exists users_username_lower_idx on users (lower(username));
create unique index if not exists users_email_lower_idx on users (lower(email)) where email is not null;

create table if not exists sessions (
    token_hash bytea primary key,
    user_id    uuid not null references users (id) on delete cascade,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);
create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_expires_at_idx on sessions (expires_at);

create table if not exists magic_links (
    token_hash bytea primary key,
    email      text not null,
    expires_at timestamptz not null,
    used_at    timestamptz,
    created_at timestamptz not null default now()
);
create index if not exists magic_links_email_idx on magic_links (lower(email), created_at desc);

create table if not exists ideas (
    id                     text primary key,
    title                  text not null,
    tagline                text not null default '',
    domain                 text not null check (domain in ('fintech', 'systems', 'logistics', 'ai', 'security', 'devtools')),
    difficulty             text not null check (difficulty in ('foundational', 'intermediate', 'production-grade')),
    estimated_hours        integer not null default 0 check (estimated_hours >= 0),
    origin_story           text not null default '',
    problem_statement      text not null default '',
    technical_requirements text[] not null default '{}',
    mock_infra             jsonb not null default '{}'::jsonb,
    tags                   text[] not null default '{}',
    submission_count       integer not null default 0,
    created_by             uuid references users (id) on delete set null,
    created_at             timestamptz not null default now()
);
create index if not exists ideas_domain_idx on ideas (domain);
create index if not exists ideas_difficulty_idx on ideas (difficulty);

create table if not exists submissions (
    hash               text primary key,
    idea_id            text not null references ideas (id) on delete restrict,
    author_id          uuid not null references users (id) on delete cascade,
    repo_url           text not null,
    demo_url           text,
    commit_sha         text,
    pr_number          integer,
    architecture_notes text not null default '',
    status             text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
    tests_passed       integer not null default 0,
    tests_total        integer not null default 0,
    suite_name         text not null default '',
    latency_p99        text,
    throughput         text,
    coverage           text,
    review_notes       text,
    reviewed_by        uuid references users (id) on delete set null,
    certificate_hash   text,
    certified_at       timestamptz,
    valid_until        timestamptz,
    created_at         timestamptz not null default now()
);
create index if not exists submissions_author_idx on submissions (author_id, created_at desc);
create index if not exists submissions_idea_idx on submissions (idea_id);
create index if not exists submissions_status_idx on submissions (status);

create table if not exists jobs (
    id               text primary key,
    title            text not null,
    company          text not null,
    location         text not null default '',
    type             text not null check (type in ('Full-time', 'Contract', 'Remote')),
    salary           text not null default '',
    tags             text[] not null default '{}',
    match_score      integer not null default 0 check (match_score between 0 and 100),
    matched_idea_ids text[] not null default '{}',
    required_skills  text[] not null default '{}',
    description      text not null default '',
    gap_idea_id      text references ideas (id) on delete set null,
    gap_reason       text,
    created_at       timestamptz not null default now()
);

create table if not exists coaching_itineraries (
    id             text primary key,
    title          text not null,
    subtitle       text not null default '',
    target_role    text not null default '',
    duration_weeks integer not null default 0,
    milestones     jsonb not null default '[]'::jsonb,
    created_at     timestamptz not null default now()
);

alter table users enable row level security;
alter table sessions enable row level security;
alter table magic_links enable row level security;
alter table ideas enable row level security;
alter table submissions enable row level security;
alter table jobs enable row level security;
alter table coaching_itineraries enable row level security;
