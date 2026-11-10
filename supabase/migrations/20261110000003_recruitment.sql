-- JADARAH — 0003 applications, assessments, interviews

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  status public.application_status not null default 'submitted',
  cv_document_id uuid references public.candidate_documents (id) on delete set null,
  cover_letter text check (cover_letter is null or char_length(cover_letter) <= 5000),
  match_score numeric(5, 2),
  match_breakdown jsonb,
  was_shortlisted boolean not null default false,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);
create index applications_company_idx on public.applications (company_id, status);
create index applications_candidate_idx on public.applications (candidate_id);
create index applications_job_idx on public.applications (job_id);
create trigger applications_updated_at before update on public.applications for each row execute function public.set_updated_at();

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  document_id uuid not null references public.candidate_documents (id) on delete cascade,
  kind text not null default 'cv',
  created_at timestamptz not null default now(),
  unique (application_id, document_id)
);

create table public.application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  question_id uuid not null references public.job_application_questions (id) on delete cascade,
  answer text not null check (char_length(answer) <= 4000),
  unique (application_id, question_id)
);

create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  from_status public.application_status,
  to_status public.application_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  reason text,                       -- internal only
  candidate_message text,            -- explicitly shared with the candidate
  created_at timestamptz not null default now()
);
create index application_status_history_idx on public.application_status_history (application_id, created_at);

create table public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index application_notes_idx on public.application_notes (application_id);

-- ---------------------------------------------------------------- assessments
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.company_profiles (id) on delete cascade, -- null = platform library
  slug text unique,
  title_en text not null,
  title_ar text not null,
  description_en text,
  description_ar text,
  category text not null default 'technical',
  difficulty text not null default 'intermediate' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  duration_minutes smallint not null default 30 check (duration_minutes between 5 and 480),
  passing_score smallint not null default 60 check (passing_score between 0 and 100),
  learning_outcomes_en text[] not null default '{}',
  learning_outcomes_ar text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  ai_generated boolean not null default false,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assessments_company_idx on public.assessments (company_id);
create trigger assessments_updated_at before update on public.assessments for each row execute function public.set_updated_at();

alter table public.jobs add constraint jobs_assessment_fk foreign key (assessment_id) references public.assessments (id) on delete set null;

create table public.assessment_templates (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null unique references public.assessments (id) on delete cascade,
  tags text[] not null default '{}',
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.assessment_sections (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  title_en text not null,
  title_ar text not null,
  position smallint not null default 0
);
create index assessment_sections_idx on public.assessment_sections (assessment_id);

create table public.assessment_rubrics (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  title_en text not null,
  title_ar text not null,
  -- [{ "key": "clarity", "name_en": "...", "name_ar": "...", "max_points": 5, "description_en": "...", "description_ar": "..." }]
  criteria jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index assessment_rubrics_idx on public.assessment_rubrics (assessment_id);

create table public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  section_id uuid references public.assessment_sections (id) on delete set null,
  type public.question_type not null,
  prompt_en text not null,
  prompt_ar text not null,
  points smallint not null default 1 check (points between 0 and 100),
  position smallint not null default 0,
  config jsonb not null default '{}', -- e.g. {"language":"python","starter":"..."}
  rubric_id uuid references public.assessment_rubrics (id) on delete set null,
  explanation_en text,               -- revealed only after submission
  explanation_ar text,
  created_at timestamptz not null default now()
);
create index assessment_questions_idx on public.assessment_questions (assessment_id, position);

create table public.assessment_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.assessment_questions (id) on delete cascade,
  label_en text not null,
  label_ar text not null,
  is_correct boolean not null default false,
  position smallint not null default 0
);
create index assessment_options_idx on public.assessment_options (question_id);

create table public.assessment_assignments (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  application_id uuid references public.applications (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid references public.company_profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  status public.assignment_status not null default 'assigned',
  due_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (assessment_id, candidate_id, application_id)
);
create index assessment_assignments_candidate_idx on public.assessment_assignments (candidate_id, status);
create index assessment_assignments_company_idx on public.assessment_assignments (company_id);

create table public.assessment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.assessment_assignments (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'evaluated')),
  auto_score numeric(6, 2) not null default 0,
  manual_score numeric(6, 2) not null default 0,
  max_score numeric(6, 2) not null default 0,
  percentage numeric(5, 2),
  needs_review boolean not null default false,
  candidate_feedback text,            -- shared with candidate
  feedback_shared boolean not null default false,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  evaluated_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger assessment_submissions_updated_at before update on public.assessment_submissions for each row execute function public.set_updated_at();

create table public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assessment_submissions (id) on delete cascade,
  question_id uuid not null references public.assessment_questions (id) on delete cascade,
  selected_option_ids uuid[] not null default '{}',
  text_answer text check (text_answer is null or char_length(text_answer) <= 20000),
  file_path text,
  is_correct boolean,
  points_awarded numeric(6, 2),
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id)
);
create trigger assessment_answers_updated_at before update on public.assessment_answers for each row execute function public.set_updated_at();

create table public.assessment_evaluations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assessment_submissions (id) on delete cascade,
  question_id uuid references public.assessment_questions (id) on delete cascade,
  evaluator_id uuid references public.profiles (id) on delete set null,
  rubric_scores jsonb not null default '{}',
  points numeric(6, 2) not null default 0,
  comments text,
  created_at timestamptz not null default now(),
  unique (submission_id, question_id)
);

-- ---------------------------------------------------------------- interviews
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  title text not null default 'Interview',
  type public.interview_type not null default 'video',
  status public.interview_status not null default 'scheduled',
  scheduled_at timestamptz not null,
  duration_minutes smallint not null default 45 check (duration_minutes between 10 and 480),
  timezone text not null default 'Asia/Riyadh',
  location text,
  meeting_url text,
  instructions text,                -- visible to the candidate
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interviews_company_idx on public.interviews (company_id, scheduled_at);
create index interviews_application_idx on public.interviews (application_id);
create trigger interviews_updated_at before update on public.interviews for each row execute function public.set_updated_at();

create table public.interview_participants (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'interviewer' check (role in ('interviewer', 'organizer', 'observer')),
  unique (interview_id, user_id)
);
create index interview_participants_user_idx on public.interview_participants (user_id);

create table public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  question text not null,
  kind text not null default 'technical' check (kind in ('technical', 'behavioral', 'role', 'follow_up')),
  position smallint not null default 0,
  ai_generated boolean not null default false
);
create index interview_questions_idx on public.interview_questions (interview_id);

create table public.interview_evaluations (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  interviewer_id uuid not null references public.profiles (id) on delete cascade,
  ratings jsonb not null default '{}', -- {"technical":4,"communication":5,...} 1..5
  recommendation public.recommendation not null,
  strengths text,
  concerns text,
  comments text,
  submitted_at timestamptz not null default now(),
  unique (interview_id, interviewer_id)
);

create table public.interview_feedback (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  shared_with_candidate boolean not null default false,
  shared_at timestamptz,
  created_at timestamptz not null default now()
);
create index interview_feedback_app_idx on public.interview_feedback (application_id);
