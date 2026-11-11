-- JADARAH — 0025 product experience
--  A. Job ↔ practical task lifecycle: the task attached by the employer is assigned automatically when a
--     candidate applies (no employer approval gate); the application is "complete" only once the task is submitted.
--  B. Fairness: once any candidate has been assigned a task, its content is locked (same version for everyone).
--  C. Employer-managed company identity (logo, cover, colours) — tenant-scoped, public read for listed/branded pages.
--  D. Career discovery: exploratory tasks per job category + candidate attempts (never a hiring score).

-- =================================================================== A. job ↔ task
alter table public.assessments
  add column if not exists job_id uuid,        -- job the task was created for (no FK: keeps jobs↔assessments embeds unambiguous)
  add column if not exists creation_key uuid;                                              -- idempotency key from the client
create unique index if not exists assessments_creation_key_uidx on public.assessments (company_id, creation_key)
  where creation_key is not null;
create index if not exists assessments_job_idx on public.assessments (job_id);

alter table public.applications
  add column if not exists requires_task boolean not null default false,
  add column if not exists task_assignment_id uuid,   -- set only by apply_to_job (no FK: keeps embeds unambiguous)
  add column if not exists completed_at timestamptz;
-- Existing applications were complete when submitted.
update public.applications set completed_at = submitted_at where completed_at is null and not requires_task;
create index if not exists applications_completed_idx on public.applications (company_id, completed_at);

-- The attached task must belong to the job's company (or be a published platform-library task),
-- a published job can only carry a published task, and a task cannot be swapped once candidates have it.
create or replace function public.jobs_enforce_task()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_a public.assessments;
begin
  if new.assessment_id is not null then
    select * into v_a from public.assessments where id = new.assessment_id;
    if v_a.id is null then raise exception 'practical task not found' using errcode = 'P0002'; end if;
    if v_a.company_id is null then
      if v_a.status <> 'published' then raise exception 'practical task is not available' using errcode = 'P0001'; end if;
    elsif v_a.company_id <> new.company_id then
      raise exception 'practical task belongs to another organization' using errcode = '42501';
    end if;
    if v_a.status = 'archived' and (tg_op = 'INSERT' or old.assessment_id is distinct from new.assessment_id) then
      raise exception 'practical task is archived' using errcode = 'P0001';
    end if;
  end if;
  if new.status = 'published' and new.assessment_id is not null
     and (select status from public.assessments where id = new.assessment_id) <> 'published' then
    raise exception 'publish the practical task before publishing the job' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and old.assessment_id is distinct from new.assessment_id and old.assessment_id is not null
     and exists (select 1 from public.applications a where a.job_id = new.id and a.requires_task) then
    raise exception 'candidates have already received this practical task; it cannot be replaced' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists jobs_enforce_task on public.jobs;
create trigger jobs_enforce_task before insert or update of assessment_id, status on public.jobs
  for each row execute function public.jobs_enforce_task();
revoke execute on function public.jobs_enforce_task() from public, anon, authenticated;

