-- 0032 · Task Solution Files (ملفات حل المهمة)
-- Candidates attach the files that contain their completed solution to the whole practical-task submission, not only
-- to individual `file_upload` questions. Builds on 0029 (bucket `assessment-attachments`, table
-- `assessment_answer_files`, storage policies). Additive and non-destructive: existing rows keep kind = 'answer'.
--
-- Object path for solution files: <candidate uid>/<submission id>/solution/<file name>
-- Rollback (only if no solution files exist yet):
--   delete from public.assessment_answer_files where kind = 'solution';
--   alter table public.assessment_answer_files drop constraint assessment_answer_files_kind_question;
--   alter table public.assessment_answer_files drop column kind; alter table ... alter column question_id set not null;
--   drop function public.register_task_solution_file(uuid, text, text, text, bigint);
--   then re-run the 0029 definitions of can_write_storage_object and assessment_file_mime_ok.

-- 1. Word 97–2003 documents (.doc) are accepted alongside the 0029 types.
update storage.buckets set
  allowed_mime_types = array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/zip', 'text/plain', 'text/csv',
    'application/json', 'application/vnd.ms-excel', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation']
where id = 'assessment-attachments';

create or replace function public.assessment_file_mime_ok(p_mime text)
returns boolean language sql immutable set search_path = '' as $$
  select p_mime = any (array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/zip', 'text/plain', 'text/csv',
    'application/json', 'application/vnd.ms-excel', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation']);
$$;

-- 2. Solution files live in the same table, without a question.
alter table public.assessment_answer_files
  add column if not exists kind text not null default 'answer' check (kind in ('answer', 'solution'));
alter table public.assessment_answer_files alter column question_id drop not null;
alter table public.assessment_answer_files drop constraint if exists assessment_answer_files_kind_question;
alter table public.assessment_answer_files add constraint assessment_answer_files_kind_question
  check ((kind = 'solution') = (question_id is null));
create index if not exists assessment_answer_files_solution on public.assessment_answer_files (submission_id) where kind = 'solution';

-- 3. Candidate registers an uploaded solution file on their in-progress submission.
create or replace function public.register_task_solution_file(
  p_assignment uuid, p_path text, p_name text, p_mime text, p_size bigint
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_sub public.assessment_submissions; v_minutes int; v_obj_size bigint; v_obj_mime text; v_found boolean; v_id uuid;
begin
  select s.* into v_sub from public.assessment_submissions s where s.assignment_id = p_assignment for update;
  if v_sub.id is null or v_sub.candidate_id is distinct from auth.uid() then raise exception 'attempt not found' using errcode = '42501'; end if;
  if v_sub.status <> 'in_progress' then raise exception 'this assessment has already been submitted' using errcode = 'P0001'; end if;
  select a.duration_minutes into v_minutes from public.assessments a
    join public.assessment_assignments aa on aa.assessment_id = a.id where aa.id = p_assignment;
  if now() > v_sub.started_at + make_interval(mins => v_minutes + 2) then raise exception 'time is up for this assessment' using errcode = 'P0001'; end if;
  if p_path is null or p_path !~ ('^' || auth.uid()::text || '/' || v_sub.id::text || '/solution/[A-Za-z0-9][A-Za-z0-9._-]{0,150}$') then
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
  if (select count(*) from public.assessment_answer_files f where f.submission_id = v_sub.id and f.kind = 'solution') >= 10 then
    raise exception 'you can attach up to 10 solution files' using errcode = 'P0001';
  end if;
  insert into public.assessment_answer_files (submission_id, question_id, candidate_id, storage_path, file_name, mime_type, size_bytes, kind)
  values (v_sub.id, null, auth.uid(), p_path, left(trim(coalesce(nullif(p_name, ''), 'file')), 200), p_mime, p_size, 'solution')
  on conflict (storage_path) do nothing
  returning id into v_id;
  if v_id is null then select id into v_id from public.assessment_answer_files where storage_path = p_path; end if;
  return v_id;
end $$;
revoke all on function public.register_task_solution_file(uuid, text, text, text, bigint) from public, anon;
grant execute on function public.register_task_solution_file(uuid, text, text, text, bigint) to authenticated;

-- 4. Storage writes: 0029's rule plus the submission's solution folder (same owner + in-progress checks).
create or replace function public.can_write_storage_object(p_bucket text, p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_first text := split_part(p_name, '/', 1); v_second text := split_part(p_name, '/', 2); v_third text := split_part(p_name, '/', 3);
begin
  if auth.uid() is null or not public.is_active_user() then return false; end if;
  if p_bucket in ('candidate-cvs', 'candidate-certificates', 'candidate-projects') then
    return v_first = auth.uid()::text;
  elsif p_bucket = 'assessment-attachments' then
    if v_first <> auth.uid()::text or array_length(string_to_array(p_name, '/'), 1) <> 4 then return false; end if;
    if v_third = 'solution' then
      -- Task solution files: only into the caller's own in-progress submission.
      return exists (select 1 from public.assessment_submissions s
                     where s.id::text = v_second and s.candidate_id = auth.uid() and s.status = 'in_progress');
    end if;
    -- Only into an in-progress submission of the caller, for a file_upload question of that assessment.
    return exists (
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
