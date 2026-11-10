-- JADARAH — 0005 row level security
-- Every table in the public schema has RLS enabled. Privileged writes go through
-- SECURITY DEFINER functions (0006) that re-check authorization and business rules.

-- ---------------------------------------------------------------- access helpers
create or replace function public.is_interview_participant(p_interview uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.interview_participants ip
    where ip.interview_id = p_interview and ip.user_id = auth.uid()
  );
$$;

create or replace function public.can_view_application(p_app uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    where a.id = p_app and (
      a.candidate_id = auth.uid()
      or public.can_recruit(a.company_id)
      or public.is_super_admin()
      or exists (
        select 1 from public.interviews i
        join public.interview_participants ip on ip.interview_id = i.id
        where i.application_id = a.id and ip.user_id = auth.uid()
      )
    )
  );
$$;

create or replace function public.can_recruit_application(p_app uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    where a.id = p_app and (public.can_recruit(a.company_id) or public.is_super_admin())
  );
$$;

-- Who may see a candidate's profile:
--  * the candidate, Super Admin
--  * recruiters of companies the candidate applied to
--  * recruiters of APPROVED companies when the candidate opted in to discovery (visibility = 'companies')
--  * interviewers assigned to one of the candidate's interviews
create or replace function public.can_view_candidate(p_candidate uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    p_candidate = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1 from public.applications a
      where a.candidate_id = p_candidate and public.can_recruit(a.company_id)
    )
    or exists (
      select 1 from public.candidate_profiles cp
      join public.company_memberships m on m.user_id = auth.uid() and m.status = 'active' and m.role in ('company_admin', 'recruiter')
      join public.company_profiles c on c.id = m.company_id and c.status = 'approved'
      where cp.user_id = p_candidate and cp.visibility = 'companies'
    )
    or exists (
      select 1 from public.applications a
      join public.interviews i on i.application_id = a.id
      join public.interview_participants ip on ip.interview_id = i.id
      where a.candidate_id = p_candidate and ip.user_id = auth.uid()
    );
$$;

create or replace function public.can_view_document(p_doc uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.candidate_documents d
    where d.id = p_doc and d.deleted_at is null and (
      d.candidate_id = auth.uid()
      or public.is_super_admin()
      or exists (
        select 1 from public.applications a
        where (a.cv_document_id = d.id or exists (
            select 1 from public.application_documents ad where ad.application_id = a.id and ad.document_id = d.id))
          and (public.can_recruit(a.company_id) or exists (
            select 1 from public.interviews i join public.interview_participants ip on ip.interview_id = i.id
            where i.application_id = a.id and ip.user_id = auth.uid()))
      )
    )
  );
$$;

create or replace function public.can_view_job(p_job uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.jobs j
    join public.company_profiles c on c.id = j.company_id
    where j.id = p_job and (
      (j.status in ('published', 'closed') and c.status = 'approved')
      or public.has_company_role(j.company_id)
      or public.is_super_admin()
      or exists (select 1 from public.applications a where a.job_id = j.id and a.candidate_id = auth.uid())
    )
  );
$$;

create or replace function public.can_manage_job(p_job uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.jobs j where j.id = p_job and (public.can_recruit(j.company_id) or public.is_super_admin()));
$$;

create or replace function public.can_manage_assessment(p_assessment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assessments a
    where a.id = p_assessment and (
      public.is_super_admin()
      or (a.company_id is not null and public.can_recruit(a.company_id))
    )
  );
$$;

-- Library assessments are readable by recruiters of approved companies; company ones by their recruiters;
-- assigned candidates see metadata (never questions/answer keys via table access).
create or replace function public.can_view_assessment(p_assessment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assessments a
    where a.id = p_assessment and (
      public.can_manage_assessment(a.id)
      or (a.company_id is null and a.status = 'published' and exists (
        select 1 from public.company_memberships m
        join public.company_profiles c on c.id = m.company_id and c.status = 'approved'
        where m.user_id = auth.uid() and m.status = 'active' and m.role in ('company_admin', 'recruiter')))
      or exists (select 1 from public.assessment_assignments aa where aa.assessment_id = a.id and aa.candidate_id = auth.uid())
    )
  );
