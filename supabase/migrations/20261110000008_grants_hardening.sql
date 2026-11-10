-- JADARAH — 0008 grant hardening
-- Functions created after 0006 picked up Supabase's default EXECUTE grant to anon.
revoke execute on function public.can_read_storage_object(text, text) from public, anon;
revoke execute on function public.can_write_storage_object(text, text) from public, anon;
-- Future functions in public are not executable by anon unless granted explicitly.
alter default privileges in schema public revoke execute on functions from public, anon;
