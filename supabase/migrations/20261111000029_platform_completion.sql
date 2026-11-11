-- JADARAH — 0029 platform completion (PENDING OWNER APPROVAL before it is applied to maknon).
-- Tested on a disposable local database: tests/db/run-local.sh (tests/db/0029_*.test.sql).
--
--  1. private schema + server key: narrow credential for server-only RPCs (no service-role key in the web app)
--  2. shared rate limits + shared AI provider cooldowns (multi-instance safe)
--  3. assessment answer files (file_upload questions): table, RPCs, storage policies
--  4. interview attachments: table, RPCs, storage policies
--  5. email outbox: provider-agnostic queue fed by notifications and company invitations; worker RPCs;
--     invitation lifecycle (token accept, revoke, resend, expiry) with last-admin protection
--  6. Daily.co webhooks: idempotent event ledger, meeting state, webhook-sourced attendance
--  7. health ping
-- Additive only: no existing rows are changed except notifications.email_status for new notifications
-- and the two storage helper functions (same rules for every other bucket).

-- ============================================================== 1. private schema + server key
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.service_keys (
  name text primary key check (name ~ '^[a-z0-9_]{2,40}$'),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

-- True when p_key is a registered server key (stored as SHA-256 hex; the key itself is never stored).
create or replace function private.service_key_ok(p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_key is not null and length(p_key) >= 32 and exists (
    select 1 from private.service_keys k
    where k.key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex'));
$$;

create or replace function private.require_service(p_key text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.service_key_ok(p_key) then raise exception 'not authorized' using errcode = '42501'; end if;
end $$;

-- ============================================================== 2. shared rate limits + AI cooldowns
create table if not exists private.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);

-- Fixed-window counter shared by every app instance. Keys are hashed by the app (no raw IPs stored).
create or replace function public.internal_rate_limit(p_service_key text, p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_hits integer; v_window interval;
begin
  perform private.require_service(p_service_key);
  if p_key is null or length(p_key) > 200 or p_limit < 1 or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid rate limit request' using errcode = '22023';
  end if;
  v_window := make_interval(secs => p_window_seconds);
  insert into private.rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start + v_window <= now() then 1 else r.hits + 1 end,
    window_start = case when r.window_start + v_window <= now() then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end $$;

create table if not exists private.ai_cooldowns (
  key text primary key check (length(key) <= 200),
  until timestamptz not null,
  reason text check (reason is null or length(reason) <= 80)
);

create or replace function public.internal_ai_cooldowns(p_service_key text)
returns table (key text, until timestamptz) language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_service(p_service_key);
  return query select c.key, c.until from private.ai_cooldowns c where c.until > now();
end $$;

create or replace function public.internal_ai_cooldown_note(p_service_key text, p_key text, p_seconds integer, p_reason text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_service(p_service_key);
  if p_key is null or length(p_key) > 200 or p_seconds not between 1 and 86400 then
    raise exception 'invalid cooldown' using errcode = '22023';
  end if;
  insert into private.ai_cooldowns as c (key, until, reason) values (p_key, now() + make_interval(secs => p_seconds), left(p_reason, 80))
  on conflict (key) do update set until = greatest(c.until, excluded.until), reason = excluded.reason;
end $$;

-- ============================================================== 3. assessment answer files
-- Object path: <candidate uid>/<submission id>/<question id>/<file name>  (bucket assessment-attachments)
update storage.buckets set
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/zip', 'text/plain', 'text/csv',
    'application/json', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation']
where id = 'assessment-attachments';

create or replace function public.assessment_file_mime_ok(p_mime text)
returns boolean language sql immutable set search_path = '' as $$
  select p_mime = any (array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/zip', 'text/plain', 'text/csv',
    'application/json', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation']);
$$;

create table if not exists public.assessment_answer_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assessment_submissions (id) on delete cascade,
  question_id uuid not null references public.assessment_questions (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null check (public.assessment_file_mime_ok(mime_type)),
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  created_at timestamptz not null default now()
);
create index if not exists assessment_answer_files_sub on public.assessment_answer_files (submission_id, question_id);
alter table public.assessment_answer_files enable row level security;

-- Who may review a submission's evidence: the candidate, the assignment's company recruiters,
-- interviewers assigned to an interview for the same application, Super Admin.
create or replace function public.can_review_submission(p_submission uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assessment_submissions s
    join public.assessment_assignments aa on aa.id = s.assignment_id
    where s.id = p_submission and (
      s.candidate_id = auth.uid()
      or public.is_super_admin()
      or (aa.company_id is not null and public.can_recruit(aa.company_id))
      or (aa.application_id is not null and exists (
        select 1 from public.interviews i join public.interview_participants ip on ip.interview_id = i.id
        where i.application_id = aa.application_id and ip.user_id = auth.uid()
          and public.company_service_active(i.company_id)))
    ));
$$;

drop policy if exists assessment_answer_files_read on public.assessment_answer_files;
create policy assessment_answer_files_read on public.assessment_answer_files for select to authenticated
  using (candidate_id = (select auth.uid()) or public.can_review_submission(submission_id));
grant select on public.assessment_answer_files to authenticated;

-- Candidate registers an uploaded object as part of an in-progress answer.
create or replace function public.register_assessment_file(
  p_assignment uuid, p_question uuid, p_path text, p_name text, p_mime text, p_size bigint
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_sub public.assessment_submissions; v_minutes int; v_q public.assessment_questions;
  v_obj_size bigint; v_obj_mime text; v_found boolean; v_id uuid;
begin
  select s.* into v_sub from public.assessment_submissions s where s.assignment_id = p_assignment for update;
  if v_sub.id is null or v_sub.candidate_id is distinct from auth.uid() then raise exception 'attempt not found' using errcode = '42501'; end if;
  if v_sub.status <> 'in_progress' then raise exception 'this assessment has already been submitted' using errcode = 'P0001'; end if;
  select a.duration_minutes into v_minutes from public.assessments a
    join public.assessment_assignments aa on aa.assessment_id = a.id where aa.id = p_assignment;
  if now() > v_sub.started_at + make_interval(mins => v_minutes + 2) then raise exception 'time is up for this assessment' using errcode = 'P0001'; end if;
  select q.* into v_q from public.assessment_questions q
    join public.assessment_assignments aa on aa.assessment_id = q.assessment_id
   where q.id = p_question and aa.id = p_assignment;
  if v_q.id is null then raise exception 'question not found' using errcode = 'P0002'; end if;
  if v_q.type <> 'file_upload' then raise exception 'this question does not accept files' using errcode = 'P0001'; end if;
  if p_path is null or p_path !~ ('^' || auth.uid()::text || '/' || v_sub.id::text || '/' || p_question::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,150}$') then
    raise exception 'invalid file path' using errcode = 'P0001';
  end if;
  select true, (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype' into v_found, v_obj_size, v_obj_mime
    from storage.objects o where o.bucket_id = 'assessment-attachments' and o.name = p_path;
  if v_found is null then raise exception 'uploaded file not found' using errcode = 'P0002'; end if;
  -- Storage metadata (set by the storage server) wins over client-declared values.
  p_size := coalesce(v_obj_size, p_size);
  p_mime := coalesce(v_obj_mime, p_mime);
  if not public.assessment_file_mime_ok(p_mime) then raise exception 'file type is not allowed' using errcode = 'P0001'; end if;
  if p_size is null or p_size < 1 or p_size > 20971520 then raise exception 'file is too large' using errcode = 'P0001'; end if;
  if (select count(*) from public.assessment_answer_files f where f.submission_id = v_sub.id and f.question_id = p_question) >= 5 then
    raise exception 'you can attach up to 5 files' using errcode = 'P0001';
  end if;
  insert into public.assessment_answer_files (submission_id, question_id, candidate_id, storage_path, file_name, mime_type, size_bytes)
  values (v_sub.id, p_question, auth.uid(), p_path, left(trim(coalesce(nullif(p_name, ''), 'file')), 200), p_mime, p_size)
  on conflict (storage_path) do nothing
  returning id into v_id;
  if v_id is null then select id into v_id from public.assessment_answer_files where storage_path = p_path; end if;
  insert into public.assessment_answers (submission_id, question_id, file_path) values (v_sub.id, p_question, p_path)
  on conflict (submission_id, question_id) do update
    set file_path = coalesce(public.assessment_answers.file_path, excluded.file_path);
  return v_id;
end $$;

-- Candidate removes a file from an in-progress answer. Returns the object path so the client can delete it.
create or replace function public.remove_assessment_file(p_file uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_f public.assessment_answer_files; v_status text;
begin
  select * into v_f from public.assessment_answer_files where id = p_file for update;
  if v_f.id is null or v_f.candidate_id is distinct from auth.uid() then raise exception 'file not found' using errcode = '42501'; end if;
  select status into v_status from public.assessment_submissions where id = v_f.submission_id;
  if v_status <> 'in_progress' then raise exception 'this assessment has already been submitted' using errcode = 'P0001'; end if;
  delete from public.assessment_answer_files where id = p_file;
  update public.assessment_answers set file_path = (
      select f.storage_path from public.assessment_answer_files f
      where f.submission_id = v_f.submission_id and f.question_id = v_f.question_id order by f.created_at limit 1)
   where submission_id = v_f.submission_id and question_id = v_f.question_id;
  return v_f.storage_path;
end $$;

-- ============================================================== 4. interview attachments
-- Object path: <company id>/<interview id>/<random>-<file name>  (bucket interview-attachments)
update storage.buckets set
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation']
where id = 'interview-attachments';

create table if not exists public.interview_attachments (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  uploader_role text not null check (uploader_role in ('staff', 'candidate')),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  shared_with_candidate boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists interview_attachments_interview on public.interview_attachments (interview_id, created_at);
alter table public.interview_attachments enable row level security;

-- 'staff' = recruiter of the interview's company or an assigned interviewer; 'candidate' = the applicant.
create or replace function public.interview_access_role(p_interview uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when public.can_recruit(i.company_id) or public.is_interview_participant(i.id) then 'staff'
    when a.candidate_id = auth.uid() then 'candidate'
  end
  from public.interviews i join public.applications a on a.id = i.application_id
  where i.id = p_interview;
$$;

drop policy if exists interview_attachments_read on public.interview_attachments;
create policy interview_attachments_read on public.interview_attachments for select to authenticated
  using (
    public.is_super_admin()
    or public.interview_access_role(interview_id) = 'staff'
    or (public.interview_access_role(interview_id) = 'candidate' and (shared_with_candidate or uploaded_by = (select auth.uid())))
  );
grant select on public.interview_attachments to authenticated;

create or replace function public.register_interview_attachment(
  p_interview uuid, p_path text, p_name text, p_mime text, p_size bigint, p_share boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_i public.interviews; v_role text; v_found boolean; v_obj_size bigint; v_obj_mime text; v_id uuid; v_cand uuid;
begin
  select * into v_i from public.interviews where id = p_interview;
  v_role := public.interview_access_role(p_interview);
  if v_i.id is null or v_role is null then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_i.status = 'cancelled' or (v_role = 'candidate' and v_i.status <> 'scheduled') then
    raise exception 'this interview no longer accepts attachments' using errcode = 'P0001';
  end if;
  if p_path is null or p_path !~ ('^' || v_i.company_id::text || '/' || v_i.id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,150}$') then
    raise exception 'invalid file path' using errcode = 'P0001';
  end if;
  select true, (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype' into v_found, v_obj_size, v_obj_mime
    from storage.objects o where o.bucket_id = 'interview-attachments' and o.name = p_path and o.owner = auth.uid();
  if v_found is null then raise exception 'uploaded file not found' using errcode = 'P0002'; end if;
  p_size := coalesce(v_obj_size, p_size);
  p_mime := coalesce(v_obj_mime, p_mime);
  if p_mime is null or not (p_mime = any (array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'])) then
    raise exception 'file type is not allowed' using errcode = 'P0001';
  end if;
  if p_size is null or p_size < 1 or p_size > 10485760 then raise exception 'file is too large' using errcode = 'P0001'; end if;
  if (select count(*) from public.interview_attachments where interview_id = p_interview) >= 20 then
    raise exception 'this interview already has the maximum number of attachments' using errcode = 'P0001';
  end if;
  insert into public.interview_attachments (interview_id, company_id, uploaded_by, uploader_role, storage_path, file_name, mime_type, size_bytes, shared_with_candidate)
  values (p_interview, v_i.company_id, auth.uid(), v_role, p_path, left(trim(coalesce(nullif(p_name, ''), 'file')), 200), p_mime, p_size,
          case when v_role = 'candidate' then true else coalesce(p_share, false) end)
  returning id into v_id;
  select a.candidate_id into v_cand from public.applications a where a.id = v_i.application_id;
  if v_role = 'staff' and coalesce(p_share, false) then
    perform public.notify(v_cand, 'interview_attachment', 'New interview document', 'مستند جديد للمقابلة',
      left(trim(p_name), 120), left(trim(p_name), 120), '/candidate/interviews');
  end if;
  perform public.write_audit('interview.attachment_added', 'interview', p_interview, v_i.company_id,
    jsonb_build_object('attachment', v_id, 'role', v_role, 'shared', case when v_role = 'candidate' then true else coalesce(p_share, false) end));
  return v_id;
end $$;

create or replace function public.set_interview_attachment_shared(p_attachment uuid, p_share boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_a public.interview_attachments; v_cand uuid;
begin
  select * into v_a from public.interview_attachments where id = p_attachment for update;
  if v_a.id is null or public.interview_access_role(v_a.interview_id) is distinct from 'staff' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_a.uploader_role = 'candidate' then raise exception 'candidate documents are always visible to the candidate' using errcode = 'P0001'; end if;
  update public.interview_attachments set shared_with_candidate = p_share where id = p_attachment;
  if p_share and not v_a.shared_with_candidate then
    select a.candidate_id into v_cand from public.interviews i join public.applications a on a.id = i.application_id where i.id = v_a.interview_id;
    perform public.notify(v_cand, 'interview_attachment', 'New interview document', 'مستند جديد للمقابلة',
      v_a.file_name, v_a.file_name, '/candidate/interviews');
  end if;
  perform public.write_audit('interview.attachment_shared', 'interview', v_a.interview_id, v_a.company_id,
    jsonb_build_object('attachment', p_attachment, 'shared', p_share));
end $$;

-- Uploader or a company recruiter removes an attachment. Returns the object path for storage deletion.
create or replace function public.remove_interview_attachment(p_attachment uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_a public.interview_attachments;
begin
  select * into v_a from public.interview_attachments where id = p_attachment for update;
  if v_a.id is null or not (v_a.uploaded_by = auth.uid() or public.can_recruit(v_a.company_id)) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  delete from public.interview_attachments where id = p_attachment;
  perform public.write_audit('interview.attachment_removed', 'interview', v_a.interview_id, v_a.company_id,
    jsonb_build_object('attachment', p_attachment));
  return v_a.storage_path;
end $$;

-- ============================================================== storage helpers (same rules for other buckets)
create or replace function public.can_read_storage_object(p_bucket text, p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_first text := split_part(p_name, '/', 1); v_second text := split_part(p_name, '/', 2);
begin
  if auth.uid() is null then return false; end if;
  if public.is_super_admin() then return true; end if;
  if p_bucket in ('candidate-cvs', 'candidate-certificates', 'candidate-projects') then
    if v_first = auth.uid()::text then return true; end if;
    return exists (select 1 from public.candidate_documents d where d.bucket = p_bucket and d.storage_path = p_name and public.can_view_document(d.id));
  elsif p_bucket = 'assessment-attachments' then
    if v_first = auth.uid()::text then return true; end if;
    return exists (select 1 from public.assessment_answer_files f
                   where f.storage_path = p_name and public.can_review_submission(f.submission_id))
      or exists (
        select 1 from public.assessment_answers a
        join public.assessment_submissions s on s.id = a.submission_id
        join public.assessment_assignments aa on aa.id = s.assignment_id
        where a.file_path = p_name and aa.company_id is not null and public.can_recruit(aa.company_id));
  elsif p_bucket = 'company-documents' then
    return v_first ~ '^[0-9a-f-]{36}$' and public.has_company_role(v_first::uuid);
  elsif p_bucket = 'interview-attachments' then
    -- Registered attachments follow the row's visibility (uploaders read their own objects via the owner policy below).
    return exists (
      select 1 from public.interview_attachments ia
      where ia.storage_path = p_name and (
        public.interview_access_role(ia.interview_id) = 'staff'
        or (public.interview_access_role(ia.interview_id) = 'candidate' and (ia.shared_with_candidate or ia.uploaded_by = auth.uid()))));
  end if;
  return false;
end $$;

create or replace function public.can_write_storage_object(p_bucket text, p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_first text := split_part(p_name, '/', 1); v_second text := split_part(p_name, '/', 2); v_third text := split_part(p_name, '/', 3);
begin
  if auth.uid() is null or not public.is_active_user() then return false; end if;
  if p_bucket in ('candidate-cvs', 'candidate-certificates', 'candidate-projects') then
    return v_first = auth.uid()::text;
  elsif p_bucket = 'assessment-attachments' then
    -- Only into an in-progress submission of the caller, for a file_upload question of that assessment.
    return v_first = auth.uid()::text and array_length(string_to_array(p_name, '/'), 1) = 4 and exists (
      select 1 from public.assessment_submissions s
      join public.assessment_assignments aa on aa.id = s.assignment_id
      join public.assessment_questions q on q.assessment_id = aa.assessment_id and q.type = 'file_upload'
      where s.id::text = v_second and q.id::text = v_third and s.candidate_id = auth.uid() and s.status = 'in_progress');
  elsif p_bucket = 'company-documents' then
    return v_first ~ '^[0-9a-f-]{36}$' and public.has_company_role(v_first::uuid, array['company_admin']::public.membership_role[]);
  elsif p_bucket = 'interview-attachments' then
    return v_first ~ '^[0-9a-f-]{36}$' and v_second ~ '^[0-9a-f-]{36}$' and array_length(string_to_array(p_name, '/'), 1) = 3
      and exists (select 1 from public.interviews i where i.id::text = v_second and i.company_id::text = v_first
                  and i.status <> 'cancelled' and public.interview_access_role(i.id) is not null);
  end if;
  return false;
end $$;

-- Deletion: assessment/interview objects only after their row was removed through the RPC (or never registered).
-- p_is_owner comes from the policy (storage.objects.owner), so this never queries storage.objects itself.
create or replace function public.can_delete_storage_object(p_bucket text, p_name text, p_is_owner boolean)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_active_user() then return false; end if;
  if p_bucket = 'assessment-attachments' then
    return split_part(p_name, '/', 1) = auth.uid()::text
      and not exists (select 1 from public.assessment_answer_files f where f.storage_path = p_name)
      and not exists (select 1 from public.assessment_answers a where a.file_path = p_name);
  elsif p_bucket = 'interview-attachments' then
    return not exists (select 1 from public.interview_attachments ia where ia.storage_path = p_name)
      and (coalesce(p_is_owner, false)
           or (split_part(p_name, '/', 1) ~ '^[0-9a-f-]{36}$' and public.can_recruit(split_part(p_name, '/', 1)::uuid)));
  end if;
  return public.can_write_storage_object(p_bucket, p_name);
end $$;

drop policy if exists jadarah_objects_delete on storage.objects;
create policy jadarah_objects_delete on storage.objects for delete to authenticated
  using (bucket_id in ('candidate-cvs', 'candidate-certificates', 'candidate-projects', 'assessment-attachments', 'company-documents', 'interview-attachments')
    and public.can_delete_storage_object(bucket_id, name, owner = (select auth.uid())));

-- Uploaders can read back their own interview uploads (needed between upload and registration).
drop policy if exists interview_attachments_owner_read on storage.objects;
create policy interview_attachments_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'interview-attachments' and owner = (select auth.uid()));

-- ============================================================== 5. email outbox + invitations
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (length(idempotency_key) <= 200),
  template text not null check (template ~ '^[a-z_]{2,60}$'),
  recipient_user uuid references public.profiles (id) on delete set null,
  recipient_email text not null check (recipient_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  payload jsonb not null default '{}',
  notification_id uuid references public.notifications (id) on delete set null,
  invitation_id uuid references public.company_invitations (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'cancelled', 'suppressed')),
  attempts smallint not null default 0,
  max_attempts smallint not null default 5,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  provider text,
  provider_message_id text,
  last_error text check (last_error is null or length(last_error) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists email_outbox_due on public.email_outbox (next_attempt_at) where status in ('queued', 'sending');
create index if not exists email_outbox_status on public.email_outbox (status, created_at desc);
alter table public.email_outbox enable row level security;
drop policy if exists email_outbox_admin_read on public.email_outbox;
create policy email_outbox_admin_read on public.email_outbox for select to authenticated using (public.is_super_admin());
grant select on public.email_outbox to authenticated;

-- Demo/test identities never receive real email.
create or replace function public.email_is_suppressed(p_email text)
returns boolean language sql immutable set search_path = '' as $$
  select p_email is null or p_email = '' or p_email ~* '\.(test|example|invalid|localhost)$' or p_email ~* '@(example\.(com|org|net))$';
$$;

-- Notification kinds that are also emailed (company_invitation has its own template).
create or replace function public.email_kind_enabled(p_kind text)
returns boolean language sql immutable set search_path = '' as $$
  select p_kind = any (array['application_status', 'application_submitted', 'assessment_assigned', 'assessment_feedback',
    'interview_scheduled', 'interview_changed', 'interview_assigned', 'interview_reminder', 'interview_feedback',
    'interview_attachment', 'final_feedback', 'evaluation_reminder', 'access_approved', 'access_rejected', 'access_request',
    'company_review']);
$$;

create or replace function public.enqueue_notification_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_p public.profiles; v_enabled boolean; v_status text;
begin
  if not public.email_kind_enabled(new.kind) then return new; end if;
  select * into v_p from public.profiles where id = new.user_id;
  if v_p.id is null then return new; end if;
  select coalesce(np.email_enabled, true) into v_enabled from public.notification_preferences np where np.user_id = new.user_id;
  if v_enabled is false then
    update public.notifications set email_status = 'disabled' where id = new.id;
    return new;
  end if;
  v_status := case when v_p.is_demo or public.email_is_suppressed(v_p.email) then 'suppressed' else 'queued' end;
  insert into public.email_outbox (idempotency_key, template, recipient_user, recipient_email, locale, payload, notification_id, status)
  values ('notification:' || new.id, 'notification', new.user_id,
          case when v_p.email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_p.email else 'suppressed@invalid.invalid' end,
          v_p.locale,
          jsonb_build_object('kind', new.kind, 'title_en', new.title_en, 'title_ar', new.title_ar,
                             'body_en', new.body_en, 'body_ar', new.body_ar, 'link', new.link),
          new.id, v_status)
  on conflict (idempotency_key) do nothing;
  update public.notifications set email_status = case v_status when 'queued' then 'queued' else 'disabled' end where id = new.id;
  return new;
end $$;
drop trigger if exists notifications_enqueue_email on public.notifications;
create trigger notifications_enqueue_email after insert on public.notifications
  for each row execute function public.enqueue_notification_email();

-- Invitation email (one per send; resend adds a new numbered key).
create or replace function public._enqueue_invitation_email(p_invitation uuid, p_seq int)
returns void language plpgsql security definer set search_path = '' as $$
declare v_inv public.company_invitations; v_c public.company_profiles; v_inviter text; v_locale text;
begin
  select * into v_inv from public.company_invitations where id = p_invitation;
  select * into v_c from public.company_profiles where id = v_inv.company_id;
  select full_name into v_inviter from public.profiles where id = v_inv.invited_by;
  select locale into v_locale from public.profiles where lower(email) = lower(v_inv.email) limit 1;
  insert into public.email_outbox (idempotency_key, template, recipient_email, locale, payload, invitation_id, status)
  values ('invitation:' || v_inv.id || ':' || p_seq, 'company_invitation', v_inv.email, coalesce(v_locale, 'ar'),
          jsonb_build_object('company_en', v_c.name_en, 'company_ar', v_c.name_ar, 'role', v_inv.role,
                             'token', v_inv.token, 'expires_at', v_inv.expires_at, 'inviter', coalesce(v_inviter, '')),
          v_inv.id, case when public.email_is_suppressed(v_inv.email) then 'suppressed' else 'queued' end)
  on conflict (idempotency_key) do nothing;
end $$;

create or replace function public.company_invitations_enqueue()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public._enqueue_invitation_email(new.id, 0);
  return new;
end $$;
drop trigger if exists company_invitations_enqueue on public.company_invitations;
create trigger company_invitations_enqueue after insert on public.company_invitations
  for each row execute function public.company_invitations_enqueue();

create or replace function public.invite_company_member(p_company uuid, p_email text, p_role public.membership_role)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user uuid; v_email text := lower(trim(p_email));
begin
  if not public.has_company_role(p_company, array['company_admin']::public.membership_role[]) then
    raise exception 'only company admins can invite members' using errcode = '42501';
  end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email' using errcode = 'P0001'; end if;
  if exists (select 1 from public.company_memberships m join public.profiles p on p.id = m.user_id
             where m.company_id = p_company and m.status = 'active' and lower(p.email) = v_email) then
    raise exception 'this person is already a member of the team' using errcode = 'P0001';
  end if;
  -- A stale pending invitation must not block a new one.
  update public.company_invitations set status = 'expired'
   where company_id = p_company and lower(email) = v_email and status = 'pending' and expires_at < now();
  insert into public.company_invitations (company_id, email, role, invited_by)
  values (p_company, v_email, p_role, auth.uid()) returning id into v_id;
  select id into v_user from public.profiles where lower(email) = v_email;
  if v_user is not null then
    perform public.notify(v_user, 'company_invitation', 'You were invited to join a company team', 'تمت دعوتك للانضمام إلى فريق شركة',
      null, null, '/invitations');
  end if;
  perform public.write_audit('membership.invited', 'company', p_company, p_company, jsonb_build_object('email', v_email, 'role', p_role));
  return v_id;
end $$;

-- Shared acceptance rules. Only the invited, confirmed email can accept; invitations never demote an admin.
create or replace function public._accept_invitation(v_inv public.company_invitations)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_email text; v_confirmed timestamptz; v_existing public.company_memberships;
begin
  select u.email, u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = auth.uid();
  if v_inv.id is null then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  if v_inv.status = 'revoked' then raise exception 'this invitation was revoked' using errcode = 'P0001'; end if;
  if v_inv.status = 'accepted' then raise exception 'this invitation was already used' using errcode = 'P0001'; end if;
  if v_inv.status = 'expired' or v_inv.expires_at < now() then raise exception 'this invitation has expired' using errcode = 'P0001'; end if;
  if v_email is null or lower(v_inv.email) <> lower(v_email) then
    raise exception 'this invitation was sent to a different email address' using errcode = '42501';
  end if;
  if v_confirmed is null then raise exception 'confirm your email address first' using errcode = 'P0001'; end if;
  select * into v_existing from public.company_memberships where company_id = v_inv.company_id and user_id = auth.uid() for update;
  insert into public.company_memberships (company_id, user_id, role, invited_by)
  values (v_inv.company_id, auth.uid(), v_inv.role, v_inv.invited_by)
  on conflict (company_id, user_id) do update
    set role = case when public.company_memberships.status = 'active' and public.company_memberships.role = 'company_admin'
                    then 'company_admin'::public.membership_role else excluded.role end,
        status = 'active';
  update public.company_invitations set status = 'accepted', accepted_at = now() where id = v_inv.id;
  update public.email_outbox set status = 'cancelled', updated_at = now() where invitation_id = v_inv.id and status = 'queued';
  update public.profiles set onboarding_completed = true where id = auth.uid() and account_type = 'company';
  perform public.write_audit('membership.accepted', 'company', v_inv.company_id, v_inv.company_id, jsonb_build_object('invitation', v_inv.id));
  return v_inv.company_id;
end $$;

create or replace function public.accept_company_invitation(p_invitation uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.company_invitations;
begin
  select * into v_inv from public.company_invitations where id = p_invitation for update;
  return public._accept_invitation(v_inv);
end $$;

create or replace function public.accept_company_invitation_by_token(p_token uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.company_invitations;
begin
  select * into v_inv from public.company_invitations where token = p_token for update;
  return public._accept_invitation(v_inv);
end $$;

-- What the invitation link page may show (only with the secret token): company, role, state, masked email.
create or replace function public.invitation_preview(p_token uuid)
returns table (company_name_en text, company_name_ar text, role public.membership_role, state text, email_masked text, for_current_user boolean, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.name_en, c.name_ar, i.role,
    case when i.status = 'pending' and i.expires_at < now() then 'expired' else i.status end,
    left(split_part(i.email, '@', 1), 2) || '•••@' || split_part(i.email, '@', 2),
    lower(i.email) = lower(coalesce((select u.email from auth.users u where u.id = auth.uid()), '')),
    i.expires_at
  from public.company_invitations i join public.company_profiles c on c.id = i.company_id
  where i.token = p_token and auth.uid() is not null;
$$;

create or replace function public.revoke_company_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_inv public.company_invitations;
begin
  select * into v_inv from public.company_invitations where id = p_invitation for update;
  if v_inv.id is null or not public.has_company_role(v_inv.company_id, array['company_admin']::public.membership_role[]) then
    raise exception 'only company admins can manage invitations' using errcode = '42501';
  end if;
  if v_inv.status <> 'pending' then raise exception 'only pending invitations can be revoked' using errcode = 'P0001'; end if;
  update public.company_invitations set status = 'revoked' where id = p_invitation;
  update public.email_outbox set status = 'cancelled', updated_at = now() where invitation_id = p_invitation and status in ('queued', 'failed');
  perform public.write_audit('membership.invitation_revoked', 'company', v_inv.company_id, v_inv.company_id, jsonb_build_object('invitation', p_invitation));
end $$;

create or replace function public.resend_company_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_inv public.company_invitations; v_n int; v_last timestamptz;
begin
  select * into v_inv from public.company_invitations where id = p_invitation for update;
  if v_inv.id is null or not public.has_company_role(v_inv.company_id, array['company_admin']::public.membership_role[]) then
    raise exception 'only company admins can manage invitations' using errcode = '42501';
  end if;
  if v_inv.status <> 'pending' or v_inv.expires_at < now() then raise exception 'this invitation is no longer pending' using errcode = 'P0001'; end if;
  select count(*), max(created_at) into v_n, v_last from public.email_outbox where invitation_id = p_invitation;
  if v_n >= 4 then raise exception 'this invitation was already sent several times' using errcode = 'P0001'; end if;
  if v_last > now() - interval '5 minutes' then raise exception 'please wait a few minutes before sending again' using errcode = 'P0001'; end if;
  perform public._enqueue_invitation_email(p_invitation, v_n);
  perform public.write_audit('membership.invitation_resent', 'company', v_inv.company_id, v_inv.company_id, jsonb_build_object('invitation', p_invitation));
end $$;

-- Delivery state of each pending invitation for its company admins (no recipient data beyond what they typed).
create or replace function public.company_invitation_delivery(p_company uuid)
returns table (invitation_id uuid, status text, attempts smallint, last_attempt timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_company_role(p_company, array['company_admin']::public.membership_role[]) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select distinct on (o.invitation_id) o.invitation_id, o.status, o.attempts, o.updated_at
      from public.email_outbox o join public.company_invitations i on i.id = o.invitation_id
     where i.company_id = p_company
     order by o.invitation_id, o.created_at desc;
end $$;

-- Worker: claim due emails (skip-locked lease, crash-safe), then report each result once.
create or replace function public.internal_claim_emails(p_service_key text, p_limit integer default 20)
returns setof public.email_outbox language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_service(p_service_key);
  -- Invitations that are no longer pending are never delivered.
  update public.email_outbox o set status = 'cancelled', updated_at = now()
   where o.status in ('queued', 'sending') and o.invitation_id is not null
     and not exists (select 1 from public.company_invitations i where i.id = o.invitation_id and i.status = 'pending' and i.expires_at > now());
  -- A lease that expired after the last allowed attempt is a permanent failure.
  update public.email_outbox set status = 'failed', locked_until = null, updated_at = now(), last_error = coalesce(last_error, 'lease_expired')
   where status = 'sending' and locked_until < now() and attempts >= max_attempts;
  return query
    with due as (
      select o.id from public.email_outbox o
       where (o.status = 'queued' and o.next_attempt_at <= now())
          or (o.status = 'sending' and o.locked_until < now() and o.attempts < o.max_attempts)
       order by o.next_attempt_at
       limit least(greatest(coalesce(p_limit, 20), 1), 50)
       for update skip locked)
    update public.email_outbox o set status = 'sending', locked_until = now() + interval '2 minutes',
           attempts = o.attempts + 1, updated_at = now()
      from due where o.id = due.id
    returning o.*;
end $$;

create or replace function public.internal_complete_email(
  p_service_key text, p_id uuid, p_ok boolean, p_provider text, p_message_id text, p_error text, p_retryable boolean
) returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_o public.email_outbox; v_status text;
begin
  perform private.require_service(p_service_key);
  select * into v_o from public.email_outbox where id = p_id for update;
  if v_o.id is null or v_o.status <> 'sending' then return 'ignored'; end if;
  if p_ok then
    v_status := 'sent';
    update public.email_outbox set status = 'sent', sent_at = now(), locked_until = null, provider = left(p_provider, 40),
           provider_message_id = left(p_message_id, 200), last_error = null, updated_at = now() where id = p_id;
  elsif coalesce(p_retryable, false) and v_o.attempts < v_o.max_attempts then
    v_status := 'queued';
    update public.email_outbox set status = 'queued', locked_until = null, provider = left(p_provider, 40),
           next_attempt_at = now() + make_interval(mins => least(60, (2 ^ v_o.attempts)::int)),
           last_error = left(p_error, 200), updated_at = now() where id = p_id;
  else
    v_status := 'failed';
    update public.email_outbox set status = 'failed', locked_until = null, provider = left(p_provider, 40),
           last_error = left(p_error, 200), updated_at = now() where id = p_id;
  end if;
  if v_o.notification_id is not null and v_status in ('sent', 'failed') then
    update public.notifications set email_status = v_status where id = v_o.notification_id;
  end if;
  return v_status;
end $$;

-- Super Admin: requeue a failed email (new attempt budget, same idempotency key → never a second row).
create or replace function public.admin_retry_email(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'super admin only' using errcode = '42501'; end if;
  update public.email_outbox set status = 'queued', attempts = 0, next_attempt_at = now(), last_error = null, updated_at = now()
   where id = p_id and status = 'failed';
  perform public.write_audit('email.retried', 'email', p_id, null, '{}');
end $$;

-- ============================================================== 6. Daily.co webhooks
alter table public.interviews add column if not exists video_started_at timestamptz;
alter table public.interviews add column if not exists video_ended_at timestamptz;
alter table public.interview_attendance add column if not exists source text not null default 'client' check (source in ('client', 'webhook'));
alter table public.interview_attendance add column if not exists daily_session_id text check (daily_session_id is null or length(daily_session_id) <= 100);
create unique index if not exists interview_attendance_daily_session on public.interview_attendance (daily_session_id) where daily_session_id is not null;

create table if not exists public.video_webhook_events (
  dedupe_key text primary key check (length(dedupe_key) <= 200),
  event_id text,
  event_type text not null check (length(event_type) <= 60),
  room_name text,
  interview_id uuid references public.interviews (id) on delete set null,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  outcome text
);
create index if not exists video_webhook_events_interview on public.video_webhook_events (interview_id, occurred_at);
alter table public.video_webhook_events enable row level security;
drop policy if exists video_webhook_events_read on public.video_webhook_events;
create policy video_webhook_events_read on public.video_webhook_events for select to authenticated
  using (public.is_super_admin() or (interview_id is not null and exists (
    select 1 from public.interviews i where i.id = interview_id and public.can_recruit(i.company_id))));
grant select on public.video_webhook_events to authenticated;

-- Called by the Next.js webhook route only AFTER it verified Daily's HMAC signature.
-- Idempotent: participant events dedupe on type + session (Daily may resend with a new id), others on id.
-- Out-of-order safe: start = earliest seen, end = latest seen, join/leave merge per session.
create or replace function public.internal_ingest_daily_event(
  p_service_key text, p_event_id text, p_type text, p_occurred_at timestamptz, p_room text,
  p_session_id text, p_user_id text, p_joined_at timestamptz, p_duration_seconds numeric
) returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_key text; v_i public.interviews; v_user uuid; v_role text; v_outcome text; v_joined timestamptz;
begin
  perform private.require_service(p_service_key);
  if p_type is null or length(p_type) > 60 or p_occurred_at is null then raise exception 'invalid event' using errcode = '22023'; end if;
  v_key := case when p_type in ('participant.joined', 'participant.left') and p_session_id is not null
                then p_type || ':' || left(p_session_id, 100) else coalesce(left(p_event_id, 150), p_type || ':' || p_occurred_at) end;
  insert into public.video_webhook_events (dedupe_key, event_id, event_type, room_name, occurred_at)
  values (v_key, left(p_event_id, 150), p_type, left(p_room, 100), p_occurred_at)
  on conflict (dedupe_key) do nothing;
  if not found then return 'duplicate'; end if;

  select * into v_i from public.interviews where video_room_name = p_room;
  if v_i.id is null then
    update public.video_webhook_events set outcome = 'unknown_room' where dedupe_key = v_key;
    return 'unknown_room';
  end if;

  if p_type = 'meeting.started' then
    update public.interviews set video_started_at = least(coalesce(video_started_at, p_occurred_at), p_occurred_at) where id = v_i.id;
    v_outcome := 'meeting_started';
  elsif p_type = 'meeting.ended' then
    update public.interviews set video_ended_at = greatest(coalesce(video_ended_at, p_occurred_at), p_occurred_at) where id = v_i.id;
    v_outcome := 'meeting_ended';
  elsif p_type in ('participant.joined', 'participant.left') then
    -- Only identities we minted tokens for (user_id = our profile id) and who belong to the interview count.
    v_user := case when p_user_id ~ '^[0-9a-fA-F-]{36}$' then p_user_id::uuid end;
    select case when a.candidate_id = v_user then 'candidate'
                when exists (select 1 from public.interview_participants ip where ip.interview_id = v_i.id and ip.user_id = v_user) then 'interviewer' end
      into v_role from public.applications a where a.id = v_i.application_id;
    if v_user is null or v_role is null or p_session_id is null then
      v_outcome := 'unknown_participant';
    else
      v_joined := coalesce(p_joined_at,
        case when p_type = 'participant.left' and p_duration_seconds is not null then p_occurred_at - make_interval(secs => p_duration_seconds::double precision) end,
        p_occurred_at);
      insert into public.interview_attendance (interview_id, user_id, role, joined_at, left_at, source, daily_session_id)
      values (v_i.id, v_user, v_role, v_joined, case when p_type = 'participant.left' then p_occurred_at end, 'webhook', left(p_session_id, 100))
      on conflict (daily_session_id) where daily_session_id is not null do update
        set joined_at = least(public.interview_attendance.joined_at, excluded.joined_at),
            left_at = case when excluded.left_at is null then public.interview_attendance.left_at
                           else greatest(coalesce(public.interview_attendance.left_at, excluded.left_at), excluded.left_at) end;
      v_outcome := replace(p_type, 'participant.', 'participant_');
    end if;
  else
    v_outcome := 'ignored';
  end if;
  update public.video_webhook_events set outcome = v_outcome, interview_id = v_i.id where dedupe_key = v_key;
  return v_outcome;
end $$;

-- ============================================================== 7. health ping + housekeeping
create or replace function public.health_ping()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('ok', true, 'schema', '0029', 'at', now());
$$;

create or replace function public.housekeeping_platform()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from private.rate_limits where window_start < now() - interval '1 day';
  delete from private.ai_cooldowns where until < now() - interval '1 day';
  update public.company_invitations set status = 'expired' where status = 'pending' and expires_at < now();
  delete from public.video_webhook_events where received_at < now() - interval '90 days';
end $$;
select cron.schedule('jadarah-platform-housekeeping', '17 * * * *', $cron$select public.housekeeping_platform()$cron$);

-- ============================================================== grants
-- Server-only RPCs: callable by the app's API roles but useless without the server key.
revoke all on function public.internal_rate_limit(text, text, integer, integer) from public;
revoke all on function public.internal_ai_cooldowns(text) from public;
revoke all on function public.internal_ai_cooldown_note(text, text, integer, text) from public;
revoke all on function public.internal_claim_emails(text, integer) from public;
revoke all on function public.internal_complete_email(text, uuid, boolean, text, text, text, boolean) from public;
revoke all on function public.internal_ingest_daily_event(text, text, text, timestamptz, text, text, text, timestamptz, numeric) from public;
grant execute on function public.internal_rate_limit(text, text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.internal_ai_cooldowns(text) to anon, authenticated, service_role;
grant execute on function public.internal_ai_cooldown_note(text, text, integer, text) to anon, authenticated, service_role;
grant execute on function public.internal_claim_emails(text, integer) to anon, authenticated, service_role;
grant execute on function public.internal_complete_email(text, uuid, boolean, text, text, text, boolean) to anon, authenticated, service_role;
grant execute on function public.internal_ingest_daily_event(text, text, text, timestamptz, text, text, text, timestamptz, numeric) to anon, authenticated, service_role;

-- Signed-in RPCs (each re-checks authorization).
do $$ declare f text; begin
  foreach f in array array[
    'public.register_assessment_file(uuid, uuid, text, text, text, bigint)',
    'public.remove_assessment_file(uuid)',
    'public.register_interview_attachment(uuid, text, text, text, bigint, boolean)',
    'public.set_interview_attachment_shared(uuid, boolean)',
    'public.remove_interview_attachment(uuid)',
    'public.interview_access_role(uuid)',
    'public.can_review_submission(uuid)',
    'public.can_delete_storage_object(text, text, boolean)',
    'public.accept_company_invitation_by_token(uuid)',
    'public.invitation_preview(uuid)',
    'public.revoke_company_invitation(uuid)',
    'public.resend_company_invitation(uuid)',
    'public.company_invitation_delivery(uuid)',
    'public.admin_retry_email(uuid)',
    'public.assessment_file_mime_ok(text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- Health ping is public (no data).
revoke all on function public.health_ping() from public;
grant execute on function public.health_ping() to anon, authenticated, service_role;

-- Internal helpers and trigger functions are never callable through the API.
do $$ declare f text; begin
  foreach f in array array[
    'public.enqueue_notification_email()', 'public.company_invitations_enqueue()',
    'public._enqueue_invitation_email(uuid, integer)', 'public._accept_invitation(public.company_invitations)',
    'public.housekeeping_platform()', 'public.email_is_suppressed(text)', 'public.email_kind_enabled(text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
revoke all on all functions in schema private from public, anon, authenticated;
