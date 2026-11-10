-- JADARAH — 0009 landing showcase (anonymised demo data only) + guarded demo reset

-- Public, read-only, anonymised view of DEMO records for the landing page.
-- Only rows flagged is_demo are read; candidate identities are reduced to aliases.
create or replace function public.landing_showcase()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_cand uuid; v_job uuid; v_company uuid; v_result jsonb;
begin
  select a.candidate_id, a.job_id into v_cand, v_job
  from public.applications a
  join public.profiles p on p.id = a.candidate_id and p.is_demo
  join public.jobs j on j.id = a.job_id
  where exists (select 1 from public.job_skills js where js.job_id = j.id)
    and a.status in ('shortlisted', 'interview_scheduled', 'interview_completed', 'assessment_completed')
  order by p.email, a.submitted_at
  limit 1;
  select company_id into v_company from public.jobs where id = v_job;

  select jsonb_build_object(
    'stats', jsonb_build_object(
      'companies', (select count(*) from public.company_profiles where is_demo and status = 'approved'),
      'jobs', (select count(*) from public.jobs j join public.company_profiles c on c.id = j.company_id where c.is_demo and j.status = 'published'),
      'candidates', (select count(*) from public.profiles p join public.user_roles r on r.user_id = p.id and r.role = 'candidate' where p.is_demo),
      'assessments', (select count(*) from public.assessments where company_id is null and status = 'published'),
      'resources', (select count(*) from public.learning_resources where is_active)),
    'candidate', case when v_cand is null then null else (
      select jsonb_build_object(
        'first_name', split_part(p.full_name, ' ', 1),
        'headline', cp.headline,
        'years_experience', cp.years_experience,
        'skills', coalesce((select jsonb_agg(jsonb_build_object('skill_id', s.id, 'slug', s.slug, 'name_en', s.name_en, 'name_ar', s.name_ar,
            'level', cs.level, 'source', cs.source, 'evidence', cs.evidence) order by cs.level desc, s.name_en)
          from public.candidate_skills cs join public.skills s on s.id = cs.skill_id where cs.candidate_id = v_cand), '[]'),
        'applications', coalesce((select jsonb_agg(jsonb_build_object('status', a.status, 'title_en', j.title_en, 'title_ar', j.title_ar,
            'company_en', c.name_en, 'company_ar', c.name_ar) order by a.submitted_at desc)
          from public.applications a join public.jobs j on j.id = a.job_id join public.company_profiles c on c.id = a.company_id
          where a.candidate_id = v_cand), '[]'),
        'assessment', (select jsonb_build_object('title_en', asm.title_en, 'title_ar', asm.title_ar, 'percentage', s.percentage)
          from public.assessment_submissions s join public.assessment_assignments aa on aa.id = s.assignment_id
          join public.assessments asm on asm.id = aa.assessment_id
          where s.candidate_id = v_cand and s.status = 'evaluated' order by s.submitted_at desc limit 1))
      from public.profiles p join public.candidate_profiles cp on cp.user_id = p.id where p.id = v_cand) end,
    'job', case when v_job is null then null else (
      select jsonb_build_object('title_en', j.title_en, 'title_ar', j.title_ar, 'company_en', c.name_en, 'company_ar', c.name_ar, 'min_years', j.min_years,
        'skills', coalesce((select jsonb_agg(jsonb_build_object('skill_id', s.id, 'name_en', s.name_en, 'name_ar', s.name_ar,
            'importance', js.importance, 'min_level', js.min_level) order by js.importance, s.name_en)
          from public.job_skills js join public.skills s on s.id = js.skill_id where js.job_id = j.id), '[]'))
      from public.jobs j join public.company_profiles c on c.id = j.company_id where j.id = v_job) end,
    'company', case when v_company is null then null else (
      select jsonb_build_object('name_en', c.name_en, 'name_ar', c.name_ar,
        'funnel', jsonb_build_object(
          'applied', (select count(*) from public.applications where company_id = c.id),
          'reviewed', (select count(*) from public.applications where company_id = c.id and status <> 'submitted'),
          'assessed', (select count(distinct application_id) from public.assessment_assignments where company_id = c.id and status in ('submitted', 'evaluated')),
          'shortlisted', (select count(*) from public.applications where company_id = c.id and was_shortlisted),
          'interviewed', (select count(distinct application_id) from public.interviews where company_id = c.id),
          'hired', (select count(*) from public.applications where company_id = c.id and status = 'hired')),
        'candidates', coalesce((select jsonb_agg(x.obj) from (
            select jsonb_build_object(
              'alias', chr(65 + (row_number() over (order by a.match_score desc nulls last, a.id))::int - 1),
              'years', cp.years_experience,
              'skills', coalesce((select jsonb_agg(jsonb_build_object('skill_id', s.id, 'slug', s.slug, 'name_en', s.name_en, 'name_ar', s.name_ar,
                  'level', cs.level, 'source', cs.source, 'evidence', null))
                from public.candidate_skills cs join public.skills s on s.id = cs.skill_id where cs.candidate_id = a.candidate_id), '[]')) obj
            from public.applications a join public.candidate_profiles cp on cp.user_id = a.candidate_id
            join public.profiles p on p.id = a.candidate_id and p.is_demo
            where a.job_id = v_job limit 4) x), '[]'),
        'upcoming_interviews', (select count(*) from public.interviews where company_id = c.id and status = 'scheduled' and scheduled_at > now()))
      from public.company_profiles c where c.id = v_company and c.is_demo) end,
    'plan', (select jsonb_build_object('title_en', dp.title_en, 'title_ar', dp.title_ar, 'estimated_weeks', dp.estimated_weeks,
        'required_skill_slugs', dp.required_skill_slugs,
        'items', coalesce((select jsonb_agg(jsonb_build_object('title_en', i.title_en, 'title_ar', i.title_ar, 'skill_slug', i.skill_slug,
            'estimated_hours', i.estimated_hours) order by i.position) from public.development_plan_items i where i.plan_id = dp.id), '[]'))
      from public.development_plans dp where dp.is_template order by (dp.role_slug = 'junior-data-analyst') desc, dp.role_slug limit 1)
  ) into v_result;
  return v_result;