-- Attach (or replace) a job's practical task. Idempotent.
create or replace function public.attach_job_task(p_job uuid, p_assessment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job for update;
  if v_job.id is null or not public.can_recruit(v_job.company_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_job.assessment_id is not distinct from p_assessment then return; end if;
  update public.jobs set assessment_id = p_assessment where id = p_job;   -- jobs_enforce_task validates
  if p_assessment is not null then
    update public.assessments set job_id = p_job where id = p_assessment and company_id = v_job.company_id and job_id is null;
  end if;
  perform public.write_audit('job.task_attached', 'job', p_job, v_job.company_id,
    jsonb_build_object('assessment_id', p_assessment, 'previous', v_job.assessment_id));
end $$;
grant execute on function public.attach_job_task(uuid, uuid) to authenticated;

-- Candidate-safe preview of a published job's task: never questions, options, keys, rubric notes or assessor material.
create or replace function public.job_task_preview(p_job uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'title_en', a.title_en, 'title_ar', a.title_ar,
    'description_en', a.description_en, 'description_ar', a.description_ar,
    'duration_minutes', a.duration_minutes, 'difficulty', a.difficulty,
    'learning_outcomes_en', a.learning_outcomes_en, 'learning_outcomes_ar', a.learning_outcomes_ar,
    'question_count', (select count(*) from public.assessment_questions q where q.assessment_id = a.id),
    'question_types', coalesce((select jsonb_agg(distinct q.type) from public.assessment_questions q where q.assessment_id = a.id), '[]'))
  from public.jobs j join public.assessments a on a.id = j.assessment_id
  where j.id = p_job and j.status = 'published' and a.status = 'published' and public.is_company_approved(j.company_id);
$$;
grant execute on function public.job_task_preview(uuid) to anon, authenticated;

-- apply_to_job: same checks as before; when the job carries a published task, the candidate is assigned it in the
-- same transaction (status assessment_pending) and the application stays incomplete until the task is submitted.
create or replace function public.apply_to_job(
  p_job uuid, p_cv_document uuid, p_cover_letter text default null, p_answers jsonb default '[]'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_job public.jobs; v_app uuid; v_q record; v_answer text;
  v_task public.assessments; v_assignment uuid;
begin
  if v_uid is null or not public.is_active_user() then raise exception 'authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.user_roles where user_id = v_uid and role = 'candidate') then
    raise exception 'only candidates can apply to jobs' using errcode = '42501';
  end if;
  select * into v_job from public.jobs where id = p_job for share;
  if v_job.id is null or v_job.status <> 'published' or not public.is_company_approved(v_job.company_id) then
    raise exception 'this job is not accepting applications' using errcode = 'P0001';
  end if;
  if v_job.deadline is not null and v_job.deadline < current_date then
    raise exception 'the application deadline has passed' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.applications where job_id = p_job and candidate_id = v_uid) then
    raise exception 'you have already applied to this job' using errcode = '23505';
  end if;
  if p_cv_document is not null and not exists (
    select 1 from public.candidate_documents where id = p_cv_document and candidate_id = v_uid and kind = 'cv' and deleted_at is null) then
    raise exception 'selected CV was not found' using errcode = 'P0001';
  end if;
  if v_job.assessment_id is not null then
    select * into v_task from public.assessments where id = v_job.assessment_id;
    if v_task.status <> 'published' then
      raise exception 'this job is not accepting applications' using errcode = 'P0001';
    end if;
  end if;

  insert into public.applications (job_id, company_id, candidate_id, cv_document_id, cover_letter, requires_task, completed_at)
  values (p_job, v_job.company_id, v_uid, p_cv_document, nullif(trim(p_cover_letter), ''),
          v_task.id is not null, case when v_task.id is null then now() end)
  returning id into v_app;

  if p_cv_document is not null then
    insert into public.application_documents (application_id, document_id, kind) values (v_app, p_cv_document, 'cv');
  end if;

  for v_q in select * from public.job_application_questions where job_id = p_job loop
    select a ->> 'answer' into v_answer from jsonb_array_elements(coalesce(p_answers, '[]')) a
      where (a ->> 'question_id')::uuid = v_q.id limit 1;
    if v_q.is_required and coalesce(trim(v_answer), '') = '' then
      raise exception 'please answer all required questions' using errcode = 'P0001';
    end if;
    if coalesce(trim(v_answer), '') <> '' then
      insert into public.application_answers (application_id, question_id, answer) values (v_app, v_q.id, trim(v_answer));
    end if;
  end loop;

  insert into public.application_status_history (application_id, from_status, to_status, changed_by)
  values (v_app, null, 'submitted', v_uid);

  if v_task.id is not null then
    -- Same published task (locked content) for every applicant; no employer action needed.
    insert into public.assessment_assignments (assessment_id, application_id, candidate_id, company_id, assigned_by, due_at)
    values (v_task.id, v_app, v_uid, v_job.company_id, null,
            case when v_job.deadline is not null then ((v_job.deadline + 1)::timestamp at time zone 'Asia/Riyadh') end)
    on conflict (assessment_id, candidate_id, application_id) do nothing
    returning id into v_assignment;
    if v_assignment is null then
      select id into v_assignment from public.assessment_assignments
      where assessment_id = v_task.id and candidate_id = v_uid and application_id = v_app;
    end if;
    update public.applications set status = 'assessment_pending', task_assignment_id = v_assignment where id = v_app;
    insert into public.application_status_history (application_id, from_status, to_status, changed_by, reason)
    values (v_app, 'submitted', 'assessment_pending', v_uid, 'Job practical task');
    perform public.notify(v_uid, 'assessment_assigned', 'Complete the practical task: ' || v_job.title_en,
      'أكمل المهمة العملية: ' || v_job.title_ar,
      'Your application is complete once you submit the practical task.',
      'يكتمل طلبك عند تسليم المهمة العملية.', '/candidate/assessments/' || v_assignment);
  else
    perform public.notify(v_uid, 'application_submitted', 'Application submitted: ' || v_job.title_en,
      'تم إرسال طلبك: ' || v_job.title_ar, 'We will notify you as the company reviews it.',
      'سنبلغك عند مراجعة الشركة لطلبك.', '/candidate/applications/' || v_app);
    perform public.notify_company_recruiters(v_job.company_id, 'application_received',
      'New application: ' || v_job.title_en, 'طلب جديد: ' || v_job.title_ar, null, null, '/company/applications/' || v_app);
  end if;
  perform public.write_audit('application.submitted', 'application', v_app, v_job.company_id,
    jsonb_build_object('job_id', p_job, 'task_assignment', v_assignment));
  return v_app;
end $$;
grant execute on function public.apply_to_job(uuid, uuid, text, jsonb) to authenticated;

-- An application with a required task becomes complete when that task is submitted
-- (submit_assessment already notifies the candidate and the company's recruiters).
create or replace function public.assignment_completes_application()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('submitted', 'evaluated') and old.status not in ('submitted', 'evaluated') and new.application_id is not null then
    update public.applications set completed_at = now()
    where id = new.application_id and requires_task and task_assignment_id = new.id and completed_at is null;
  end if;
  return new;
end $$;
drop trigger if exists assessment_assignments_complete_app on public.assessment_assignments;
create trigger assessment_assignments_complete_app after update of status on public.assessment_assignments
  for each row execute function public.assignment_completes_application();
revoke execute on function public.assignment_completes_application() from public, anon, authenticated;

-- start_assessment: closed applications cannot start a task; a job closed after applying still lets the candidate
-- resume or finish work already started.
create or replace function public.start_assessment(p_assignment uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_as public.assessment_assignments; v_a public.assessments; v_sub public.assessment_submissions; v_result jsonb;
  v_app public.applications;
begin
  select * into v_as from public.assessment_assignments where id = p_assignment for update;
  if v_as.id is null or v_as.candidate_id <> auth.uid() then raise exception 'assessment not found' using errcode = '42501'; end if;
  if v_as.status in ('cancelled', 'expired') then raise exception 'this assessment is no longer available' using errcode = 'P0001'; end if;
  select * into v_a from public.assessments where id = v_as.assessment_id;
  select * into v_sub from public.assessment_submissions where assignment_id = p_assignment;
  if v_sub.id is null then
    if v_as.application_id is not null then
      select * into v_app from public.applications where id = v_as.application_id;
      if v_app.status in ('withdrawn', 'rejected', 'hired') then
        raise exception 'this application is closed' using errcode = 'P0001';
      end if;
    end if;
    if v_as.due_at is not null and v_as.due_at < now() then
      update public.assessment_assignments set status = 'expired' where id = p_assignment;
      raise exception 'the deadline for this assessment has passed' using errcode = 'P0001';
    end if;
    insert into public.assessment_submissions (assignment_id, candidate_id, max_score)
    values (p_assignment, auth.uid(), (select coalesce(sum(points), 0) from public.assessment_questions where assessment_id = v_a.id))
    on conflict (assignment_id) do nothing;
    select * into v_sub from public.assessment_submissions where assignment_id = p_assignment;
    update public.assessment_assignments set status = 'in_progress', started_at = coalesce(started_at, now())
      where id = p_assignment and status = 'assigned';
  end if;

  select jsonb_build_object(
    'assignment_id', v_as.id, 'submission_id', v_sub.id, 'status', v_sub.status,
    'started_at', v_sub.started_at, 'submitted_at', v_sub.submitted_at,
    'ends_at', v_sub.started_at + make_interval(mins => v_a.duration_minutes), 'due_at', v_as.due_at,
    'assessment', jsonb_build_object('id', v_a.id, 'title_en', v_a.title_en, 'title_ar', v_a.title_ar,
      'description_en', v_a.description_en, 'description_ar', v_a.description_ar, 'duration_minutes', v_a.duration_minutes,
      'passing_score', v_a.passing_score),
    'sections', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title_en', s.title_en, 'title_ar', s.title_ar) order by s.position)
      from public.assessment_sections s where s.assessment_id = v_a.id), '[]'),
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
        'id', q.id, 'section_id', q.section_id, 'type', q.type, 'prompt_en', q.prompt_en, 'prompt_ar', q.prompt_ar,
        'points', q.points, 'config', q.config - 'accepted_answers',
        'rubric', (select jsonb_build_object('title_en', r.title_en, 'title_ar', r.title_ar, 'criteria', r.criteria) from public.assessment_rubrics r where r.id = q.rubric_id),
        'options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'label_en', o.label_en, 'label_ar', o.label_ar) order by o.position)
          from public.assessment_options o where o.question_id = q.id), '[]'),
        'answer', (select jsonb_build_object('selected_option_ids', aa.selected_option_ids, 'text_answer', aa.text_answer, 'file_path', aa.file_path)
          from public.assessment_answers aa where aa.submission_id = v_sub.id and aa.question_id = q.id)
      ) order by q.position) from public.assessment_questions q where q.assessment_id = v_a.id), '[]')
  ) into v_result;
  return v_result;
