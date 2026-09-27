-- Sends Supabase Auth user events to POST /api/auth/webhook so the API can
-- create, sync and delete DevLedgr dev records.
--
-- Run once in the Supabase SQL editor, after replacing the two values below.
-- The API also creates a dev record on a user's first authenticated request,
-- so a delayed or failed webhook never locks anyone out.

create extension if not exists pg_net;

-- 1. Store the endpoint and shared secret in Supabase Vault (not in code).
--    The secret must equal SUPABASE_WEBHOOK_SECRET in the API's environment.
select vault.create_secret('https://api.your-domain.com/api/auth/webhook', 'devledgr_webhook_url');
select vault.create_secret('replace-with-a-long-random-secret', 'devledgr_webhook_secret');

-- 2. Trigger function. Only id, email and metadata are sent; never
--    to_jsonb(new), which would include the password hash.
create or replace function public.devledgr_auth_user_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook_url    text := (select decrypted_secret from vault.decrypted_secrets where name = 'devledgr_webhook_url');
  hook_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'devledgr_webhook_secret');
begin
  perform net.http_post(
    url     := hook_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || hook_secret),
    body    := jsonb_build_object(
      'type',   tg_op,
      'schema', tg_table_schema,
      'table',  tg_table_name,
      'record', case when tg_op = 'DELETE' then null else jsonb_build_object(
        'id', new.id, 'email', new.email,
        'raw_user_meta_data', new.raw_user_meta_data, 'raw_app_meta_data', new.raw_app_meta_data) end,
      'old_record', case when tg_op = 'INSERT' then null else jsonb_build_object('id', old.id, 'email', old.email) end
    ),
    timeout_milliseconds := 5000
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists devledgr_auth_user_webhook on auth.users;
create trigger devledgr_auth_user_webhook
  after insert or delete or update of email, raw_user_meta_data on auth.users
  for each row execute function public.devledgr_auth_user_webhook();
