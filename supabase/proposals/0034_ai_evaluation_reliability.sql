-- JADARAH — 0034 AI evaluation reliability  (PROPOSED — requires owner approval; additive and reversible)
-- Not applied to the hosted project. Tested locally with:
--   WITH_PROPOSALS=0034_ai_evaluation_reliability.sql bash tests/db/run-local.sh tests/db/*.test.sql tests/db/proposals/*.test.sql
-- The application works without it (in-process lock only, no persisted "in progress" / "failed" states, model-stated
-- limitations folded into "points to check", no explicit rejection). With it:
--  A. assessment_ai_runs: every AI evaluation attempt of ONE question, with its state (reading_files → evaluating →
--     completed | failed), error and input hash. At most one active run per submission + question (database lock);
--     an active run not updated for 5 minutes is closed as failed ("stale") so a crashed server never blocks a question.
--  B. assessment_ai_evaluations: model-stated limitations, the derived confidence level and its reasons, the run that
--     produced the result and the evaluator version. record_ai_question_evaluation stores them and completes the run.
--  C. Explicit rejection of an AI suggestion: assessment_ai_rejections (one per AI result, with the reviewer's reason),
--     review source 'ai_rejected', history action 'ai_rejected'. The AI result itself is never altered.
-- Who may call: recruiters and company admins of the submission's company (the same rule as 0033; see P2-4).
-- Rollback (no data outside these objects is changed except the review source of rejected results):
--   restore record_ai_question_evaluation and review_assessment_question from 20261112000033_question_level_evaluation.sql;
--   update public.assessment_evaluations set source = 'ai_adjusted' where source = 'ai_rejected';
--   delete from public.assessment_evaluation_history where action = 'ai_rejected';
--   restore the two check constraints (source in human/ai_accepted/ai_adjusted; action in baseline/created/updated);
--   alter table public.assessment_evaluation_history alter column evaluation_id set not null;
--   drop function public.reject_ai_question_evaluation(uuid, text); drop function public.update_ai_question_run(uuid, text, text, text);
--   drop function public.begin_ai_question_run(uuid, uuid, text, boolean); drop table public.assessment_ai_rejections;
--   alter table public.assessment_ai_evaluations drop column run_id, drop column limitations, drop column confidence,
--     drop column confidence_reasons, drop column evaluator_version; drop table public.assessment_ai_runs;

-- =================================================================== A. runs (state + lock)
create table if not exists public.assessment_ai_runs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assessment_submissions (id) on delete cascade,
  question_id uuid not null references public.assessment_questions (id) on delete cascade,
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  status text not null check (status in ('reading_files', 'evaluating', 'completed', 'failed')),
  forced boolean not null default false,
  input_sha256 text check (input_sha256 is null or input_sha256 ~ '^[0-9a-f]{64}$'),
  error_code text check (error_code is null or error_code ~ '^[a-z0-9_]{1,60}$'),
  error_message text check (error_message is null or char_length(error_message) <= 500),
  ai_evaluation_id uuid references public.assessment_ai_evaluations (id) on delete set null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  check ((status in ('completed', 'failed')) = (finished_at is not null)),
  check (status <> 'completed' or ai_evaluation_id is not null),
  check (status <> 'failed' or error_code is not null)
);
-- The lock: one active run per submission + question.
create unique index if not exists assessment_ai_runs_one_active on public.assessment_ai_runs (submission_id, question_id)
  where status in ('reading_files', 'evaluating');
create index if not exists assessment_ai_runs_q on public.assessment_ai_runs (submission_id, question_id, started_at desc);
alter table public.assessment_ai_runs enable row level security;
drop policy if exists assessment_ai_runs_read on public.assessment_ai_runs;
create policy assessment_ai_runs_read on public.assessment_ai_runs for select to authenticated
  using (public.is_super_admin() or public.can_recruit(company_id));
grant select on public.assessment_ai_runs to authenticated;

create or replace function public.begin_ai_question_run(p_submission uuid, p_question uuid, p_input_sha256 text, p_forced boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_sub public.assessment_submissions; v_as public.assessment_assignments; v_q public.assessment_questions; v_id uuid;
begin
  select * into v_sub from public.assessment_submissions where id = p_submission;
  select * into v_as from public.assessment_assignments where id = v_sub.assignment_id;
  if v_sub.id is null or v_as.company_id is null or not public.can_recruit(v_as.company_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_sub.status = 'in_progress' then raise exception 'submission is not complete yet' using errcode = 'P0001'; end if;
  select * into v_q from public.assessment_questions where id = p_question and assessment_id = v_as.assessment_id;
  if v_q.id is null then raise exception 'question not found' using errcode = 'P0002'; end if;
  if p_input_sha256 is not null and p_input_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid input hash' using errcode = '22023'; end if;
  -- A run that stopped reporting (server crash, timeout) must not block the question forever.
  update public.assessment_ai_runs set status = 'failed', error_code = 'stale',
         error_message = 'the evaluation stopped without finishing', finished_at = now(), updated_at = now()
   where submission_id = p_submission and question_id = p_question
     and status in ('reading_files', 'evaluating') and updated_at < now() - interval '5 minutes';
  begin
    insert into public.assessment_ai_runs (submission_id, question_id, company_id, requested_by, status, forced, input_sha256)
    values (p_submission, p_question, v_as.company_id, auth.uid(), 'reading_files', coalesce(p_forced, false), p_input_sha256)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'an AI evaluation of this question is already running' using errcode = '55P03';
  end;
  return v_id;
end $$;

create or replace function public.update_ai_question_run(p_run uuid, p_status text, p_error_code text default null, p_error_message text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_run public.assessment_ai_runs;
begin
  select * into v_run from public.assessment_ai_runs where id = p_run for update;
  if v_run.id is null or not public.can_recruit(v_run.company_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_run.status not in ('reading_files', 'evaluating') then raise exception 'this evaluation run has already finished' using errcode = 'P0001'; end if;
  -- "completed" is set only by record_ai_question_evaluation, together with the stored result.
  if p_status = 'evaluating' then
    update public.assessment_ai_runs set status = 'evaluating', updated_at = now() where id = p_run;
  elsif p_status = 'failed' then
    update public.assessment_ai_runs
       set status = 'failed', error_code = coalesce(nullif(p_error_code, ''), 'failed'), error_message = left(p_error_message, 500),
           finished_at = now(), updated_at = now()
     where id = p_run;
  else
    raise exception 'invalid run status' using errcode = '22023';
  end if;
end $$;

-- =================================================================== B. transparency fields on AI results
alter table public.assessment_ai_evaluations
  add column if not exists run_id uuid references public.assessment_ai_runs (id) on delete set null,
  add column if not exists limitations jsonb not null default '[]' check (jsonb_typeof(limitations) = 'array'),
  add column if not exists confidence text check (confidence is null or confidence in ('high', 'medium', 'low')),
  add column if not exists confidence_reasons jsonb not null default '[]' check (jsonb_typeof(confidence_reasons) = 'array'),
  add column if not exists evaluator_version text check (evaluator_version is null or char_length(evaluator_version) <= 40);
alter table public.assessment_ai_evaluations drop constraint if exists assessment_ai_evaluations_transparency_size;
alter table public.assessment_ai_evaluations add constraint assessment_ai_evaluations_transparency_size
  check (pg_column_size(limitations) + pg_column_size(confidence_reasons) < 32768);

create or replace function public.record_ai_question_evaluation(p_submission uuid, p_question uuid, p_result jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_sub public.assessment_submissions; v_as public.assessment_assignments; v_q public.assessment_questions; v_id uuid; v_score numeric;
  v_run uuid := nullif(p_result ->> 'run_id', '')::uuid; v_conf text := p_result ->> 'confidence';
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
  if v_conf is not null and v_conf not in ('high', 'medium', 'low') then v_conf := null; end if;
  if v_run is not null and not exists (select 1 from public.assessment_ai_runs r where r.id = v_run and r.submission_id = p_submission
                                          and r.question_id = p_question and r.status in ('reading_files', 'evaluating')) then
    raise exception 'the evaluation run does not match this question or has already finished' using errcode = 'P0001';
  end if;
  insert into public.assessment_ai_evaluations (submission_id, question_id, company_id, requested_by, status, rubric_source, criteria,
    requirements, strengths, issues, improvements, concerns, files, answer_present, score, max_score, explanation, provider, model, input_sha256,
    run_id, limitations, confidence, confidence_reasons, evaluator_version)
  values (p_submission, p_question, v_as.company_id, auth.uid(), p_result ->> 'status', coalesce(p_result ->> 'rubric_source', 'none'),
    coalesce(p_result -> 'criteria', '[]'), coalesce(p_result -> 'requirements', '[]'), coalesce(p_result -> 'strengths', '[]'),
    coalesce(p_result -> 'issues', '[]'), coalesce(p_result -> 'improvements', '[]'), coalesce(p_result -> 'concerns', '[]'),
    coalesce(p_result -> 'files', '[]'), coalesce((p_result ->> 'answer_present')::boolean, false), v_score, v_q.points,
    left(p_result ->> 'explanation', 2000), left(p_result ->> 'provider', 40), left(p_result ->> 'model', 80), p_result ->> 'input_sha256',
    v_run, coalesce(p_result -> 'limitations', '[]'), v_conf, coalesce(p_result -> 'confidence_reasons', '[]'),
    left(p_result ->> 'evaluator_version', 40))
  returning id into v_id;
  if v_run is not null then
    update public.assessment_ai_runs set status = 'completed', ai_evaluation_id = v_id, finished_at = now(), updated_at = now() where id = v_run;
  end if;
  perform public.write_audit('assessment.ai_evaluated', 'assessment_submission', p_submission, v_as.company_id,
    jsonb_build_object('question', p_question, 'ai_evaluation', v_id, 'status', p_result ->> 'status', 'score', v_score, 'run', v_run));
  return v_id;
end $$;

-- =================================================================== C. explicit rejection of an AI suggestion
create table if not exists public.assessment_ai_rejections (
  id uuid primary key default gen_random_uuid(),
  ai_evaluation_id uuid not null unique references public.assessment_ai_evaluations (id) on delete cascade,
  submission_id uuid not null references public.assessment_submissions (id) on delete cascade,
  question_id uuid not null references public.assessment_questions (id) on delete cascade,
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  rejected_by uuid references public.profiles (id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists assessment_ai_rejections_q on public.assessment_ai_rejections (submission_id, question_id);
alter table public.assessment_ai_rejections enable row level security;
drop policy if exists assessment_ai_rejections_read on public.assessment_ai_rejections;
create policy assessment_ai_rejections_read on public.assessment_ai_rejections for select to authenticated
  using (public.is_super_admin() or public.can_recruit(company_id));
grant select on public.assessment_ai_rejections to authenticated;

alter table public.assessment_evaluations drop constraint if exists assessment_evaluations_source_check;
alter table public.assessment_evaluations add constraint assessment_evaluations_source_check
  check (source in ('human', 'ai_accepted', 'ai_adjusted', 'ai_rejected'));
alter table public.assessment_evaluation_history drop constraint if exists assessment_evaluation_history_action_check;
alter table public.assessment_evaluation_history add constraint assessment_evaluation_history_action_check
  check (action in ('baseline', 'created', 'updated', 'ai_rejected'));
-- A rejection can happen before any human score exists for the question.
alter table public.assessment_evaluation_history alter column evaluation_id drop not null;

create or replace function public.reject_ai_question_evaluation(p_ai_evaluation uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_ai public.assessment_ai_evaluations; v_eval public.assessment_evaluations; v_id uuid;
begin
  select * into v_ai from public.assessment_ai_evaluations where id = p_ai_evaluation;
  if v_ai.id is null or not public.can_recruit(v_ai.company_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'give a reason for rejecting the AI suggestion' using errcode = 'P0001'; end if;
  begin
    insert into public.assessment_ai_rejections (ai_evaluation_id, submission_id, question_id, company_id, rejected_by, reason)
    values (v_ai.id, v_ai.submission_id, v_ai.question_id, v_ai.company_id, auth.uid(), left(btrim(p_reason), 1000))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'this AI suggestion has already been rejected' using errcode = 'P0001';
  end;
  select * into v_eval from public.assessment_evaluations where submission_id = v_ai.submission_id and question_id = v_ai.question_id;
  insert into public.assessment_evaluation_history (evaluation_id, submission_id, question_id, evaluator_id, action, points, comments, source, ai_evaluation_id)
  values (v_eval.id, v_ai.submission_id, v_ai.question_id, auth.uid(), 'ai_rejected', v_eval.points, left(btrim(p_reason), 2000), 'ai_rejected', v_ai.id);
  -- A score already approved from this suggestion stays as approved by the reviewer, but is no longer "AI accepted/adjusted".
  if v_eval.id is not null and v_eval.ai_evaluation_id = v_ai.id then
    update public.assessment_evaluations set source = 'ai_rejected', updated_at = now() where id = v_eval.id;
  end if;
  perform public.write_audit('assessment.ai_rejected', 'assessment_submission', v_ai.submission_id, v_ai.company_id,
    jsonb_build_object('question', v_ai.question_id, 'ai_evaluation', v_ai.id));
  return v_id;
end $$;

-- Same as 0033, plus: a rejected AI suggestion cannot be accepted, and a score given after rejecting the latest AI
-- suggestion is recorded as 'ai_rejected' with that suggestion's id.
create or replace function public.review_assessment_question(
  p_submission uuid, p_question uuid, p_points numeric, p_rubric_scores jsonb default '{}',
  p_comments text default null, p_candidate_feedback jsonb default null, p_ai_evaluation uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_sub public.assessment_submissions; v_as public.assessment_assignments; v_q public.assessment_questions;
  v_ai public.assessment_ai_evaluations; v_source text := 'human'; v_fb jsonb; v_ai_id uuid := p_ai_evaluation; v_latest uuid;
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
    if exists (select 1 from public.assessment_ai_rejections r where r.ai_evaluation_id = p_ai_evaluation) then
      raise exception 'this AI suggestion was rejected; score the question independently' using errcode = 'P0001';
    end if;
    v_source := case when v_ai.score is not null and v_ai.score = p_points then 'ai_accepted' else 'ai_adjusted' end;
  else
    select a.id into v_latest from public.assessment_ai_evaluations a
     where a.submission_id = p_submission and a.question_id = p_question order by a.created_at desc limit 1;
    if v_latest is not null and exists (select 1 from public.assessment_ai_rejections r where r.ai_evaluation_id = v_latest) then
      v_source := 'ai_rejected';
      v_ai_id := v_latest;
    end if;
  end if;
  if p_candidate_feedback is not null then
    if jsonb_typeof(p_candidate_feedback) <> 'object' then raise exception 'invalid feedback' using errcode = '22023'; end if;
    select jsonb_object_agg(k, left(trim(p_candidate_feedback ->> k), 2000)) into v_fb
      from unnest(array['strengths', 'missing', 'improvements']) k
     where nullif(trim(coalesce(p_candidate_feedback ->> k, '')), '') is not null;
  end if;
  insert into public.assessment_evaluations (submission_id, question_id, evaluator_id, rubric_scores, points, comments, candidate_feedback, source, ai_evaluation_id, updated_at)
  values (p_submission, p_question, auth.uid(), coalesce(p_rubric_scores, '{}'), p_points, left(p_comments, 2000), v_fb, v_source, v_ai_id, now())
  on conflict (submission_id, question_id) do update set
    evaluator_id = excluded.evaluator_id, rubric_scores = excluded.rubric_scores, points = excluded.points, comments = excluded.comments,
    candidate_feedback = excluded.candidate_feedback, source = excluded.source, ai_evaluation_id = excluded.ai_evaluation_id, updated_at = now();
  insert into public.assessment_answers (submission_id, question_id, points_awarded) values (p_submission, p_question, p_points)
  on conflict (submission_id, question_id) do update set points_awarded = excluded.points_awarded, is_correct = null;
  perform public._recompute_submission_score(p_submission);
  perform public.write_audit('assessment.question_reviewed', 'assessment_submission', p_submission, v_as.company_id,
    jsonb_build_object('question', p_question, 'points', p_points, 'source', v_source, 'ai_evaluation', v_ai_id));
end $$;

-- =================================================================== grants
do $$ declare f text; begin
  foreach f in array array[
    'public.begin_ai_question_run(uuid, uuid, text, boolean)',
    'public.update_ai_question_run(uuid, text, text, text)',
    'public.record_ai_question_evaluation(uuid, uuid, jsonb)',
    'public.reject_ai_question_evaluation(uuid, text)',
    'public.review_assessment_question(uuid, uuid, numeric, jsonb, text, jsonb, uuid)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
