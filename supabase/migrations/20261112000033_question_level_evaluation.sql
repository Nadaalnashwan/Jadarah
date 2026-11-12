-- 0033 · Question-level task evaluation
-- Every answer, file and evaluation is tied to the exact question it belongs to (stable ids, never order or names).
--
-- Root causes fixed here (see docs/EVALUATION.md):
--   1. Files could only be attached to `file_upload` questions, so practical tasks (stored as coding / case_study / sql /
--      long_answer questions) collected their files as submission-level "solution" files with no question.
--   2. The practical-task builder attached ONE assessment-wide rubric to every question (31 of 37 AI-built questions in
--      production), so each question was shown — and AI-scored against — every other question's criteria.
--   3. The total added every human evaluation to the automatic score, so a human review of an auto-graded question
--      was counted twice; scores are now recomputed per question.
--   4. AI suggestions were not kept: nothing distinguished AI-suggested from human-approved scores, and re-scoring
--      overwrote the previous evaluation without history.
--
-- Additive and non-destructive: no rows are deleted. Shared rubrics are kept (new question rubrics record
-- `derived_from`); existing evaluations keep their rubric scores (criterion keys are unchanged) and are copied into the
-- new history table as a baseline. Existing solution files (question_id null) stay readable and are shown separately
-- as "not linked to a question"; they are never evaluated as an answer to any question.

-- ============================================================== 1. files for every open question
create or replace function public.question_accepts_files(p_type public.question_type)
returns boolean language sql immutable set search_path = '' as $$
  select p_type::text not in ('multiple_choice', 'true_false', 'multiple_select');
