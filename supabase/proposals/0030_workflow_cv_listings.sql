-- JADARAH — 0030 recruitment workflow, CV onboarding and listing provenance  (PROPOSED — requires owner approval)
-- The application code works with or without this migration; it moves the same rules into the database.
--  A. New candidates get their candidate_profiles row at sign-up (CV upload references it before onboarding ends).
--  B. Applications whose job practical task is still outstanding can only be rejected or hired by the employer —
--     review and shortlist wait for the submitted evidence. Hiring still never requires a shortlist.
--  C. Listing provenance: 'employer' = posted by the organization from its workspace (new default);
--     'simulation' stays for imported practice scenarios only; 'verified' = external vacancy with a source.
--  D. Super Admin statistics exclude demo identities, demo companies and imported practice listings.
--  E. The demo-data landing showcase is no longer exposed (the landing page no longer calls it).

-- =================================================================== A. candidate profile row at sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_type text := coalesce(new.raw_user_meta_data ->> 'account_type', 'candidate');
  v_locale text := coalesce(new.raw_user_meta_data ->> 'locale', 'ar');
begin
  if v_type not in ('candidate', 'company') then
    v_type := 'candidate';
  end if;
  if v_locale not in ('ar', 'en') then
    v_locale := 'ar';
  end if;
  insert into public.profiles (id, email, full_name, locale, account_type, consent_accepted_at)
  values (
    new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''), v_locale, v_type,
    case when (new.raw_user_meta_data ->> 'consent') = 'true' then now() else null end
  )
  on conflict (id) do nothing;
  if v_type = 'candidate' then
    insert into public.user_roles (user_id, role) values (new.id, 'candidate') on conflict do nothing;
    insert into public.candidate_profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  end if;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Existing candidates without a profile row (e.g. signed up but never finished onboarding).
insert into public.candidate_profiles (user_id)
select r.user_id from public.user_roles r
where r.role = 'candidate' and not exists (select 1 from public.candidate_profiles c where c.user_id = r.user_id)
on conflict (user_id) do nothing;

-- =================================================================== B. no review/shortlist before the task is submitted
create or replace function public.change_application_status(
  p_app uuid, p_to public.application_status, p_reason text default null, p_candidate_message text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_app public.applications;
begin
  select * into v_app from public.applications where id = p_app;
  if v_app.id is null or not public.can_recruit(v_app.company_id) then
    raise exception 'not authorized for this application' using errcode = '42501';
  end if;
  -- These states are produced only by their workflows (assessment submission, interview scheduling/completion, candidate withdrawal).
  if p_to in ('assessment_completed', 'interview_scheduled', 'interview_completed', 'withdrawn', 'submitted') then
    raise exception 'status "%" is set automatically by its workflow', p_to using errcode = 'P0001';
  end if;
  -- The job's practical task is outstanding: the evidence is incomplete, so only rejection or a Hired decision.
  if v_app.requires_task and v_app.completed_at is null and p_to not in ('rejected', 'hired') then
    raise exception 'the candidate has not submitted the practical task yet' using errcode = 'P0001';
  end if;
  if not public.application_transition_allowed(v_app.status, p_to) then
    raise exception 'invalid status transition: % -> %', v_app.status, p_to using errcode = 'P0001';
  end if;
  perform public._transition_application(p_app, p_to, p_reason, p_candidate_message);
end $$;
grant execute on function public.change_application_status(uuid, public.application_status, text, text) to authenticated;

-- =================================================================== C. listing provenance
alter table public.jobs drop constraint if exists jobs_listing_type_check;
alter table public.jobs add constraint jobs_listing_type_check check (listing_type in ('verified', 'employer', 'simulation'));
alter table public.jobs alter column listing_type set default 'employer';
-- Jobs written by an organization member were labelled 'simulation' only because of the old column default.
update public.jobs set listing_type = 'employer' where listing_type = 'simulation' and created_by is not null;

-- =================================================================== D. statistics without demo/practice records
create or replace function public.admin_platform_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'super admin only' using errcode = '42501'; end if;
  return (
    with rp as (select * from public.profiles where not is_demo),
         rc as (select * from public.company_profiles where not is_demo),
         rj as (select j.* from public.jobs j join rc on rc.id = j.company_id
                where j.listing_type <> 'simulation' or j.created_by is not null),
         ra as (select a.* from public.applications a join rp on rp.id = a.candidate_id join rc on rc.id = a.company_id)
    select jsonb_build_object(
      'users', (select count(*) from rp),
      'candidates', (select count(*) from public.user_roles r join rp on rp.id = r.user_id where r.role = 'candidate'),
      'companies', (select count(*) from rc),
      'companies_by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from rc group by status) s),
      'pending_companies', (select count(*) from rc where status in ('pending', 'info_requested')),
      'active_jobs', (select count(*) from rj where status = 'published'),
      'applications', (select count(*) from ra),
      'applications_by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from ra group by status) s),
      'interviews', (select count(*) from public.interviews i join ra on ra.id = i.application_id),
      'hires', (select count(*) from ra where status = 'hired'),
      'assessments_submitted', (select count(*) from public.assessment_submissions s join rp on rp.id = s.candidate_id where s.status <> 'in_progress'),
      'ai_requests_30d', (select count(*) from public.ai_provider_logs where created_at > now() - interval '30 days'),
      'user_growth', (select coalesce(jsonb_agg(jsonb_build_object('month', m, 'count', n) order by m), '[]') from (
        select to_char(date_trunc('month', created_at), 'YYYY-MM') m, count(*) n from rp group by 1) g),
      'application_growth', (select coalesce(jsonb_agg(jsonb_build_object('month', m, 'count', n) order by m), '[]') from (
        select to_char(date_trunc('month', submitted_at), 'YYYY-MM') m, count(*) n from ra group by 1) g),
      'active_users_30d', (select count(distinct n.user_id) from public.notifications n join rp on rp.id = n.user_id where n.read_at > now() - interval '30 days')
    )
  );
end $$;

-- =================================================================== E. demo showcase no longer public
do $$ begin
  if to_regprocedure('public.landing_showcase()') is not null then
    revoke execute on function public.landing_showcase() from anon, authenticated;
  end if;
end $$;