end $$;
grant execute on function public.landing_showcase() to anon, authenticated;

create or replace function public.public_contact_email()
returns text language sql stable security definer set search_path = '' as $$
  select value #>> '{}' from public.platform_settings where key = 'contact_email';
$$;
grant execute on function public.public_contact_email() to anon, authenticated;

-- Guarded demo reset: removes ONLY is_demo identities/companies (cascades to their records).
-- Refuses unless platform_settings.environment is explicitly 'demo' or 'local'.
create or replace function public.demo_reset()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_env text; v_users int; v_companies int;
begin
  select value #>> '{}' into v_env from public.platform_settings where key = 'environment';
  if coalesce(v_env, '') not in ('demo', 'local') then
    raise exception 'demo reset refused: environment is "%" (must be demo or local)', coalesce(v_env, 'unset');
  end if;
  if auth.uid() is not null and not public.is_super_admin() then
    raise exception 'super admin only' using errcode = '42501';
  end if;
  delete from public.company_profiles where is_demo;
  get diagnostics v_companies = row_count;
  delete from auth.users where id in (select id from public.profiles where is_demo);
  get diagnostics v_users = row_count;
  perform public.write_audit('demo.reset', 'platform', null, null, jsonb_build_object('users', v_users, 'companies', v_companies));
  return jsonb_build_object('users_removed', v_users, 'companies_removed', v_companies);
end $$;
revoke execute on function public.demo_reset() from public, anon;
grant execute on function public.demo_reset() to authenticated;

insert into public.platform_settings (key, value, description) values
  ('environment', '"demo"', 'local | demo | production — guards demo seed/reset'),
  ('ai.require_human_review', 'true', 'AI-generated job posts and assessments require human approval before publication'),
  ('applications.max_active_per_candidate', '25', 'Soft limit on simultaneously active applications'),
  ('uploads.max_cv_mb', '10', 'Maximum CV upload size in MB')
on conflict (key) do nothing;
