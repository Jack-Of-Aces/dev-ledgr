-- 0003 granted signed-in users UPDATE on the descriptive columns of their own
-- profile. The live project never granted the anon/authenticated roles any
-- table privileges (the Data API has no access to these tables), so that grant
-- added a write path that did not exist before. Profile edits go through the
-- API, so remove it: public roles keep no write access to profiles.
revoke update on public.profiles from anon, authenticated;
