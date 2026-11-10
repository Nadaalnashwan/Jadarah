-- JADARAH — 0004 career development, AI records, administration

create table public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  title_ar text not null,
  provider text not null,
  url text not null check (url ~ '^https://'),
  kind text not null default 'course' check (kind in ('course', 'documentation', 'video', 'book', 'practice', 'article')),
  topic text not null,
  skill_slugs text[] not null default '{}',
  level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  duration_hours numeric(5, 1),
  is_free boolean not null default true,
  language text not null default 'en',
  link_verified_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.career_profiles (
  candidate_id uuid primary key references public.profiles (id) on delete cascade,
  current_title text,
  current_level public.experience_level,
  summary text,
  updated_at timestamptz not null default now()
);

create table public.career_goals (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  target_role_slug text not null,
  target_role_en text not null,
  target_role_ar text not null,
  target_level public.experience_level not null default 'junior',
  target_date date,
  status text not null default 'active' check (status in ('active', 'achieved', 'archived')),
  created_at timestamptz not null default now()
);
create index career_goals_candidate_idx on public.career_goals (candidate_id);

create table public.skill_gap_analyses (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  goal_id uuid references public.career_goals (id) on delete cascade,
  method text not null default 'rule_based' check (method in ('rule_based', 'ai')),
  provider text,
  -- {"strong":[...],"partial":[...],"missing":[...],"coverage":0.62}
  analysis jsonb not null,
  created_at timestamptz not null default now()
);
create index skill_gap_analyses_idx on public.skill_gap_analyses (candidate_id, created_at desc);

-- A plan with candidate_id null and is_template = true is a role blueprint.
create table public.development_plans (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.profiles (id) on delete cascade,
  goal_id uuid references public.career_goals (id) on delete set null,
  is_template boolean not null default false,
  role_slug text not null,
  title_en text not null,
  title_ar text not null,
  description_en text,
  description_ar text,
  current_level public.experience_level,
  target_level public.experience_level not null default 'junior',
  required_skill_slugs text[] not null default '{}',
  estimated_weeks smallint not null default 12 check (estimated_weeks between 1 and 156),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_template or candidate_id is not null)
);
create index development_plans_candidate_idx on public.development_plans (candidate_id);
create unique index development_plans_template_uniq on public.development_plans (role_slug) where is_template;
create trigger development_plans_updated_at before update on public.development_plans for each row execute function public.set_updated_at();

create table public.development_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.development_plans (id) on delete cascade,
  title_en text not null,
  title_ar text not null,
  description_en text,
  description_ar text,
  skill_slug text,
  kind text not null default 'milestone' check (kind in ('milestone', 'activity')),
  resource_id uuid references public.learning_resources (id) on delete set null,
  position smallint not null default 0,
  estimated_hours numeric(5, 1),
  status public.progress_status not null default 'not_started',
  completed_at timestamptz
);
create index development_plan_items_idx on public.development_plan_items (plan_id, position);

create table public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  resource_id uuid not null references public.learning_resources (id) on delete cascade,
  status public.progress_status not null default 'in_progress',
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  unique (candidate_id, resource_id)
);

-- ---------------------------------------------------------------- AI records
create table public.ai_analysis_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  company_id uuid references public.company_profiles (id) on delete set null,
  kind text not null check (kind in ('cv_parse', 'skill_extract', 'job_match', 'skill_gap', 'candidate_summary')),
  subject_type text not null,
  subject_id uuid,
  provider text not null,  -- gemini | openai | rule_based
  model text,
  is_demo boolean not null default false,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  output jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index ai_analysis_records_idx on public.ai_analysis_records (subject_type, subject_id);

create table public.ai_generation_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  company_id uuid references public.company_profiles (id) on delete set null,
  kind text not null check (kind in ('job_description', 'assessment', 'interview_questions', 'candidate_assistant', 'company_assistant', 'development_plan')),
  provider text not null,
  model text,
  is_demo boolean not null default false,
  input_summary text,
  output jsonb,
  review_status text not null default 'pending_review' check (review_status in ('pending_review', 'approved', 'rejected', 'not_required')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index ai_generation_records_user_idx on public.ai_generation_records (user_id, created_at desc);

create table public.ai_provider_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text,
  operation text not null,
  user_id uuid references public.profiles (id) on delete set null,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  success boolean not null,
  error_code text,
  created_at timestamptz not null default now()
);
create index ai_provider_logs_created_idx on public.ai_provider_logs (created_at desc);

-- ---------------------------------------------------------------- administration
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title_en text not null,
  title_ar text not null,
  body_en text,
  body_ar text,
  link text,
  read_at timestamptz,
  email_status text not null default 'not_sent' check (email_status in ('not_sent', 'queued', 'sent', 'failed', 'disabled')),
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  muted_kinds text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  company_id uuid references public.company_profiles (id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_.]{2,64}$'),
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null,
  params jsonb not null default '{}',
  data jsonb not null default '{}',
  generated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- shared write helpers
create or replace function public.notify(
  p_user uuid, p_kind text, p_title_en text, p_title_ar text,
  p_body_en text default null, p_body_ar text default null, p_link text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_pref public.notification_preferences;
begin
  select * into v_pref from public.notification_preferences where user_id = p_user;
  if v_pref.user_id is not null and (not v_pref.in_app_enabled or p_kind = any (v_pref.muted_kinds)) then
    return;
  end if;
  insert into public.notifications (user_id, kind, title_en, title_ar, body_en, body_ar, link)
  values (p_user, p_kind, p_title_en, p_title_ar, p_body_en, p_body_ar, p_link);
end $$;
revoke execute on function public.notify(uuid, text, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.write_audit(
  p_action text, p_entity_type text, p_entity_id uuid, p_company uuid default null, p_metadata jsonb default '{}'
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, company_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_company, coalesce(p_metadata, '{}'));
end $$;
revoke execute on function public.write_audit(text, text, uuid, uuid, jsonb) from public, anon, authenticated;
