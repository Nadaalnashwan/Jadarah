-- JADARAH — 0014 allow new AI record kinds (rubric-assisted evaluation, final evaluation, career plan,
-- rubric generation). Additive: existing kinds unchanged.
alter table public.ai_analysis_records drop constraint ai_analysis_records_kind_check;
alter table public.ai_analysis_records add constraint ai_analysis_records_kind_check check (kind = any (array[
  'cv_parse', 'skill_extract', 'job_match', 'skill_gap', 'candidate_summary',
  'assessment_evaluation', 'final_evaluation', 'semantic_match'
]));

alter table public.ai_generation_records drop constraint ai_generation_records_kind_check;
alter table public.ai_generation_records add constraint ai_generation_records_kind_check check (kind = any (array[
  'job_description', 'assessment', 'interview_questions', 'candidate_assistant', 'company_assistant',
  'development_plan', 'rubric', 'career_plan'
]));
