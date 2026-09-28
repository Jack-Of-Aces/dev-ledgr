-- The settings form has always collected an engineering track, a target role, a
-- seniority level and a linked GitHub handle, and sent them on every save. The
-- Go API rejected the whole request with "unknown field engineeringTrack"
-- because profileUpdateRequest had no case for them, so the values were never
-- stored anywhere: they lived in the zustand store until a reload discarded
-- them. These columns are what the API and the form agree on.
--
-- onboarding_completed joins them because the login redirect reads it off the
-- profile. It was only ever derived from Supabase user_metadata, which the
-- account holder can edit, and it vanished entirely once the authoritative dev
-- record replaced the provisional one after sign-in.
--
-- Not null with a default so existing profiles backfill without a rewrite, and
-- so the API's coalesce() calls in profileSelect stay honest about the type.

alter table public.profiles
    add column if not exists engineering_track   text not null default '',
    add column if not exists target_role         text not null default '',
    add column if not exists experience_level    text not null default '',
    add column if not exists github_username     text not null default '',
    add column if not exists github_connected    boolean not null default false,
    add column if not exists onboarding_completed boolean not null default false;

-- The GitHub handle is shown on the public profile and used to match commits
-- against a dev, so it needs to be findable without a table scan.
create index if not exists profiles_github_username_idx
    on public.profiles (lower(github_username)) where github_username <> '';