end $$;
grant execute on function public.start_assessment(uuid) to authenticated;

-- =================================================================== B. fairness: lock assigned task content
create or replace function public.assessment_is_in_use(p_assessment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.assessment_assignments where assessment_id = p_assessment);
$$;
grant execute on function public.assessment_is_in_use(uuid) to authenticated;

create or replace function public.lock_assigned_task_content()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if tg_table_name = 'assessment_options' then
    select q.assessment_id into v_id from public.assessment_questions q
      where q.id = coalesce(case when tg_op = 'DELETE' then old.question_id else new.question_id end, null);
  elsif tg_op = 'DELETE' then
    v_id := old.assessment_id;
  else
    v_id := new.assessment_id;
  end if;
  if v_id is not null and public.assessment_is_in_use(v_id)
     and exists (select 1 from public.assessments where id = v_id) then
    raise exception 'this practical task has already been given to candidates; duplicate it to make changes'
      using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke execute on function public.lock_assigned_task_content() from public, anon, authenticated;
drop trigger if exists lock_questions on public.assessment_questions;
create trigger lock_questions before insert or update or delete on public.assessment_questions
  for each row execute function public.lock_assigned_task_content();
drop trigger if exists lock_options on public.assessment_options;
create trigger lock_options before insert or update or delete on public.assessment_options
  for each row execute function public.lock_assigned_task_content();
