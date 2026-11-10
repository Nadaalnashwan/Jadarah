-- JADARAH — 0011 explicit function grants
-- Signed-in users may call the RLS helpers and business RPCs (each re-checks authorization).
grant execute on all functions in schema public to authenticated, service_role;

-- Internal helpers, trigger functions and seed tooling are never callable through the API.
revoke execute on function public.notify(uuid, text, text, text, text, text, text) from authenticated;
revoke execute on function public.write_audit(text, text, uuid, uuid, jsonb) from authenticated;
revoke execute on function public.notify_company_recruiters(uuid, text, text, text, text, text, text) from authenticated;
revoke execute on function public._transition_application(uuid, public.application_status, text, text) from authenticated;
revoke execute on function public._demo_user(uuid, text, text, text, text) from authenticated;
revoke execute on function public.seed_demo(text) from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.protect_profile_columns() from authenticated;
revoke execute on function public.protect_company_columns() from authenticated;
revoke execute on function public.enforce_job_publication() from authenticated;
revoke execute on function public.enforce_application_transition() from authenticated;
revoke execute on function public.enforce_interview_shortlist() from authenticated;
revoke execute on function public.set_updated_at() from authenticated;

alter default privileges in schema public grant execute on functions to service_role;
