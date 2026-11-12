-- Disposable local database only. Proposal 0034 (NOT applied to the hosted project), exercised as real roles:
--   WITH_PROPOSALS=0034_ai_evaluation_reliability.sql bash tests/db/run-local.sh tests/db/*.test.sql tests/db/proposals/*.test.sql
-- Runs (state + lock), transparency fields, explicit rejection of an AI suggestion. No mock evaluations: the functions
-- under test store exactly what they are given.
\set ON_ERROR_STOP 1
begin;
create function pg_temp.login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated', 'email', (select email from auth.users where id = p))::text, false);
$$;
create function pg_temp.expect_error(p_sql text, p_like text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected error % but statement succeeded: %', p_like, p_sql;
exception when others then
  if sqlerrm like 'expected error%' then raise; end if;
  if sqlerrm not ilike p_like then raise exception 'expected error like % got: %', p_like, sqlerrm; end if;
end $$;

-- ------------------------------------------------------------------ fixtures (as postgres)
select id as co_a from public.company_profiles where slug is not null and status = 'approved' order by name_en limit 1 \gset
select id as co_b from public.company_profiles where status = 'approved' and id <> :'co_a' order by name_en limit 1 \gset
insert into public.company_subscriptions (company_id, plan, status, payment_status, is_demo)
  select c, 'pilot', 'active', 'demo', true from unnest(array[:'co_a'::uuid, :'co_b'::uuid]) c
  where not exists (select 1 from public.company_subscriptions s where s.company_id = c and s.status = 'active');
select m.user_id as rec_a from public.company_memberships m where m.company_id = :'co_a' and m.role = 'recruiter' and m.status = 'active' limit 1 \gset
select m.user_id as rec_b from public.company_memberships m where m.company_id = :'co_b' and m.role = 'recruiter' and m.status = 'active' limit 1 \gset
select r.user_id as cand_1 from public.user_roles r join public.profiles p on p.id = r.user_id where r.role = 'candidate' and p.account_type = 'candidate' order by p.email limit 1 \gset
select id as job_a from public.jobs where company_id = :'co_a' order by created_at limit 1 \gset

insert into public.assessments (company_id, title_en, title_ar, duration_minutes, passing_score, status)
  values (:'co_a', 'Reliability task', 'مهمة الموثوقية', 60, 50, 'published') returning id as asmt \gset
insert into public.assessment_questions (assessment_id, type, prompt_en, prompt_ar, points, position)
  values (:'asmt', 'case_study', 'Forecast Q3 demand', 'توقّع الطلب', 10, 0) returning id as q1 \gset
insert into public.assessment_questions (assessment_id, type, prompt_en, prompt_ar, points, position)
  values (:'asmt', 'long_answer', 'Explain the risks', 'اشرح المخاطر', 5, 1) returning id as q2 \gset
insert into public.applications (job_id, candidate_id, company_id, status) values (:'job_a', :'cand_1', :'co_a', 'under_review') on conflict do nothing;
select id as app_1 from public.applications where job_id = :'job_a' and candidate_id = :'cand_1' \gset
insert into public.assessment_assignments (assessment_id, application_id, candidate_id, company_id, status)
  values (:'asmt', :'app_1', :'cand_1', :'co_a', 'assigned') returning id as asg \gset

select pg_temp.login(:'cand_1');
set role authenticated;
select (public.start_assessment(:'asg') ->> 'submission_id') as sub \gset
-- before submission nobody can start an AI run
reset role;
select pg_temp.login(:'rec_a');
set role authenticated;
select pg_temp.expect_error(format($$select public.begin_ai_question_run('%s', '%s', null)$$, :'sub', :'q1'), '%not complete yet%');
reset role;
select pg_temp.login(:'cand_1');
set role authenticated;
select public.save_assessment_answer(:'asg', :'q1', '{}', 'Forecast for SKU-118: 1,240 units', null);
select public.save_assessment_answer(:'asg', :'q2', '{}', 'Lead time rose from 9 to 14 days', null);
select public.submit_assessment(:'asg');
-- candidates cannot start runs, read runs, or reject AI results
select pg_temp.expect_error(format($$select public.begin_ai_question_run('%s', '%s', null)$$, :'sub', :'q1'), '%not authorized%');
reset role;

-- ================================================================== A. runs: lock, states, failure, staleness
select pg_temp.login(:'rec_a');
set role authenticated;
select public.begin_ai_question_run(:'sub', :'q1', repeat('a', 64), false) as run1 \gset
-- the lock: a second active run of the same question is refused; another question is independent
select pg_temp.expect_error(format($$select public.begin_ai_question_run('%s', '%s', null)$$, :'sub', :'q1'), '%already running%');
select public.begin_ai_question_run(:'sub', :'q2', null, false) as run_q2 \gset
select public.update_ai_question_run(:'run1', 'evaluating');
select pg_temp.expect_error(format($$select public.update_ai_question_run('%s', 'completed')$$, :'run1'), '%invalid run status%');
-- a failure is persisted with its error code and message, and releases the lock
select public.update_ai_question_run(:'run1', 'failed', 'gemini_overloaded', 'AI could not evaluate this answer now');
select pg_temp.expect_error(format($$select public.update_ai_question_run('%s', 'evaluating')$$, :'run1'), '%already finished%');
reset role;
select (status = 'failed' and error_code = 'gemini_overloaded' and finished_at is not null) as failed_ok from public.assessment_ai_runs where id = :'run1' \gset
\if :failed_ok
\else
  select 1/0;
\endif
select pg_temp.login(:'rec_a');
set role authenticated;
-- after the failure a new run may start (forced re-evaluation is recorded as such)
select public.begin_ai_question_run(:'sub', :'q1', repeat('b', 64), true) as run2 \gset
-- recording completes the run atomically and stores limitations + confidence
select public.record_ai_question_evaluation(:'sub', :'q1', jsonb_build_object('status', 'completed', 'rubric_source', 'ai_derived', 'score', 7,
  'run_id', :'run2', 'limitations', '["The spreadsheet chart was not read"]'::jsonb, 'confidence', 'medium',
  'confidence_reasons', '["One criterion score is not backed by a quote"]'::jsonb, 'evaluator_version', 'test-v1',
  'input_sha256', repeat('b', 64))) as ai1 \gset
select (r.status = 'completed' and r.ai_evaluation_id = :'ai1' and r.forced and e.run_id = :'run2' and e.confidence = 'medium'
        and e.limitations = '["The spreadsheet chart was not read"]'::jsonb and e.evaluator_version = 'test-v1') as recorded_ok
  from public.assessment_ai_runs r join public.assessment_ai_evaluations e on e.id = r.ai_evaluation_id where r.id = :'run2' \gset
\if :recorded_ok
\else
  select 1/0;
\endif
-- a finished run cannot be reused; a run of another question cannot be attached to this question's result
select pg_temp.expect_error(format($$select public.record_ai_question_evaluation('%s', '%s', '{"status":"completed","score":1,"run_id":"%s"}')$$, :'sub', :'q1', :'run2'), '%does not match%');
select pg_temp.expect_error(format($$select public.record_ai_question_evaluation('%s', '%s', '{"status":"completed","score":1,"run_id":"%s"}')$$, :'sub', :'q1', :'run_q2'), '%does not match%');
-- an unknown confidence value is not stored
select public.record_ai_question_evaluation(:'sub', :'q2', '{"status":"completed","score":2,"confidence":"certain"}') as ai_q2 \gset
reset role;
select (confidence is null and limitations = '[]'::jsonb) as conf_null from public.assessment_ai_evaluations where id = :'ai_q2' \gset
\if :conf_null
\else
  select 1/0;
\endif
-- a run that stopped reporting for 5 minutes is closed as stale when the next run starts
update public.assessment_ai_runs set updated_at = now() - interval '6 minutes' where id = :'run_q2';
select pg_temp.login(:'rec_a');
set role authenticated;
select public.begin_ai_question_run(:'sub', :'q2', null, false) as run_q2b \gset
select public.update_ai_question_run(:'run_q2b', 'failed', 'test_cleanup', null);
reset role;
select (status = 'failed' and error_code = 'stale') as stale_ok from public.assessment_ai_runs where id = :'run_q2' \gset
\if :stale_ok
\else
  select 1/0;
\endif
-- no direct writes: runs and rejections change only through the functions
select pg_temp.login(:'rec_a');
set role authenticated;
select pg_temp.expect_error(format($$update public.assessment_ai_runs set status = 'completed' where id = '%s'$$, :'run1'), '%permission denied%');
select pg_temp.expect_error(format($$insert into public.assessment_ai_rejections (ai_evaluation_id, submission_id, question_id, company_id, reason) values ('%s', '%s', '%s', '%s', 'xyz')$$, :'ai1', :'sub', :'q1', :'co_a'), '%permission denied%');
reset role;

-- ================================================================== B. other companies and candidates see nothing
select pg_temp.login(:'rec_b');
set role authenticated;
select (select count(*) from public.assessment_ai_runs where submission_id = :'sub') = 0 as b_runs_hidden \gset
select pg_temp.expect_error(format($$select public.begin_ai_question_run('%s', '%s', null)$$, :'sub', :'q1'), '%not authorized%');
select pg_temp.expect_error(format($$select public.reject_ai_question_evaluation('%s', 'not mine')$$, :'ai1'), '%not authorized%');
reset role;
\if :b_runs_hidden
\else
  select 1/0;
\endif
select pg_temp.login(:'cand_1');
set role authenticated;
select (select count(*) from public.assessment_ai_runs) = 0 and (select count(*) from public.assessment_ai_rejections) = 0 as cand_hidden \gset
select pg_temp.expect_error(format($$select public.reject_ai_question_evaluation('%s', 'I disagree')$$, :'ai1'), '%not authorized%');
reset role;
\if :cand_hidden
\else
  select 1/0;
\endif

-- ================================================================== C. explicit rejection
select pg_temp.login(:'rec_a');
set role authenticated;
-- 1. The reviewer accepts AI result ai1 (score 7 = AI score → ai_accepted) …
select public.review_assessment_question(:'sub', :'q1', 7, '{}', null, null, :'ai1');
-- 2. … then rejects it with a reason: the approved score stays, its source becomes ai_rejected, history records it.
select pg_temp.expect_error(format($$select public.reject_ai_question_evaluation('%s', ' ')$$, :'ai1'), '%give a reason%');
select public.reject_ai_question_evaluation(:'ai1', 'The forecast method was misread') as rej1 \gset
select pg_temp.expect_error(format($$select public.reject_ai_question_evaluation('%s', 'again')$$, :'ai1'), '%already been rejected%');
-- 3. A rejected suggestion cannot be accepted again.
select pg_temp.expect_error(format($$select public.review_assessment_question('%s', '%s', 7, '{}', null, null, '%s')$$, :'sub', :'q1', :'ai1'), '%was rejected%');
-- 4. An independent score after the rejection is recorded as ai_rejected, linked to the rejected result.
select public.review_assessment_question(:'sub', :'q1', 4, '{}', 'scored manually', null, null);
select (e.source = 'ai_rejected' and e.ai_evaluation_id = :'ai1' and e.points = 4) as reviewed_ok
  from public.assessment_evaluations e where e.submission_id = :'sub' and e.question_id = :'q1' \gset
select string_agg(action || ':' || coalesce(source, '-') || ':' || coalesce(points::text, '-'), ',' order by id) as hist
  from public.assessment_evaluation_history where submission_id = :'sub' and question_id = :'q1' \gset
select (count(*) = 1) as one_rejection from public.assessment_ai_rejections where ai_evaluation_id = :'ai1' and reason = 'The forecast method was misread' \gset
reset role;
\if :reviewed_ok
\else
  select 1/0;
\endif
\if :one_rejection
\else
  select 1/0;
\endif
\echo history: :hist
select (:'hist' = 'created:ai_accepted:7.00,ai_rejected:ai_rejected:7.00,updated:ai_rejected:7.00,updated:ai_rejected:4.00') as hist_ok \gset
\if :hist_ok
\else
  select 1/0;
\endif
-- 5. The AI result itself is never altered by a rejection.
select (score = 7 and status = 'completed') as ai_unchanged from public.assessment_ai_evaluations where id = :'ai1' \gset
\if :ai_unchanged
\else
  select 1/0;
\endif
-- 6. A newer AI result for the question is not rejected: scoring without it is plain "human" again.
select pg_temp.login(:'rec_a');
set role authenticated;
select public.record_ai_question_evaluation(:'sub', :'q1', '{"status":"completed","score":5}') as ai1b \gset
reset role;
-- (one transaction: now() is constant, so give the newer result a later timestamp as a separate request would have)
update public.assessment_ai_evaluations set created_at = created_at + interval '1 second' where id = :'ai1b';
select pg_temp.login(:'rec_a');
set role authenticated;
select public.review_assessment_question(:'sub', :'q1', 6, '{}', null, null, null);
select (source = 'human' and ai_evaluation_id is null) as human_again from public.assessment_evaluations where submission_id = :'sub' and question_id = :'q1' \gset
reset role;
\if :human_again
\else
  select 1/0;
\endif

-- Anonymous: nothing callable.
set role anon;
select pg_temp.expect_error($$select public.begin_ai_question_run(gen_random_uuid(), gen_random_uuid(), null)$$, '%permission denied%');
select pg_temp.expect_error($$select public.reject_ai_question_evaluation(gen_random_uuid(), 'x')$$, '%permission denied%');
select pg_temp.expect_error($$select public.update_ai_question_run(gen_random_uuid(), 'failed')$$, '%permission denied%');
reset role;

rollback;
\echo 'proposal 0034 AI evaluation reliability: all checks passed'
