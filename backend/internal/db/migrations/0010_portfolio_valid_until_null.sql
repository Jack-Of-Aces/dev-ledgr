-- 0010_portfolio_valid_until_null.sql
--
-- Profiles previously had `portfolio_valid_until default (now() + interval '1 year')`.
-- That meant any freshly created user profile immediately received an unearned
-- 1-year certificate validity window before even completing or verifying a single problem.
--
-- Certificate validity must only be granted upon successful submission verification
-- (via RecordReview in the submission store).

alter table public.profiles alter column portfolio_valid_until drop default;

-- Clear any unearned certificate validity for profiles that do not have
-- at least one verified submission.
update public.profiles p
set portfolio_valid_until = null
where not exists (
    select 1 from public.submissions s
    where s.profile_id = p.id
      and s.status = 'verified'
);
