-- JADARAH — 0013 semantic matching with pgvector
-- Vectors are always stored with the model + dimensions that produced them, and every
-- similarity query joins on (model, dims) so vectors from different models are never compared.
-- Content hashes let callers skip re-embedding unchanged text.

create extension if not exists vector with schema extensions;

-- Skill taxonomy embeddings (public catalogue data). Written only by Super Admin / service role.
create table public.skill_embeddings (
  skill_id uuid not null references public.skills (id) on delete cascade,
  model text not null,
  dims int not null check (dims = 768),
  content_hash text not null,
  embedding extensions.vector(768) not null,
  updated_at timestamptz not null default now(),
  primary key (skill_id, model)
);
alter table public.skill_embeddings enable row level security;
create policy skill_embeddings_read on public.skill_embeddings for select to anon, authenticated using (true);
create policy skill_embeddings_admin on public.skill_embeddings for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Candidate profile embedding (skills + headline + summary + experience titles). Owner-written.
create table public.candidate_embeddings (
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  model text not null,
  dims int not null check (dims = 768),
  content_hash text not null,
  embedding extensions.vector(768) not null,
  updated_at timestamptz not null default now(),
  primary key (candidate_id, model)
);
alter table public.candidate_embeddings enable row level security;
create policy candidate_embeddings_read on public.candidate_embeddings for select to authenticated
  using (public.can_view_candidate(candidate_id));
create policy candidate_embeddings_insert on public.candidate_embeddings for insert to authenticated
  with check (candidate_id = (select auth.uid()));
create policy candidate_embeddings_update on public.candidate_embeddings for update to authenticated
  using (candidate_id = (select auth.uid())) with check (candidate_id = (select auth.uid()));

-- Job requirement embedding (title + description + requirements + skills). Written by its recruiters.
create table public.job_embeddings (
  job_id uuid not null references public.jobs (id) on delete cascade,
  model text not null,
  dims int not null check (dims = 768),
  content_hash text not null,
  embedding extensions.vector(768) not null,
  updated_at timestamptz not null default now(),
  primary key (job_id, model)
);
alter table public.job_embeddings enable row level security;
create policy job_embeddings_read on public.job_embeddings for select to authenticated
  using (public.can_view_job(job_id));
create policy job_embeddings_insert on public.job_embeddings for insert to authenticated
  with check (public.can_manage_job(job_id));
create policy job_embeddings_update on public.job_embeddings for update to authenticated
  using (public.can_manage_job(job_id)) with check (public.can_manage_job(job_id));

grant select on public.skill_embeddings to anon;
grant select on public.skill_embeddings, public.candidate_embeddings, public.job_embeddings to authenticated;
grant insert, update, delete on public.skill_embeddings to authenticated;
grant insert, update on public.candidate_embeddings, public.job_embeddings to authenticated;

-- For each required skill the candidate lacks, the most similar skill they DO have (≥ threshold).
-- Security invoker: reads only what RLS allows (taxonomy embeddings are public).
create or replace function public.related_skills(
  p_required uuid[], p_have uuid[], p_model text, p_min real default 0.78
)
returns table (required_skill_id uuid, related_skill_id uuid, similarity real)
language sql stable security invoker set search_path = '' as $$
  select distinct on (r.skill_id)
    r.skill_id, h.skill_id,
    (1 - (r.embedding operator(extensions.<=>) h.embedding))::real
  from public.skill_embeddings r
  join public.skill_embeddings h
    on h.model = r.model and h.dims = r.dims and h.skill_id = any (p_have) and h.skill_id <> r.skill_id
  where r.model = p_model
    and r.skill_id = any (p_required)
    and 1 - (r.embedding operator(extensions.<=>) h.embedding) >= p_min
  order by r.skill_id, r.embedding operator(extensions.<=>) h.embedding;
$$;

-- Cosine similarity between a candidate profile and a job, when both were embedded with the same model.
-- Security invoker: returns null unless the caller can read both embeddings through RLS.
create or replace function public.semantic_fit(p_candidate uuid, p_job uuid, p_model text)
returns real
language sql stable security invoker set search_path = '' as $$
  select (1 - (c.embedding operator(extensions.<=>) j.embedding))::real
  from public.candidate_embeddings c
  join public.job_embeddings j on j.model = c.model and j.dims = c.dims
  where c.candidate_id = p_candidate and j.job_id = p_job and c.model = p_model;
$$;

-- Jobs ordered by semantic similarity to the calling candidate (published, visible jobs only via RLS).
create or replace function public.semantic_job_ranking(p_model text, p_limit int default 50)
returns table (job_id uuid, similarity real)
language sql stable security invoker set search_path = '' as $$
  select j.job_id, (1 - (c.embedding operator(extensions.<=>) j.embedding))::real
  from public.candidate_embeddings c
  join public.job_embeddings j on j.model = c.model and j.dims = c.dims
  where c.candidate_id = (select auth.uid()) and c.model = p_model
  order by c.embedding operator(extensions.<=>) j.embedding
  limit least(greatest(p_limit, 1), 200);
$$;

revoke all on function public.related_skills(uuid[], uuid[], text, real) from public;
revoke all on function public.semantic_fit(uuid, uuid, text) from public;
revoke all on function public.semantic_job_ranking(text, int) from public;
grant execute on function public.related_skills(uuid[], uuid[], text, real) to anon, authenticated;
grant execute on function public.semantic_fit(uuid, uuid, text) to authenticated;
grant execute on function public.semantic_job_ranking(text, int) to authenticated;
