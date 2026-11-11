-- JADARAH — 0023 Assessment Reference Library + reference-grounded generation.
-- Candidate-facing and assessor-facing content are stored and authorized SEPARATELY.
-- Assessor material (answer keys, scoring guidance) is never readable by candidates.

-- ---------------------------------------------------------------- helpers
-- Approved + subscribed company admin/recruiter (anywhere). Used for reference retrieval.
create or replace function public.is_active_recruiter()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_memberships m
    join public.profiles p on p.id = m.user_id and p.status = 'active'
    where m.user_id = auth.uid() and m.status = 'active' and m.role in ('company_admin', 'recruiter')
      and public.company_service_active(m.company_id)
  );
$$;

-- ---------------------------------------------------------------- sector skills (reference data)
create table public.sector_skills (
  id uuid primary key default gen_random_uuid(),
  sector_key text not null check (sector_key in ('digital', 'financial_services', 'culture_entertainment',
    'construction_real_estate', 'manufacturing', 'tourism_hospitality', 'wholesale_retail')),
  kind text not null check (kind in ('technical', 'general')),
  name_ar text not null,
  description_ar text,
  source_sha256 text not null,
  unique (sector_key, kind, name_ar)
);
alter table public.sector_skills enable row level security;
create policy sector_skills_read on public.sector_skills for select to authenticated using (true);
grant select on public.sector_skills to authenticated;

