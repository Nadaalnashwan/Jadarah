-- JADARAH — 0002 candidates, skills and jobs

create table public.skill_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_ar text not null,
  created_at timestamptz not null default now()
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_ar text not null,
  category_id uuid references public.skill_categories (id) on delete set null,
  kind text not null default 'technical' check (kind in ('technical', 'soft', 'tool', 'framework', 'language', 'domain')),
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index skills_category_idx on public.skills (category_id);
create index skills_name_trgm on public.skills using gin (name_en extensions.gin_trgm_ops);

create table public.candidate_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  headline text,
  summary text,
  city text,
  country text default 'SA',
  years_experience numeric(4, 1) check (years_experience is null or years_experience between 0 and 60),
  experience_level public.experience_level,
  open_to_work boolean not null default true,
  visibility text not null default 'companies' check (visibility in ('companies', 'private')),
  career_interests text[] not null default '{}',
  languages jsonb not null default '[]',
  achievements text[] not null default '{}',
  linkedin_url text,
  portfolio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger candidate_profiles_updated_at before update on public.candidate_profiles for each row execute function public.set_updated_at();

create table public.candidate_education (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles (user_id) on delete cascade,
  institution text not null,
  degree text not null,
  field text,
  start_date date,
  end_date date,
  grade text,
  description text,
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index candidate_education_idx on public.candidate_education (candidate_id);

create table public.candidate_experience (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles (user_id) on delete cascade,
  title text not null,
  company text not null,
  location text,
  start_date date not null,
  end_date date,
  is_current boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index candidate_experience_idx on public.candidate_experience (candidate_id);

create table public.candidate_skills (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles (user_id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  level smallint not null default 3 check (level between 1 and 5),
  years numeric(4, 1),
  -- source: self-declared, extracted from a CV, demonstrated in an assessment, verified by a reviewer
  source text not null default 'self' check (source in ('self', 'cv', 'assessment', 'verified')),
  evidence text,
  created_at timestamptz not null default now(),
  unique (candidate_id, skill_id)
);
create index candidate_skills_skill_idx on public.candidate_skills (skill_id);

create table public.candidate_certifications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles (user_id) on delete cascade,
  name text not null,
  issuer text,
  issue_date date,
  expiry_date date,
  credential_url text,
  document_path text,
  created_at timestamptz not null default now()
);
create index candidate_certifications_idx on public.candidate_certifications (candidate_id);

create table public.candidate_projects (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles (user_id) on delete cascade,
  title text not null,
  description text,
  url text,
  skills text[] not null default '{}',
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);
create index candidate_projects_idx on public.candidate_projects (candidate_id);

create table public.candidate_documents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles (user_id) on delete cascade,
  kind text not null default 'cv' check (kind in ('cv', 'certificate', 'project')),
  bucket text not null default 'candidate-cvs',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  label text,
  version integer not null default 1,
  is_primary boolean not null default false,
  parse_status text not null default 'not_parsed' check (parse_status in ('not_parsed', 'processing', 'parsed', 'failed', 'reviewed')),
  parsed_data jsonb,
  parsed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index candidate_documents_idx on public.candidate_documents (candidate_id, kind);
create unique index candidate_documents_primary_uniq on public.candidate_documents (candidate_id, kind) where is_primary and deleted_at is null;

create table public.candidate_preferences (
  candidate_id uuid primary key references public.candidate_profiles (user_id) on delete cascade,
  desired_roles text[] not null default '{}',
  desired_locations text[] not null default '{}',
  employment_types public.employment_type[] not null default '{}',
  work_modes public.work_mode[] not null default '{}',
  min_salary integer,
  updated_at timestamptz not null default now()
);

create table public.job_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_ar text not null
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  category_id uuid references public.job_categories (id) on delete set null,
  title_en text not null,
  title_ar text not null,
  description_en text not null default '',
  description_ar text not null default '',
  responsibilities_en text[] not null default '{}',
  responsibilities_ar text[] not null default '{}',
  qualifications_en text[] not null default '{}',
  qualifications_ar text[] not null default '{}',
  experience_level public.experience_level not null default 'mid',
  min_years smallint not null default 0 check (min_years between 0 and 40),
  city text not null,
  work_mode public.work_mode not null default 'onsite',
  employment_type public.employment_type not null default 'full_time',
  salary_min integer check (salary_min is null or salary_min >= 0),
  salary_max integer,
  salary_currency text not null default 'SAR',
  salary_visible boolean not null default false,
  education_level text,
  openings smallint not null default 1 check (openings between 1 and 500),
  deadline date,
  status public.job_status not null default 'draft',
  published_at timestamptz,
  assessment_id uuid,
  ai_assisted boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salary_max is null or salary_min is null or salary_max >= salary_min)
);
create index jobs_company_idx on public.jobs (company_id, status);
create index jobs_status_idx on public.jobs (status, published_at desc);
create index jobs_title_trgm on public.jobs using gin (title_en extensions.gin_trgm_ops);
create trigger jobs_updated_at before update on public.jobs for each row execute function public.set_updated_at();

create table public.job_requirements (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  kind text not null default 'other' check (kind in ('education', 'certification', 'experience', 'language', 'other')),
  text_en text not null,
  text_ar text not null,
  is_mandatory boolean not null default true,
  position smallint not null default 0
);
create index job_requirements_idx on public.job_requirements (job_id);

create table public.job_skills (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  importance text not null default 'required' check (importance in ('required', 'preferred')),
  min_level smallint not null default 3 check (min_level between 1 and 5),
  unique (job_id, skill_id)
);
create index job_skills_skill_idx on public.job_skills (skill_id);

create table public.job_application_questions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  question_en text not null,
  question_ar text not null,
  is_required boolean not null default false,
  position smallint not null default 0
);
create index job_application_questions_idx on public.job_application_questions (job_id);

create table public.saved_jobs (
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (candidate_id, job_id)
);

-- Publishing requires an approved company. Enforced in the database, not only in the UI.
create or replace function public.enforce_job_publication()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if not public.is_company_approved(new.company_id) then
      raise exception 'company must be approved before publishing jobs' using errcode = 'P0001';
    end if;
    if coalesce(trim(new.title_en), '') = '' or coalesce(trim(new.title_ar), '') = '' then
      raise exception 'job title is required in both languages' using errcode = 'P0001';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end $$;
create trigger jobs_enforce_publication before insert or update on public.jobs
  for each row execute function public.enforce_job_publication();