drop trigger if exists lock_sections on public.assessment_sections;
create trigger lock_sections before insert or update or delete on public.assessment_sections
  for each row execute function public.lock_assigned_task_content();
drop trigger if exists lock_rubrics on public.assessment_rubrics;
create trigger lock_rubrics before insert or update or delete on public.assessment_rubrics
  for each row execute function public.lock_assigned_task_content();

create or replace function public.lock_assigned_task_meta()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.assessment_is_in_use(old.id) and (
       new.title_en is distinct from old.title_en or new.title_ar is distinct from old.title_ar
    or new.description_en is distinct from old.description_en or new.description_ar is distinct from old.description_ar
    or new.duration_minutes is distinct from old.duration_minutes or new.passing_score is distinct from old.passing_score
    or (new.status = 'draft' and old.status <> 'draft')) then
    raise exception 'this practical task has already been given to candidates; duplicate it to make changes'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.lock_assigned_task_meta() from public, anon, authenticated;
drop trigger if exists lock_assessment_meta on public.assessments;
create trigger lock_assessment_meta before update on public.assessments
  for each row execute function public.lock_assigned_task_meta();

-- =================================================================== C. employer-managed company identity
create table if not exists public.company_identity (
  company_id uuid primary key references public.company_profiles (id) on delete cascade,
  logo_path text check (logo_path is null or logo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  cover_path text check (cover_path is null or cover_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  tagline_en text check (tagline_en is null or char_length(tagline_en) <= 160),
  tagline_ar text check (tagline_ar is null or char_length(tagline_ar) <= 160),
  primary_hex text check (primary_hex is null or primary_hex ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_hex text check (secondary_hex is null or secondary_hex ~ '^#[0-9A-Fa-f]{6}$'),
  accent_hex text check (accent_hex is null or accent_hex ~ '^#[0-9A-Fa-f]{6}$'),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (logo_path is null or split_part(logo_path, '/', 1) = company_id::text),
  check (cover_path is null or split_part(cover_path, '/', 1) = company_id::text)
);
alter table public.company_identity enable row level security;
drop policy if exists company_identity_read on public.company_identity;
create policy company_identity_read on public.company_identity for select to anon, authenticated using (true);
grant select on public.company_identity to anon, authenticated;  -- writes only through update_company_identity

create or replace function public.update_company_identity(
  p_company uuid, p_logo_path text, p_cover_path text, p_tagline_en text, p_tagline_ar text,
  p_primary text, p_secondary text, p_accent text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_company_role(p_company, array['company_admin']::public.membership_role[]) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  insert into public.company_identity as ci (company_id, logo_path, cover_path, tagline_en, tagline_ar,
    primary_hex, secondary_hex, accent_hex, updated_by, updated_at)
  values (p_company, nullif(p_logo_path, ''), nullif(p_cover_path, ''), nullif(trim(p_tagline_en), ''), nullif(trim(p_tagline_ar), ''),
    nullif(p_primary, ''), nullif(p_secondary, ''), nullif(p_accent, ''), auth.uid(), now())
  on conflict (company_id) do update set logo_path = excluded.logo_path, cover_path = excluded.cover_path,
    tagline_en = excluded.tagline_en, tagline_ar = excluded.tagline_ar, primary_hex = excluded.primary_hex,
    secondary_hex = excluded.secondary_hex, accent_hex = excluded.accent_hex, updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;
  perform public.write_audit('company.identity_updated', 'company', p_company, p_company, '{}'::jsonb);
end $$;
grant execute on function public.update_company_identity(uuid, text, text, text, text, text, text, text) to authenticated;

-- Public bucket for brand imagery the organization itself publishes (logos, covers). Writes: company admins only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-identity', 'company-identity', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists company_identity_insert on storage.objects;
create policy company_identity_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'company-identity' and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$'
    and public.has_company_role(split_part(name, '/', 1)::uuid, array['company_admin']::public.membership_role[]));
drop policy if exists company_identity_delete on storage.objects;
create policy company_identity_delete on storage.objects for delete to authenticated
  using (bucket_id = 'company-identity' and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$'
    and public.has_company_role(split_part(name, '/', 1)::uuid, array['company_admin']::public.membership_role[]));
drop policy if exists company_identity_select on storage.objects;
create policy company_identity_select on storage.objects for select to authenticated
  using (bucket_id = 'company-identity' and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$'
    and public.has_company_role(split_part(name, '/', 1)::uuid, array['company_admin']::public.membership_role[]));

-- =================================================================== D. career discovery: exploratory tasks
create table if not exists public.exploration_tasks (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.job_categories (id) on delete cascade,
  slug text not null unique,
  title_en text not null, title_ar text not null,
  role_en text not null, role_ar text not null,
  daily_en text[] not null default '{}', daily_ar text[] not null default '{}',
  scenario_en text not null, scenario_ar text not null,
  deliverable_en text not null, deliverable_ar text not null,
  criteria jsonb not null default '[]',   -- [{key, en, ar, keywords:[...]}] — used for transparent rule-based feedback
  next_steps_en text[] not null default '{}', next_steps_ar text[] not null default '{}',
  minutes smallint not null default 20 check (minutes between 5 and 90),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.exploration_tasks enable row level security;
drop policy if exists exploration_tasks_read on public.exploration_tasks;
create policy exploration_tasks_read on public.exploration_tasks for select to authenticated using (active or public.is_super_admin());
grant select on public.exploration_tasks to authenticated;

create table if not exists public.exploration_attempts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  task_id uuid not null references public.exploration_tasks (id) on delete cascade,
  response text not null default '' check (char_length(response) <= 12000),
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  feedback jsonb,              -- {strengths[], improvements[], coverage, source: 'ai'|'rule_based'}
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists exploration_attempts_candidate_idx on public.exploration_attempts (candidate_id, created_at desc);
alter table public.exploration_attempts enable row level security;
drop policy if exists exploration_attempts_own on public.exploration_attempts;
create policy exploration_attempts_own on public.exploration_attempts for all to authenticated
  using (candidate_id = (select auth.uid())) with check (candidate_id = (select auth.uid()));
grant select, insert, update, delete on public.exploration_attempts to authenticated;
drop trigger if exists exploration_attempts_updated_at on public.exploration_attempts;
create trigger exploration_attempts_updated_at before update on public.exploration_attempts
  for each row execute function public.set_updated_at();