-- ---------------------------------------------------------------- reference assessments
create table public.reference_assessments (
  id uuid primary key default gen_random_uuid(),
  ref_key text not null unique,                 -- stable source identifier (package folder)
  role_en text not null,
  role_ar text,
  sector_key text,
  seniority text,
  skills text[] not null default '{}',
  scenario text,
  objectives text[] not null default '{}',
  instructions text,
  deliverables jsonb not null default '[]'::jsonb,   -- [{name, format, description}]
  input_assets jsonb not null default '[]'::jsonb,   -- [{file, kind, sheets/columns, rows}]
  time_limit_minutes int,
  tools text[] not null default '{}',
  completeness text not null check (completeness in ('complete', 'assessor_only', 'candidate_only')),
  validation_status text not null check (validation_status in ('validated', 'needs_review', 'incomplete')),
  validation_notes text,
  source_files jsonb not null default '[]'::jsonb,   -- [{path, sha256, audience, extraction}]
  extracted_by text,
  extracted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reference_assessments enable row level security;
create policy reference_read on public.reference_assessments for select to authenticated
  using (public.is_super_admin() or public.is_active_recruiter());
grant select on public.reference_assessments to authenticated;

-- CONFIDENTIAL assessor side of a reference (Super Admin only; never candidates).
create table public.reference_assessment_assessor (
  reference_id uuid primary key references public.reference_assessments (id) on delete cascade,
  rubric jsonb not null default '[]'::jsonb,         -- [{criterion, description, weight, expected_evidence}]
  assessor_guidance text,
  answer_expectations text,
  source_files jsonb not null default '[]'::jsonb
);
alter table public.reference_assessment_assessor enable row level security;
create policy reference_assessor_admin on public.reference_assessment_assessor for select to authenticated
  using (public.is_super_admin());
grant select on public.reference_assessment_assessor to authenticated;

create table public.reference_embeddings (
  reference_id uuid not null references public.reference_assessments (id) on delete cascade,
  model text not null,
  dims int not null check (dims = 768),
  content_hash text not null,
  embedding extensions.vector(768) not null,
  primary key (reference_id, model)
);
alter table public.reference_embeddings enable row level security;
create policy reference_embeddings_read on public.reference_embeddings for select to authenticated
  using (public.is_super_admin() or public.is_active_recruiter());
grant select on public.reference_embeddings to authenticated;

-- Semantic retrieval over references (security invoker → RLS above applies).
create or replace function public.match_reference_assessments(p_embedding text, p_model text, p_limit int default 8)
returns table (reference_id uuid, similarity real)
language sql stable security invoker set search_path = '' as $$
  select e.reference_id, (1 - (e.embedding operator(extensions.<=>) p_embedding::extensions.vector))::real
    from public.reference_embeddings e
   where e.model = p_model
   order by e.embedding operator(extensions.<=>) p_embedding::extensions.vector
   limit least(greatest(p_limit, 1), 20);
$$;

-- Rubric STRUCTURE of selected references for grounding generation (no answer keys / guidance).
create or replace function public.reference_rubrics_for_builder(p_ids uuid[])
returns table (reference_id uuid, rubric jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_active_recruiter() or public.is_super_admin()) then raise exception 'not authorized' using errcode = '42501'; end if;
  return query select r.reference_id, r.rubric from public.reference_assessment_assessor r where r.reference_id = any (p_ids);
end $$;

-- ---------------------------------------------------------------- generated assessments
create table public.assessment_generations (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  job_snapshot jsonb not null,                 -- inputs the recruiter confirmed/edited
  references_used jsonb not null default '[]'::jsonb, -- [{reference_id, role, sector, similarity, reason}]
  output jsonb,                                -- full generated draft (scenario, tasks, data specs, rubric)
  validation jsonb,                            -- [{check, passed, detail}]
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  provider text,
  model text,
  created_by uuid references public.profiles (id) default auth.uid(),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.assessment_generations enable row level security;
create policy generations_company on public.assessment_generations for all to authenticated
  using (public.can_recruit(company_id)) with check (public.can_recruit(company_id));
grant select, insert, update on public.assessment_generations to authenticated;

-- Assessor-only version of an assessment (company evaluators only; NEVER candidates).
create table public.assessment_assessor_guides (
  assessment_id uuid primary key references public.assessments (id) on delete cascade,
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  guide jsonb not null,                        -- per-criterion scoring guidance, expected evidence, task mapping
  updated_at timestamptz not null default now()
);
alter table public.assessment_assessor_guides enable row level security;
create policy assessor_guides_company on public.assessment_assessor_guides for all to authenticated
  using (public.can_recruit(company_id)) with check (public.can_recruit(company_id));
grant select, insert, update on public.assessment_assessor_guides to authenticated;

-- Files attached to an assessment, by audience.
create table public.assessment_materials (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  audience text not null check (audience in ('candidate', 'assessor')),
  file_name text not null check (file_name !~* '(midan|ميدان)'),
  storage_path text not null unique,
  mime_type text not null,
  description text,
  rows int,
  columns text[],
  sha256 text,
  created_at timestamptz not null default now()
);
alter table public.assessment_materials enable row level security;
create policy materials_company on public.assessment_materials for all to authenticated
  using (public.can_recruit(company_id)) with check (public.can_recruit(company_id));
-- candidates see CANDIDATE materials only, and only for assessments assigned to them
create policy materials_candidate on public.assessment_materials for select to authenticated
  using (audience = 'candidate' and exists (
    select 1 from public.assessment_assignments aa where aa.assessment_id = assessment_materials.assessment_id and aa.candidate_id = (select auth.uid())));
grant select, insert, update, delete on public.assessment_materials to authenticated;

create or replace function public.can_read_assessment_material(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assessment_materials m
    where m.storage_path = p_name and (
      public.can_recruit(m.company_id)
      or (m.audience = 'candidate' and exists (
            select 1 from public.assessment_assignments aa where aa.assessment_id = m.assessment_id and aa.candidate_id = auth.uid()))
    )
  );
$$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('assessment-materials', 'assessment-materials', false, 20971520),
       ('reference-library', 'reference-library', false, 52428800)
on conflict (id) do nothing;

-- Materials: path = {assessment_id}/{candidate|assessor}/{file}; read per material row; write by its company.
create policy assessment_materials_read on storage.objects for select to authenticated
  using (bucket_id = 'assessment-materials' and public.can_read_assessment_material(name));
create policy assessment_materials_write on storage.objects for insert to authenticated
  with check (bucket_id = 'assessment-materials' and public.can_manage_assessment((split_part(name, '/', 1))::uuid));
-- Reference originals (provenance): Super Admin only.
create policy reference_library_read on storage.objects for select to authenticated
  using (bucket_id = 'reference-library' and public.is_super_admin());

revoke all on function public.is_active_recruiter() from public, anon;
revoke all on function public.reference_rubrics_for_builder(uuid[]) from public, anon;
revoke all on function public.can_read_assessment_material(text) from public, anon;
grant execute on function public.is_active_recruiter() to authenticated;
grant execute on function public.match_reference_assessments(text, text, int) to authenticated;
grant execute on function public.reference_rubrics_for_builder(uuid[]) to authenticated;
grant execute on function public.can_read_assessment_material(text) to authenticated;
