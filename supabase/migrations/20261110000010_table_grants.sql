-- JADARAH — 0010 explicit, least-privilege table grants
-- This project does not grant table privileges to API roles by default. RLS decides
-- WHICH rows; these grants decide WHICH operations are possible at all. Tables whose
-- state changes only through SECURITY DEFINER RPCs get SELECT only.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;

-- public catalogue (rows further limited by RLS, e.g. only published jobs of approved companies)
grant select on public.skills, public.skill_categories, public.job_categories, public.learning_resources,
  public.company_profiles, public.jobs, public.job_skills, public.job_requirements, public.job_application_questions
  to anon;

-- signed-in users: read everything RLS allows
grant select on all tables in schema public to authenticated;

-- writes only where a write policy exists
grant update on public.profiles, public.company_profiles, public.interviews, public.notifications to authenticated;
grant insert, update, delete on
  public.candidate_profiles, public.candidate_education, public.candidate_experience, public.candidate_skills,
  public.candidate_certifications, public.candidate_projects, public.candidate_documents, public.candidate_preferences,
  public.skills, public.skill_categories, public.job_categories, public.learning_resources,
  public.jobs, public.job_requirements, public.job_skills, public.job_application_questions,
  public.assessments, public.assessment_templates, public.assessment_sections, public.assessment_rubrics,
  public.assessment_questions, public.assessment_options,
  public.interview_participants, public.interview_questions,
  public.career_profiles, public.career_goals, public.skill_gap_analyses, public.learning_progress,
  public.development_plans, public.development_plan_items,
  public.notification_preferences, public.platform_settings, public.reports
  to authenticated;
grant insert, delete on public.saved_jobs, public.application_notes to authenticated;
grant insert, update on public.interview_evaluations, public.interview_feedback, public.ai_generation_records to authenticated;
grant insert on public.ai_analysis_records, public.ai_provider_logs to authenticated;
grant delete on public.notifications to authenticated;

-- tables created later must be granted explicitly in their own migration
alter default privileges in schema public grant all on tables to service_role;
