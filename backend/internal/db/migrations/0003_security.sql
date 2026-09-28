-- Closes write paths through Supabase's public REST API (anon/authenticated
-- keys) that bypassed the API's rules. All writes to these tables now go
-- through the Go API, which connects as postgres, or tools using the
-- service_role key; both bypass RLS and are unaffected.
-- Public read access is unchanged.

-- 1. Users could update their whole profile row, including role (self-promotion
--    to admin) and portfolio_valid_until. They may now update only the
--    descriptive columns of their own row (the existing RLS policy still limits
--    it to their own row).
revoke update on public.profiles from anon, authenticated;
grant update (username, full_name, avatar_url, bio, skills, portfolio_url, headline, github_url, updated_at)
    on public.profiles to authenticated;

-- 2. problems and jobs had RLS disabled, so the anon key could insert, update
--    or delete every row. Enabling RLS keeps the existing public read policies
--    and blocks all writes except from postgres / service_role.
alter table public.problems enable row level security;
alter table public.jobs enable row level security;

-- 3. Any signed-in user could insert submissions for any profile, defaulting to
--    status 'verified' (forged ledger entries). Submissions are created by the
--    API, which starts them as 'pending' until a reviewer verifies them.
drop policy if exists "Users can create verified submissions" on public.submissions;
alter table public.submissions alter column status set default 'pending';

-- 4. Users could insert, update or delete their own claims directly, skipping
--    the API's rules (approved problems only, one active builder, the claim
--    limit, keeping problems.status in step). Claims now go through the API.
drop policy if exists "Allow authenticated users to claim a project" on public.claimed_projects;
drop policy if exists "Allow owners to update their claimed project status" on public.claimed_projects;
drop policy if exists "Allow owners to delete their claimed project" on public.claimed_projects;
