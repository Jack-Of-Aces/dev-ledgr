-- Where a dev wants recruiters to reach them.
--
-- The settings form has had an editable email field labelled "used exclusively
-- for receiving high-signal match inquiries from hiring managers" since before
-- there was anywhere to put it. PATCH /api/v1/users/me accepted the key and
-- dropped it on the floor, so a dev could change it, see the save succeed, and
-- lose the edit with no warning. Meanwhile internal/ai/contactEmail fell back to
-- the auth address, so the *login* identity was what ended up in generated CVs.
--
-- This is a different address from the auth one and needs its own column:
-- auth.users.email is Supabase's, is used to sign in and to verify GitHub
-- ownership, and must stay out of CV generation and off the public portfolio.
-- Keeping them apart also means a dev can list a contact address that is not
-- the one their account is registered to.

alter table public.profiles
    add column if not exists contact_email text not null default '';