$$;

create or replace function public.can_view_assessment_content(p_assessment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assessments a
    where a.id = p_assessment and (
      public.can_manage_assessment(a.id)
      or (a.company_id is null and a.status = 'published' and exists (
        select 1 from public.company_memberships m
        join public.company_profiles c on c.id = m.company_id and c.status = 'approved'
        where m.user_id = auth.uid() and m.status = 'active' and m.role in ('company_admin', 'recruiter')))
    )
  );
$$;

create or replace function public.shares_company_with(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_memberships a
    join public.company_memberships b on a.company_id = b.company_id
    where a.user_id = auth.uid() and a.status = 'active' and b.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------- enable RLS everywhere
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------- identity
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_super_admin() or public.can_view_candidate(id) or public.shares_company_with(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.is_super_admin());

create policy companies_select_public on public.company_profiles for select to anon, authenticated
  using (status = 'approved');
create policy companies_select_member on public.company_profiles for select to authenticated
  using (public.has_company_role(id) or public.is_super_admin());
create policy companies_update_admin on public.company_profiles for update to authenticated
  using (public.has_company_role(id, array['company_admin']::public.membership_role[]) or public.is_super_admin())
  with check (public.has_company_role(id, array['company_admin']::public.membership_role[]) or public.is_super_admin());

create or replace function public.protect_company_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_super_admin() then
    if new.status is distinct from old.status or new.approved_at is distinct from old.approved_at
      or new.approved_by is distinct from old.approved_by or new.status_reason is distinct from old.status_reason
      or new.is_demo is distinct from old.is_demo or new.slug is distinct from old.slug then
      raise exception 'only platform administrators can change company status' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger company_profiles_protect before update on public.company_profiles for each row execute function public.protect_company_columns();

create policy memberships_select on public.company_memberships for select to authenticated
  using (user_id = (select auth.uid()) or public.has_company_role(company_id) or public.is_super_admin());

create policy invitations_select on public.company_invitations for select to authenticated
  using (public.has_company_role(company_id, array['company_admin']::public.membership_role[]) or public.is_super_admin()
         or lower(email) = lower((select auth.jwt() ->> 'email')));

create policy verification_select on public.company_verification_requests for select to authenticated
  using (public.has_company_role(company_id) or public.is_super_admin());

-- ---------------------------------------------------------------- reference data (public read)
create policy skill_categories_read on public.skill_categories for select to anon, authenticated using (true);
create policy skills_read on public.skills for select to anon, authenticated using (true);
create policy job_categories_read on public.job_categories for select to anon, authenticated using (true);
create policy learning_resources_read on public.learning_resources for select to anon, authenticated using (is_active or public.is_super_admin());
create policy skills_admin on public.skills for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy skill_categories_admin on public.skill_categories for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy job_categories_admin on public.job_categories for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy learning_resources_admin on public.learning_resources for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------- candidates
create policy candidate_profiles_select on public.candidate_profiles for select to authenticated
  using (public.can_view_candidate(user_id));
create policy candidate_profiles_insert on public.candidate_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy candidate_profiles_update on public.candidate_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['candidate_education', 'candidate_experience', 'candidate_skills', 'candidate_certifications', 'candidate_projects'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.can_view_candidate(candidate_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (candidate_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (candidate_id = (select auth.uid())) with check (candidate_id = (select auth.uid()))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (candidate_id = (select auth.uid()))', t || '_delete', t);
  end loop;
end $$;

create policy candidate_documents_select on public.candidate_documents for select to authenticated
  using (public.can_view_document(id) or (candidate_id = (select auth.uid())));
create policy candidate_documents_insert on public.candidate_documents for insert to authenticated
  with check (candidate_id = (select auth.uid()) and storage_path like (select auth.uid())::text || '/%');
create policy candidate_documents_update on public.candidate_documents for update to authenticated
  using (candidate_id = (select auth.uid())) with check (candidate_id = (select auth.uid()));
create policy candidate_documents_delete on public.candidate_documents for delete to authenticated
  using (candidate_id = (select auth.uid()));

create policy candidate_preferences_own on public.candidate_preferences for all to authenticated
  using (candidate_id = (select auth.uid())) with check (candidate_id = (select auth.uid()));

-- ---------------------------------------------------------------- jobs
create policy jobs_select on public.jobs for select to anon, authenticated using (public.can_view_job(id));
create policy jobs_insert on public.jobs for insert to authenticated with check (public.can_recruit(company_id));
create policy jobs_update on public.jobs for update to authenticated
  using (public.can_recruit(company_id) or public.is_super_admin()) with check (public.can_recruit(company_id) or public.is_super_admin());
create policy jobs_delete on public.jobs for delete to authenticated
  using (status = 'draft' and public.has_company_role(company_id, array['company_admin']::public.membership_role[]));

do $$
declare t text;
begin
  foreach t in array array['job_requirements', 'job_skills', 'job_application_questions'] loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (public.can_view_job(job_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_manage_job(job_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_manage_job(job_id)) with check (public.can_manage_job(job_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_manage_job(job_id))', t || '_delete', t);
  end loop;
end $$;

create policy saved_jobs_own on public.saved_jobs for all to authenticated
  using (candidate_id = (select auth.uid())) with check (candidate_id = (select auth.uid()));

-- ---------------------------------------------------------------- applications (writes via RPC only)
create policy applications_select on public.applications for select to authenticated using (public.can_view_application(id));
create policy application_documents_select on public.application_documents for select to authenticated using (public.can_view_application(application_id));
create policy application_answers_select on public.application_answers for select to authenticated using (public.can_view_application(application_id));
-- status history contains internal reasons: company side only. Candidates read a filtered timeline via RPC.
create policy application_history_select on public.application_status_history for select to authenticated
  using (public.can_recruit_application(application_id));
-- internal notes: never visible to candidates or interviewers
create policy application_notes_select on public.application_notes for select to authenticated
  using (public.can_recruit_application(application_id));
create policy application_notes_insert on public.application_notes for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_recruit_application(application_id));
create policy application_notes_delete on public.application_notes for delete to authenticated
  using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------- assessments
create policy assessments_select on public.assessments for select to authenticated using (public.can_view_assessment(id));
create policy assessments_insert on public.assessments for insert to authenticated
  with check ((company_id is not null and public.can_recruit(company_id)) or (company_id is null and public.is_super_admin()));
create policy assessments_update on public.assessments for update to authenticated
  using (public.can_manage_assessment(id)) with check ((company_id is not null and public.can_recruit(company_id)) or public.is_super_admin());
create policy assessments_delete on public.assessments for delete to authenticated using (public.can_manage_assessment(id));

create policy assessment_templates_select on public.assessment_templates for select to authenticated using (true);
create policy assessment_templates_admin on public.assessment_templates for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy assessment_sections_select on public.assessment_sections for select to authenticated using (public.can_view_assessment(assessment_id));
create policy assessment_rubrics_select on public.assessment_rubrics for select to authenticated using (public.can_view_assessment(assessment_id));
create policy assessment_questions_select on public.assessment_questions for select to authenticated using (public.can_view_assessment_content(assessment_id));
create policy assessment_options_select on public.assessment_options for select to authenticated
  using (exists (select 1 from public.assessment_questions q where q.id = question_id and public.can_view_assessment_content(q.assessment_id)));

do $$
declare t text;
begin
  foreach t in array array['assessment_sections', 'assessment_rubrics', 'assessment_questions'] loop
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_manage_assessment(assessment_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_manage_assessment(assessment_id)) with check (public.can_manage_assessment(assessment_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_manage_assessment(assessment_id))', t || '_delete', t);
  end loop;
end $$;
create policy assessment_options_write on public.assessment_options for all to authenticated
  using (exists (select 1 from public.assessment_questions q where q.id = question_id and public.can_manage_assessment(q.assessment_id)))
  with check (exists (select 1 from public.assessment_questions q where q.id = question_id and public.can_manage_assessment(q.assessment_id)));

create policy assessment_assignments_select on public.assessment_assignments for select to authenticated
  using (candidate_id = (select auth.uid()) or (company_id is not null and public.can_recruit(company_id)) or public.is_super_admin());
create policy assessment_submissions_select on public.assessment_submissions for select to authenticated
  using (candidate_id = (select auth.uid()) or public.is_super_admin() or exists (
    select 1 from public.assessment_assignments aa where aa.id = assignment_id and aa.company_id is not null and public.can_recruit(aa.company_id)));
create policy assessment_answers_select on public.assessment_answers for select to authenticated
  using (exists (
    select 1 from public.assessment_submissions s join public.assessment_assignments aa on aa.id = s.assignment_id
    where s.id = submission_id and (s.candidate_id = (select auth.uid()) or public.is_super_admin()
      or (aa.company_id is not null and public.can_recruit(aa.company_id)))));
create policy assessment_evaluations_select on public.assessment_evaluations for select to authenticated
  using (public.is_super_admin() or exists (
    select 1 from public.assessment_submissions s join public.assessment_assignments aa on aa.id = s.assignment_id
    where s.id = submission_id and aa.company_id is not null and public.can_recruit(aa.company_id)));

-- ---------------------------------------------------------------- interviews
create policy interviews_select on public.interviews for select to authenticated
  using (public.can_recruit(company_id) or public.is_interview_participant(id) or public.is_super_admin()
    or exists (select 1 from public.applications a where a.id = application_id and a.candidate_id = (select auth.uid())));
create policy interviews_update on public.interviews for update to authenticated
  using (public.can_recruit(company_id)) with check (public.can_recruit(company_id));

create policy interview_participants_select on public.interview_participants for select to authenticated
  using (user_id = (select auth.uid()) or public.is_super_admin()
    or exists (select 1 from public.interviews i where i.id = interview_id and (public.can_recruit(i.company_id) or public.is_interview_participant(i.id))));
create policy interview_participants_write on public.interview_participants for all to authenticated
  using (exists (select 1 from public.interviews i where i.id = interview_id and public.can_recruit(i.company_id)))
  with check (exists (select 1 from public.interviews i where i.id = interview_id and public.can_recruit(i.company_id)));

create policy interview_questions_select on public.interview_questions for select to authenticated
  using (exists (select 1 from public.interviews i where i.id = interview_id and (public.can_recruit(i.company_id) or public.is_interview_participant(i.id))));
create policy interview_questions_write on public.interview_questions for all to authenticated
  using (exists (select 1 from public.interviews i where i.id = interview_id and public.can_recruit(i.company_id)))
  with check (exists (select 1 from public.interviews i where i.id = interview_id and public.can_recruit(i.company_id)));

-- confidential evaluations: the company's recruiters + the evaluator. Never the candidate.
create policy interview_evaluations_select on public.interview_evaluations for select to authenticated
  using (interviewer_id = (select auth.uid()) or public.is_super_admin()
    or exists (select 1 from public.interviews i where i.id = interview_id and public.can_recruit(i.company_id)));
create policy interview_evaluations_insert on public.interview_evaluations for insert to authenticated
  with check (interviewer_id = (select auth.uid()) and public.is_interview_participant(interview_id));
create policy interview_evaluations_update on public.interview_evaluations for update to authenticated
  using (interviewer_id = (select auth.uid())) with check (interviewer_id = (select auth.uid()));

create policy interview_feedback_select on public.interview_feedback for select to authenticated
  using (author_id = (select auth.uid()) or public.is_super_admin()
    or exists (select 1 from public.interviews i where i.id = interview_id and public.can_recruit(i.company_id))
    or (shared_with_candidate and exists (select 1 from public.applications a where a.id = application_id and a.candidate_id = (select auth.uid()))));
create policy interview_feedback_insert on public.interview_feedback for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.interviews i where i.id = interview_id and i.application_id = interview_feedback.application_id
      and (public.can_recruit(i.company_id) or public.is_interview_participant(i.id))));
create policy interview_feedback_update on public.interview_feedback for update to authenticated
  using (exists (select 1 from public.interviews i where i.id = interview_id and public.can_recruit(i.company_id)))
  with check (exists (select 1 from public.interviews i where i.id = interview_id and public.can_recruit(i.company_id)));

-- ---------------------------------------------------------------- career
create policy career_profiles_own on public.career_profiles for all to authenticated
  using (candidate_id = (select auth.uid())) with check (candidate_id = (select auth.uid()));
create policy career_goals_own on public.career_goals for all to authenticated
  using (candidate_id = (select auth.uid())) with check (candidate_id = (select auth.uid()));
create policy skill_gap_own on public.skill_gap_analyses for all to authenticated
  using (candidate_id = (select auth.uid())) with check (candidate_id = (select auth.uid()));
create policy learning_progress_own on public.learning_progress for all to authenticated
  using (candidate_id = (select auth.uid())) with check (candidate_id = (select auth.uid()));
create policy development_plans_select on public.development_plans for select to authenticated
  using (is_template or candidate_id = (select auth.uid()) or public.is_super_admin());
create policy development_plans_write on public.development_plans for all to authenticated
  using ((not is_template and candidate_id = (select auth.uid())) or public.is_super_admin())
  with check ((not is_template and candidate_id = (select auth.uid())) or public.is_super_admin());
create policy development_plan_items_select on public.development_plan_items for select to authenticated
  using (exists (select 1 from public.development_plans p where p.id = plan_id and (p.is_template or p.candidate_id = (select auth.uid()) or public.is_super_admin())));
create policy development_plan_items_write on public.development_plan_items for all to authenticated
  using (exists (select 1 from public.development_plans p where p.id = plan_id and ((not p.is_template and p.candidate_id = (select auth.uid())) or public.is_super_admin())))
  with check (exists (select 1 from public.development_plans p where p.id = plan_id and ((not p.is_template and p.candidate_id = (select auth.uid())) or public.is_super_admin())));

-- ---------------------------------------------------------------- AI
create policy ai_analysis_select on public.ai_analysis_records for select to authenticated
  using (user_id = (select auth.uid()) or public.is_super_admin() or (company_id is not null and public.can_recruit(company_id)));
create policy ai_analysis_insert on public.ai_analysis_records for insert to authenticated
  with check (user_id = (select auth.uid()) and (company_id is null or public.can_recruit(company_id)));
create policy ai_generation_select on public.ai_generation_records for select to authenticated
  using (user_id = (select auth.uid()) or public.is_super_admin() or (company_id is not null and public.can_recruit(company_id)));
create policy ai_generation_insert on public.ai_generation_records for insert to authenticated
  with check (user_id = (select auth.uid()) and (company_id is null or public.can_recruit(company_id)));
create policy ai_generation_update on public.ai_generation_records for update to authenticated
  using (user_id = (select auth.uid()) or (company_id is not null and public.can_recruit(company_id)))
  with check (user_id = (select auth.uid()) or (company_id is not null and public.can_recruit(company_id)));
create policy ai_provider_logs_select on public.ai_provider_logs for select to authenticated using (public.is_super_admin());
create policy ai_provider_logs_insert on public.ai_provider_logs for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- administration
create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
create policy notification_preferences_own on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (public.is_super_admin() or (company_id is not null and public.has_company_role(company_id, array['company_admin']::public.membership_role[])));
create policy platform_settings_read on public.platform_settings for select to authenticated using (true);
create policy platform_settings_admin on public.platform_settings for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy reports_admin on public.reports for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
