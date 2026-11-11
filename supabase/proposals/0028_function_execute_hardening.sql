-- PROPOSAL — NOT APPLIED. Awaiting owner approval (see docs/proposals/0028-function-execute-hardening.md).
-- Kept outside supabase/migrations/ so `supabase db push` or the import scripts cannot apply it by accident.
-- On approval: copy to supabase/migrations/20261111000028_function_execute_hardening.sql and apply.
--
-- Why anon can call these today: their ACL contains `=X/postgres`, i.e. EXECUTE granted to PUBLIC
-- (the Postgres default for new functions). `anon` inherits PUBLIC, so revoking from `anon` alone is
-- not enough; the grant must be revoked from PUBLIC and given back explicitly to the roles that need it.

begin;

-- 1. Four functions anonymous visitors never need --------------------------------------------------
-- attach_job_task / update_company_identity: write RPCs; they already refuse callers without a
--   company role, so this is least privilege only (no behaviour change for signed-in users).
-- match_reference_assessments: SECURITY INVOKER; RLS already hides reference embeddings from anon.
-- assessment_is_in_use: see section 2.
revoke execute on function public.attach_job_task(uuid, uuid) from public, anon;
revoke execute on function public.update_company_identity(uuid, text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.match_reference_assessments(text, text, integer) from public, anon;
grant execute on function public.attach_job_task(uuid, uuid) to authenticated, service_role;
grant execute on function public.update_company_identity(uuid, text, text, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.match_reference_assessments(text, text, integer) to authenticated, service_role;

-- 2. Assessment existence leak ---------------------------------------------------------------------
-- assessment_is_in_use(uuid) is SECURITY DEFINER and answers "has any candidate been assigned this
-- assessment?" for ANY id, to anyone (anon included). It stays as the internal helper used by the
-- lock triggers (lock_assigned_task_content / lock_assigned_task_meta are SECURITY DEFINER owned by
-- postgres, so they keep working after the API grants are removed).
revoke execute on function public.assessment_is_in_use(uuid) from public, anon, authenticated;
grant execute on function public.assessment_is_in_use(uuid) to service_role;

-- API-facing replacement: answers only for people who may manage that assessment
-- (its company's admins/recruiters, or a Super Admin); everyone else gets NULL (no signal either way).
create or replace function public.assessment_in_use_for_manager(p_assessment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when public.can_manage_assessment(p_assessment)
              then public.assessment_is_in_use(p_assessment) end;
$$;
revoke execute on function public.assessment_in_use_for_manager(uuid) from public, anon;
grant execute on function public.assessment_in_use_for_manager(uuid) to authenticated, service_role;

-- 3. rls_auto_enable() ------------------------------------------------------------------------------
-- Supabase's event-trigger function behind the `ensure_rls` event trigger (enables RLS on every new
-- public table). Migration 0011's `grant execute on all functions in schema public to authenticated`
-- also granted it to signed-in users. A function returning event_trigger cannot be called directly
-- (Postgres refuses), so this is hygiene: the event trigger runs as its owner and is unaffected.
-- Created by Supabase (not by our migrations), so only touched when present.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

commit;

-- ROLLBACK (restores today's grants exactly; run only if something regresses) ----------------------
-- begin;
-- grant execute on function public.attach_job_task(uuid, uuid) to public;
-- grant execute on function public.update_company_identity(uuid, text, text, text, text, text, text, text) to public;
-- grant execute on function public.match_reference_assessments(text, text, integer) to public;
-- grant execute on function public.assessment_is_in_use(uuid) to public, authenticated;
-- grant execute on function public.rls_auto_enable() to authenticated;
-- drop function if exists public.assessment_in_use_for_manager(uuid);  -- only after the app stops calling it
-- commit;
