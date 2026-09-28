-- Which identity provider the account was created with.
--
-- The frontend derived this from the Supabase JWT and kept it in the zustand
-- store, but the store is overwritten wholesale by the authoritative dev record
-- after sign-in, and the dev record had no such field. So the value was always
-- gone by the time settings or onboarding read it, and both treated a GitHub
-- OAuth user as if no GitHub account were linked. That is why those pages asked
-- a GitHub user to re-verify a handle GitHub had already proven, and why
-- settings then refused to send it: PATCH /api/v1/users/me only trusts the
-- handle once it is already the stored one.
--
-- It is deliberately not settable through the profile update endpoint. It
-- describes where the account came from, not what the dev chose, so it stays
-- server-derived and cannot be edited to claim a provider the account does not
-- use. Note this is separate from github_connected, which tracks a linked
-- GitHub account and *is* user-settable: a Google user can link GitHub.

alter table public.profiles
    add column if not exists auth_provider text not null default '';
