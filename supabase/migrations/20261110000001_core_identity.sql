-- JADARAH | جدارة — 0001 core identity, enums and shared helpers
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------- enums
create type public.app_role as enum ('super_admin', 'company_admin', 'recruiter', 'interviewer', 'candidate');
create type public.account_status as enum ('active', 'suspended', 'deactivated');
create type public.company_status as enum ('pending', 'info_requested', 'approved', 'rejected', 'suspended');
create type public.job_status as enum ('draft', 'published', 'paused', 'closed', 'archived');
create type public.application_status as enum (
  'submitted', 'under_review', 'assessment_pending', 'assessment_completed', 'shortlisted',
  'interview_scheduled', 'interview_completed', 'hired', 'rejected', 'withdrawn'
);
create type public.employment_type as enum ('full_time', 'part_time', 'contract', 'internship', 'temporary');
create type public.work_mode as enum ('onsite', 'remote', 'hybrid');
create type public.experience_level as enum ('entry', 'junior', 'mid', 'senior', 'lead');
create type public.question_type as enum (
  'multiple_choice', 'multiple_select', 'true_false', 'short_answer', 'long_answer',
  'coding', 'sql', 'case_study', 'file_upload'
);
create type public.assignment_status as enum ('assigned', 'in_progress', 'submitted', 'evaluated', 'expired', 'cancelled');
create type public.interview_status as enum ('scheduled', 'completed', 'cancelled');
create type public.interview_type as enum ('phone', 'video', 'onsite', 'technical', 'behavioral', 'panel');
create type public.recommendation as enum ('strong_yes', 'yes', 'neutral', 'no', 'strong_no');
create type public.progress_status as enum ('not_started', 'in_progress', 'completed');
create type public.membership_role as enum ('company_admin', 'recruiter', 'interviewer');

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar_path text,
  phone text,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  status public.account_status not null default 'active',
  account_type text not null default 'candidate' check (account_type in ('candidate', 'company', 'admin')),
  onboarding_completed boolean not null default false,
  is_demo boolean not null default false,
  consent_accepted_at timestamptz,
  deactivation_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- Platform-level roles (super_admin, candidate). Company roles live in company_memberships.
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null check (role in ('super_admin', 'candidate')),
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index user_roles_user_idx on public.user_roles (user_id);

create table public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name_en text not null,
  name_ar text not null,
  industry text not null,
  website text,
  size_range text check (size_range in ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')),
  city text,
  country text not null default 'SA',
  description_en text,
  description_ar text,
  contact_email text,
  contact_phone text,
  logo_path text,
  status public.company_status not null default 'pending',
  status_reason text,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index company_profiles_status_idx on public.company_profiles (status);
create trigger company_profiles_updated_at before update on public.company_profiles for each row execute function public.set_updated_at();

create table public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.membership_role not null,
  status text not null default 'active' check (status in ('active', 'removed')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index company_memberships_user_idx on public.company_memberships (user_id);
create trigger company_memberships_updated_at before update on public.company_memberships for each row execute function public.set_updated_at();

create table public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  email text not null,
  role public.membership_role not null,
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index company_invitations_email_idx on public.company_invitations (lower(email));
create unique index company_invitations_pending_uniq on public.company_invitations (company_id, lower(email)) where status = 'pending';

create table public.company_verification_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  submitted_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'info_requested', 'approved', 'rejected')),
  document_paths text[] not null default '{}',
  commercial_registration text,
  notes text,
  reviewer_id uuid references public.profiles (id) on delete set null,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index company_verification_company_idx on public.company_verification_requests (company_id);

-- ---------------------------------------------------------------- authorization helpers
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active');
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = auth.uid() and r.role = 'super_admin' and p.status = 'active'
  );
$$;

create or replace function public.has_company_role(p_company uuid, p_roles public.membership_role[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_memberships m
    join public.profiles p on p.id = m.user_id
    where m.company_id = p_company
      and m.user_id = auth.uid()
      and m.status = 'active'
      and p.status = 'active'
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

create or replace function public.can_recruit(p_company uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_company_role(p_company, array['company_admin', 'recruiter']::public.membership_role[]);
$$;

create or replace function public.is_company_approved(p_company uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.company_profiles c where c.id = p_company and c.status = 'approved');
$$;

-- ---------------------------------------------------------------- new user trigger
-- Users can never grant themselves privileged roles: only 'candidate' is assigned here.
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
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent users from altering protected profile columns themselves.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_super_admin() then
    if new.status is distinct from old.status
      or new.account_type is distinct from old.account_type
      or new.email is distinct from old.email
      or new.is_demo is distinct from old.is_demo then
      raise exception 'not allowed to change protected profile fields' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_columns();