$$;

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
  if not public.question_accepts_files(v_q.type) then raise exception 'this question does not accept files' using errcode = 'P0001'; end if;
  if p_path is null or p_path !~ ('^' || auth.uid()::text || '/' || v_sub.id::text || '/' || p_question::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,150}$') then
    raise exception 'invalid file path' using errcode = 'P0001';
  end if;
  select true, (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype' into v_found, v_obj_size, v_obj_mime
    from storage.objects o where o.bucket_id = 'assessment-attachments' and o.name = p_path;
  if v_found is null then raise exception 'uploaded file not found' using errcode = 'P0002'; end if;
  p_size := coalesce(v_obj_size, p_size);
  p_mime := coalesce(v_obj_mime, p_mime);
  if not public.assessment_file_mime_ok(p_mime) then raise exception 'file type is not allowed' using errcode = 'P0001'; end if;
  if p_size is null or p_size < 1 or p_size > 20971520 then raise exception 'file is too large' using errcode = 'P0001'; end if;
  if (select count(*) from public.assessment_answer_files f where f.submission_id = v_sub.id and f.question_id = p_question) >= 5 then
    raise exception 'you can attach up to 5 files' using errcode = 'P0001';
  end if;
  insert into public.assessment_answer_files (submission_id, question_id, candidate_id, storage_path, file_name, mime_type, size_bytes, kind)
  values (v_sub.id, p_question, auth.uid(), p_path, left(trim(coalesce(nullif(p_name, ''), 'file')), 200), p_mime, p_size, 'answer')
  on conflict (storage_path) do nothing
  returning id into v_id;
  if v_id is null then select id into v_id from public.assessment_answer_files where storage_path = p_path; end if;
  insert into public.assessment_answers (submission_id, question_id, file_path) values (v_sub.id, p_question, p_path)
  on conflict (submission_id, question_id) do update
    set file_path = coalesce(public.assessment_answers.file_path, excluded.file_path);
  return v_id;
end $$;

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
      -- Submission-level solution files (0032): only into the caller's own in-progress submission.
      return exists (select 1 from public.assessment_submissions s
                     where s.id::text = v_second and s.candidate_id = auth.uid() and s.status = 'in_progress');
    end if;
    -- Question files: only into an in-progress submission of the caller, for an open question of that assessment.
    return exists (
      select 1 from public.assessment_submissions s
      join public.assessment_assignments aa on aa.id = s.assignment_id
      join public.assessment_questions q on q.assessment_id = aa.assessment_id and public.question_accepts_files(q.type)
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

-- ============================================================== 2. question-scoped rubrics
-- question_id deliberately has no foreign key: a second rubrics↔questions relationship would make every PostgREST embed
-- `assessment_questions → assessment_rubrics` ambiguous (see 0025's embed fix). The question's rubric_id stays the link.
alter table public.assessment_rubrics add column if not exists question_id uuid;
alter table public.assessment_rubrics add column if not exists derived_from uuid references public.assessment_rubrics (id) on delete set null;
create index if not exists assessment_rubrics_question on public.assessment_rubrics (question_id) where question_id is not null;

-- Splits an assessment-wide rubric shared by several questions into one rubric per question, using the builder's own
-- criterion → task mapping (assessor guide `rubric[].task_refs`, task index = question position). A criterion that
-- covers several tasks is shared out evenly. Assessments without that mapping are left unchanged (the evaluator then
-- labels the rubric "assessment-wide"). Idempotent: questions that already have their own rubric are skipped.
-- Tasks already given to candidates are locked by 0025 (lock_assigned_task_content) and are NOT changed: for those the
-- application applies the same task mapping read-only when it evaluates (src/lib/domain/question-evaluation.ts).
create or replace function public.split_shared_task_rubrics(p_assessment uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; v_guide jsonb; v_q record; v_criteria jsonb; v_new uuid; v_n int := 0; v_count int; v_distinct int; v_maxpos int;
begin
  for r in
    select q.rubric_id, q.assessment_id from public.assessment_questions q
     where q.rubric_id is not null and (p_assessment is null or q.assessment_id = p_assessment)
     group by q.rubric_id, q.assessment_id having count(*) > 1
  loop
    if public.assessment_is_in_use(r.assessment_id) then continue; end if; -- locked content (0025); mapped read-only instead
    select g.guide -> 'rubric' into v_guide from public.assessment_assessor_guides g where g.assessment_id = r.assessment_id;
    if v_guide is null or jsonb_typeof(v_guide) <> 'array' or jsonb_array_length(v_guide) = 0 then continue; end if;
    if exists (select 1 from jsonb_array_elements(v_guide) c where jsonb_typeof(c -> 'task_refs') is distinct from 'array') then continue; end if;
    select count(*), count(distinct position), max(position) into v_count, v_distinct, v_maxpos
      from public.assessment_questions where assessment_id = r.assessment_id;
    if v_distinct <> v_count or v_maxpos <> v_count - 1 then continue; end if; -- positions are not task indexes
    for v_q in select q.id, q.position from public.assessment_questions q where q.rubric_id = r.rubric_id order by q.position loop
      select coalesce(jsonb_agg(rc || jsonb_build_object('max_points',
               round((rc ->> 'max_points')::numeric / greatest(jsonb_array_length(gc -> 'task_refs'), 1), 2)) order by x.ord), '[]')
        into v_criteria
        from public.assessment_rubrics rb,
             jsonb_array_elements(rb.criteria) with ordinality as x(rc, ord)
        join jsonb_array_elements(v_guide) gc on gc ->> 'key' = rc ->> 'key'
       where rb.id = r.rubric_id and gc -> 'task_refs' @> to_jsonb(v_q.position::int);
      if jsonb_array_length(v_criteria) = 0 then
        update public.assessment_questions set rubric_id = null where id = v_q.id; -- no criterion was written for this task
      else
        insert into public.assessment_rubrics (assessment_id, title_en, title_ar, criteria, question_id, derived_from)
        select r.assessment_id, left(rb.title_en, 180) || ' · Q' || (v_q.position + 1), left(rb.title_ar, 180) || ' · س' || (v_q.position + 1),
               v_criteria, v_q.id, r.rubric_id
          from public.assessment_rubrics rb where rb.id = r.rubric_id
        returning id into v_new;
        update public.assessment_questions set rubric_id = v_new where id = v_q.id;
      end if;
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $$;
revoke all on function public.split_shared_task_rubrics(uuid) from public, anon, authenticated;
select public.split_shared_task_rubrics();

-- ============================================================== 3. AI evaluations (append-only, recruiter-only)
create table if not exists public.assessment_ai_evaluations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assessment_submissions (id) on delete cascade,
  question_id uuid not null references public.assessment_questions (id) on delete cascade,
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  -- completed: evaluated; no_submission: nothing was submitted for the question; extraction_failed: files could not be read
  status text not null check (status in ('completed', 'no_submission', 'extraction_failed')),
  -- employer_question: the question's own rubric; employer_shared: an assessment-wide rubric applied to this question;
  -- ai_derived: criteria derived by AI from the question (suggestion, needs human approval)
  rubric_source text not null check (rubric_source in ('employer_question', 'employer_shared', 'ai_derived', 'none')),
  criteria jsonb not null default '[]' check (jsonb_typeof(criteria) = 'array'),
  requirements jsonb not null default '[]' check (jsonb_typeof(requirements) = 'array'),
  strengths jsonb not null default '[]' check (jsonb_typeof(strengths) = 'array'),
  issues jsonb not null default '[]' check (jsonb_typeof(issues) = 'array'),
  improvements jsonb not null default '[]' check (jsonb_typeof(improvements) = 'array'),
  concerns jsonb not null default '[]' check (jsonb_typeof(concerns) = 'array'),
  files jsonb not null default '[]' check (jsonb_typeof(files) = 'array'),
  answer_present boolean not null default false,
  score numeric(6, 2),
  max_score numeric(6, 2) not null,
  explanation text check (explanation is null or char_length(explanation) <= 2000),
  provider text check (provider is null or char_length(provider) <= 40),
  model text check (model is null or char_length(model) <= 80),
  input_sha256 text check (input_sha256 is null or input_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  check (score is null or (score >= 0 and score <= max_score)),
  check (pg_column_size(criteria) + pg_column_size(requirements) + pg_column_size(files) + pg_column_size(strengths)
         + pg_column_size(issues) + pg_column_size(improvements) + pg_column_size(concerns) < 262144)
);
create index if not exists assessment_ai_evaluations_q on public.assessment_ai_evaluations (submission_id, question_id, created_at desc);
alter table public.assessment_ai_evaluations enable row level security;
drop policy if exists assessment_ai_evaluations_read on public.assessment_ai_evaluations;
create policy assessment_ai_evaluations_read on public.assessment_ai_evaluations for select to authenticated
  using (public.is_super_admin() or public.can_recruit(company_id));
grant select on public.assessment_ai_evaluations to authenticated;

create or replace function public.record_ai_question_evaluation(p_submission uuid, p_question uuid, p_result jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_sub public.assessment_submissions; v_as public.assessment_assignments; v_q public.assessment_questions; v_id uuid; v_score numeric;
begin
  select * into v_sub from public.assessment_submissions where id = p_submission;
  select * into v_as from public.assessment_assignments where id = v_sub.assignment_id;
  if v_sub.id is null or v_as.company_id is null or not public.can_recruit(v_as.company_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_sub.status = 'in_progress' then raise exception 'submission is not complete yet' using errcode = 'P0001'; end if;
  select * into v_q from public.assessment_questions where id = p_question and assessment_id = v_as.assessment_id;
  if v_q.id is null then raise exception 'question not found' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_result) is distinct from 'object' then raise exception 'invalid evaluation' using errcode = '22023'; end if;
  v_score := nullif(p_result ->> 'score', '')::numeric;
  if v_score is not null and (v_score < 0 or v_score > v_q.points) then raise exception 'score must be between 0 and %', v_q.points using errcode = 'P0001'; end if;
  insert into public.assessment_ai_evaluations (submission_id, question_id, company_id, requested_by, status, rubric_source, criteria,
    requirements, strengths, issues, improvements, concerns, files, answer_present, score, max_score, explanation, provider, model, input_sha256)
  values (p_submission, p_question, v_as.company_id, auth.uid(), p_result ->> 'status', coalesce(p_result ->> 'rubric_source', 'none'),
    coalesce(p_result -> 'criteria', '[]'), coalesce(p_result -> 'requirements', '[]'), coalesce(p_result -> 'strengths', '[]'),
    coalesce(p_result -> 'issues', '[]'), coalesce(p_result -> 'improvements', '[]'), coalesce(p_result -> 'concerns', '[]'),
    coalesce(p_result -> 'files', '[]'), coalesce((p_result ->> 'answer_present')::boolean, false), v_score, v_q.points,
    left(p_result ->> 'explanation', 2000), left(p_result ->> 'provider', 40), left(p_result ->> 'model', 80), p_result ->> 'input_sha256')
  returning id into v_id;
  perform public.write_audit('assessment.ai_evaluated', 'assessment_submission', p_submission, v_as.company_id,
    jsonb_build_object('question', p_question, 'ai_evaluation', v_id, 'status', p_result ->> 'status', 'score', v_score));
  return v_id;
end $$;

-- ============================================================== 4. human review: AI vs human, per-question feedback, history
alter table public.assessment_evaluations add column if not exists ai_evaluation_id uuid references public.assessment_ai_evaluations (id) on delete set null;
alter table public.assessment_evaluations add column if not exists source text not null default 'human' check (source in ('human', 'ai_accepted', 'ai_adjusted'));
alter table public.assessment_evaluations add column if not exists candidate_feedback jsonb
  check (candidate_feedback is null or (jsonb_typeof(candidate_feedback) = 'object' and pg_column_size(candidate_feedback) < 16384));
alter table public.assessment_evaluations add column if not exists updated_at timestamptz;

create table if not exists public.assessment_evaluation_history (
  id bigint generated always as identity primary key,
  evaluation_id uuid not null,
  submission_id uuid not null references public.assessment_submissions (id) on delete cascade,
  question_id uuid references public.assessment_questions (id) on delete cascade,
  evaluator_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('baseline', 'created', 'updated')),
  points numeric(6, 2),
  previous_points numeric(6, 2),
  rubric_scores jsonb,
  comments text,
  candidate_feedback jsonb,
  source text,
  ai_evaluation_id uuid,
  changed_at timestamptz not null default now()
);
create index if not exists assessment_evaluation_history_q on public.assessment_evaluation_history (submission_id, question_id, changed_at);
alter table public.assessment_evaluation_history enable row level security;
drop policy if exists assessment_evaluation_history_read on public.assessment_evaluation_history;
create policy assessment_evaluation_history_read on public.assessment_evaluation_history for select to authenticated
  using (public.is_super_admin() or exists (
    select 1 from public.assessment_submissions s join public.assessment_assignments aa on aa.id = s.assignment_id
    where s.id = submission_id and aa.company_id is not null and public.can_recruit(aa.company_id)));
grant select on public.assessment_evaluation_history to authenticated;

insert into public.assessment_evaluation_history (evaluation_id, submission_id, question_id, evaluator_id, action, points, rubric_scores, comments, source, changed_at)
select e.id, e.submission_id, e.question_id, e.evaluator_id, 'baseline', e.points, e.rubric_scores, e.comments, e.source, e.created_at
  from public.assessment_evaluations e
 where not exists (select 1 from public.assessment_evaluation_history h where h.evaluation_id = e.id);

create or replace function public._log_assessment_evaluation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.assessment_evaluation_history (evaluation_id, submission_id, question_id, evaluator_id, action, points, previous_points,
    rubric_scores, comments, candidate_feedback, source, ai_evaluation_id)
  values (new.id, new.submission_id, new.question_id, new.evaluator_id, case when tg_op = 'INSERT' then 'created' else 'updated' end,
    new.points, case when tg_op = 'UPDATE' then old.points end, new.rubric_scores, new.comments, new.candidate_feedback, new.source, new.ai_evaluation_id);
  return new;
end $$;
drop trigger if exists assessment_evaluations_history on public.assessment_evaluations;
create trigger assessment_evaluations_history after insert or update on public.assessment_evaluations
  for each row execute function public._log_assessment_evaluation();

-- Is the question scored automatically at submission (objective, or short answer with accepted answers)?
create or replace function public.question_auto_scored(p_type public.question_type, p_config jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select p_type::text in ('multiple_choice', 'true_false', 'multiple_select')
      or (p_type::text = 'short_answer' and jsonb_typeof(p_config -> 'accepted_answers') = 'array');
$$;

-- Scores recomputed per question: a human review replaces that question's automatic score (never added to it).
-- total = Σ question scores; maximum = Σ question points (each question's points are its weight).
create or replace function public._recompute_submission_score(p_submission uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_sub public.assessment_submissions; v_as public.assessment_assignments; v_q record;
  v_auto numeric := 0; v_manual numeric := 0; v_max numeric := 0; v_pending int := 0;
begin
  select * into v_sub from public.assessment_submissions where id = p_submission for update;
  select * into v_as from public.assessment_assignments where id = v_sub.assignment_id;
  for v_q in
    select q.points, public.question_auto_scored(q.type, q.config) as auto, e.id is not null as reviewed, e.points as ev_points, a.points_awarded
      from public.assessment_questions q
      left join public.assessment_evaluations e on e.submission_id = p_submission and e.question_id = q.id
      left join public.assessment_answers a on a.submission_id = p_submission and a.question_id = q.id
     where q.assessment_id = v_as.assessment_id
  loop
    v_max := v_max + v_q.points;
    if v_q.reviewed then v_manual := v_manual + v_q.ev_points;
    elsif v_q.auto then v_auto := v_auto + coalesce(v_q.points_awarded, 0);
    else v_pending := v_pending + 1;
    end if;
  end loop;
  update public.assessment_submissions set
    auto_score = round(v_auto, 2), manual_score = round(v_manual, 2), max_score = v_max,
    needs_review = v_pending > 0,
    status = case when v_pending = 0 then 'evaluated' else 'submitted' end,
    evaluated_at = case when v_pending = 0 then now() end,
    percentage = case when v_pending = 0 and v_max > 0 then round((v_auto + v_manual) / v_max * 100, 2) end
  where id = p_submission;
  update public.assessment_assignments
     set status = (case when v_pending = 0 then 'evaluated' else 'submitted' end)::public.assignment_status
   where id = v_as.id and status::text in ('submitted', 'evaluated');
end $$;
revoke all on function public._recompute_submission_score(uuid) from public, anon, authenticated;

create or replace function public.review_assessment_question(
  p_submission uuid, p_question uuid, p_points numeric, p_rubric_scores jsonb default '{}',
  p_comments text default null, p_candidate_feedback jsonb default null, p_ai_evaluation uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_sub public.assessment_submissions; v_as public.assessment_assignments; v_q public.assessment_questions;
  v_ai public.assessment_ai_evaluations; v_source text := 'human'; v_fb jsonb;
begin
  select * into v_sub from public.assessment_submissions where id = p_submission for update;
  select * into v_as from public.assessment_assignments where id = v_sub.assignment_id;
  if v_sub.id is null or v_as.company_id is null or not public.can_recruit(v_as.company_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_sub.status = 'in_progress' then raise exception 'submission is not complete yet' using errcode = 'P0001'; end if;
  select * into v_q from public.assessment_questions where id = p_question and assessment_id = v_as.assessment_id;
  if v_q.id is null then raise exception 'question not found' using errcode = 'P0002'; end if;
  if p_points is null or p_points < 0 or p_points > v_q.points then raise exception 'points must be between 0 and %', v_q.points using errcode = 'P0001'; end if;
  if p_ai_evaluation is not null then
    select * into v_ai from public.assessment_ai_evaluations where id = p_ai_evaluation;
    if v_ai.id is null or v_ai.submission_id <> p_submission or v_ai.question_id <> p_question then
      raise exception 'the AI evaluation belongs to a different question' using errcode = 'P0001';
    end if;
    v_source := case when v_ai.score is not null and v_ai.score = p_points then 'ai_accepted' else 'ai_adjusted' end;
  end if;
  if p_candidate_feedback is not null then
    if jsonb_typeof(p_candidate_feedback) <> 'object' then raise exception 'invalid feedback' using errcode = '22023'; end if;
    select jsonb_object_agg(k, left(trim(p_candidate_feedback ->> k), 2000)) into v_fb
      from unnest(array['strengths', 'missing', 'improvements']) k
     where nullif(trim(coalesce(p_candidate_feedback ->> k, '')), '') is not null;
  end if;
  insert into public.assessment_evaluations (submission_id, question_id, evaluator_id, rubric_scores, points, comments, candidate_feedback, source, ai_evaluation_id, updated_at)
  values (p_submission, p_question, auth.uid(), coalesce(p_rubric_scores, '{}'), p_points, left(p_comments, 2000), v_fb, v_source, p_ai_evaluation, now())
  on conflict (submission_id, question_id) do update set
    evaluator_id = excluded.evaluator_id, rubric_scores = excluded.rubric_scores, points = excluded.points, comments = excluded.comments,
    candidate_feedback = excluded.candidate_feedback, source = excluded.source, ai_evaluation_id = excluded.ai_evaluation_id, updated_at = now();
  insert into public.assessment_answers (submission_id, question_id, points_awarded) values (p_submission, p_question, p_points)
  on conflict (submission_id, question_id) do update set points_awarded = excluded.points_awarded, is_correct = null;
  perform public._recompute_submission_score(p_submission);
  perform public.write_audit('assessment.question_reviewed', 'assessment_submission', p_submission, v_as.company_id,
    jsonb_build_object('question', p_question, 'points', p_points, 'source', v_source, 'ai_evaluation', p_ai_evaluation));
end $$;

-- The original entry point keeps working (and now uses the same per-question scoring); it keeps any candidate feedback.
create or replace function public.evaluate_assessment_answer(
  p_submission uuid, p_question uuid, p_points numeric, p_rubric_scores jsonb default '{}', p_comments text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_fb jsonb;
begin
  select candidate_feedback into v_fb from public.assessment_evaluations where submission_id = p_submission and question_id = p_question;
  perform public.review_assessment_question(p_submission, p_question, p_points, p_rubric_scores, p_comments, v_fb, null);
end $$;

-- ============================================================== 5. candidate result: per-question feedback and files
create or replace function public.get_assessment_result(p_assignment uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_as public.assessment_assignments; v_sub public.assessment_submissions; v_a public.assessments; v_show boolean;
begin
  select * into v_as from public.assessment_assignments where id = p_assignment;
  if v_as.id is null or not (v_as.candidate_id = auth.uid() or (v_as.company_id is not null and public.can_recruit(v_as.company_id)) or public.is_super_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into v_sub from public.assessment_submissions where assignment_id = p_assignment;
  if v_sub.id is null or v_sub.status = 'in_progress' then raise exception 'results are available after submission' using errcode = 'P0001'; end if;
  select * into v_a from public.assessments where id = v_as.assessment_id;
  -- Written feedback reaches the candidate only once the company shares it (existing publication rule).
  v_show := v_sub.feedback_shared or v_as.candidate_id <> auth.uid();
  return jsonb_build_object(
    'assessment', jsonb_build_object('title_en', v_a.title_en, 'title_ar', v_a.title_ar, 'passing_score', v_a.passing_score,
      'learning_outcomes_en', v_a.learning_outcomes_en, 'learning_outcomes_ar', v_a.learning_outcomes_ar),
    'submission', jsonb_build_object('status', v_sub.status, 'auto_score', v_sub.auto_score, 'manual_score', v_sub.manual_score,
      'max_score', v_sub.max_score, 'percentage', v_sub.percentage, 'needs_review', v_sub.needs_review, 'submitted_at', v_sub.submitted_at,
      'feedback', case when v_show then v_sub.candidate_feedback end, 'feedback_shared', v_sub.feedback_shared),
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', q.id, 'type', q.type, 'prompt_en', q.prompt_en, 'prompt_ar', q.prompt_ar, 'points', q.points,
      'explanation_en', q.explanation_en, 'explanation_ar', q.explanation_ar,
      'auto_scored', public.question_auto_scored(q.type, q.config),
      'options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'label_en', o.label_en, 'label_ar', o.label_ar, 'is_correct', o.is_correct) order by o.position)
        from public.assessment_options o where o.question_id = q.id), '[]'),
      'answer', (select jsonb_build_object('selected_option_ids', aa.selected_option_ids, 'text_answer', aa.text_answer,
        'is_correct', aa.is_correct, 'points_awarded', aa.points_awarded) from public.assessment_answers aa where aa.submission_id = v_sub.id and aa.question_id = q.id),
      'reviewed', exists (select 1 from public.assessment_evaluations e where e.submission_id = v_sub.id and e.question_id = q.id),
      'feedback', case when v_show then (select e.candidate_feedback from public.assessment_evaluations e where e.submission_id = v_sub.id and e.question_id = q.id) end,
      'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'file_name', f.file_name, 'size_bytes', f.size_bytes) order by f.created_at)
        from public.assessment_answer_files f where f.submission_id = v_sub.id and f.question_id = q.id), '[]')
    ) order by q.position) from public.assessment_questions q where q.assessment_id = v_a.id), '[]'),
    'unlinked_files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'file_name', f.file_name, 'size_bytes', f.size_bytes) order by f.created_at)
      from public.assessment_answer_files f where f.submission_id = v_sub.id and f.question_id is null), '[]'));
end $$;

-- ============================================================== grants
do $$ declare f text; begin
  foreach f in array array[
    'public.record_ai_question_evaluation(uuid, uuid, jsonb)',
    'public.review_assessment_question(uuid, uuid, numeric, jsonb, text, jsonb, uuid)',
    'public.evaluate_assessment_answer(uuid, uuid, numeric, jsonb, text)',
    'public.get_assessment_result(uuid)',
    'public.register_assessment_file(uuid, uuid, text, text, text, bigint)',
    'public.question_accepts_files(public.question_type)',
    'public.question_auto_scored(public.question_type, jsonb)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
revoke all on function public._log_assessment_evaluation() from public, anon, authenticated;
