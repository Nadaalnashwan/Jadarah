-- Disposable local database only (tests/db/run-local.sh). Question-level evaluation (migration 0033), exercised as
-- real roles (`set role authenticated` + request.jwt.claims, as PostgREST runs requests). No mock evaluations: the
-- functions under test store and score exactly what they are given.
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

-- ================================================================== A. shared rubric split into question rubrics
insert into public.assessments (company_id, title_en, title_ar, duration_minutes, passing_score, status, ai_generated)
  values (:'co_a', 'Built task', 'مهمة', 60, 50, 'draft', true) returning id as built \gset
insert into public.assessment_rubrics (assessment_id, title_en, title_ar, criteria) values (:'built', 'Practical rubric', 'معايير', '[
  {"key":"api","name_en":"API","name_ar":"API","max_points":4},
  {"key":"tests","name_en":"Tests","name_ar":"اختبارات","max_points":3},
  {"key":"report","name_en":"Report","name_ar":"تقرير","max_points":3}]') returning id as shared \gset
insert into public.assessment_questions (assessment_id, type, prompt_en, prompt_ar, points, position, rubric_id) values
  (:'built', 'coding', 'Task 1: API', 'المهمة 1', 6, 0, :'shared'),
  (:'built', 'case_study', 'Task 2: report', 'المهمة 2', 4, 1, :'shared');
insert into public.assessment_assessor_guides (assessment_id, company_id, guide) values (:'built', :'co_a', '{"rubric":[
  {"key":"api","task_refs":[0]},{"key":"tests","task_refs":[0,1]},{"key":"report","task_refs":[1]}]}');
select public.split_shared_task_rubrics(:'built') as split_n \gset
do $$ declare v jsonb; begin
  -- Task 1 gets api (4) + half of tests (1.5); task 2 gets the other half of tests (1.5) + report (3).
  select jsonb_agg(jsonb_build_object('k', c->>'key', 'm', (c->>'max_points')::numeric) order by q.position, c->>'key') into v
    from public.assessment_questions q join public.assessment_rubrics r on r.id = q.rubric_id, jsonb_array_elements(r.criteria) c
   where q.assessment_id = (select id from public.assessments where title_en = 'Built task');
  assert v = '[{"k":"api","m":4},{"k":"tests","m":1.5},{"k":"report","m":3},{"k":"tests","m":1.5}]'::jsonb, 'split by task_refs: ' || v::text;
  assert (select count(distinct rubric_id) from public.assessment_questions q join public.assessments a on a.id = q.assessment_id where a.title_en = 'Built task') = 2, 'one rubric per question';
  assert (select bool_and(r.question_id = q.id and r.derived_from is not null) from public.assessment_questions q join public.assessment_rubrics r on r.id = q.rubric_id join public.assessments a on a.id = q.assessment_id where a.title_en = 'Built task'), 'question-scoped rubric records its question and origin';
end $$;
-- the original shared rubric is kept (non-destructive) and the split is idempotent
select (count(*) = 1) as kept from public.assessment_rubrics where id = :'shared' \gset
\if :kept
\else
  select 1/0;
\endif
select (public.split_shared_task_rubrics(:'built') = 0) as idempotent \gset
\if :idempotent
\else
  select 1/0;
\endif

-- A task already given to candidates is locked (0025): the split leaves it unchanged instead of failing.
insert into public.assessments (company_id, title_en, title_ar, duration_minutes, passing_score, status, ai_generated)
  values (:'co_a', 'Built task in use', 'مهمة مستخدمة', 60, 50, 'published', true) returning id as inuse \gset
insert into public.assessment_rubrics (assessment_id, title_en, title_ar, criteria) values (:'inuse', 'Practical rubric', 'معايير',
  '[{"key":"api","name_en":"API","name_ar":"API","max_points":4},{"key":"report","name_en":"Report","name_ar":"تقرير","max_points":3}]') returning id as inuse_r \gset
insert into public.assessment_questions (assessment_id, type, prompt_en, prompt_ar, points, position, rubric_id) values
  (:'inuse', 'coding', 'API', 'API', 4, 0, :'inuse_r'), (:'inuse', 'case_study', 'Report', 'تقرير', 3, 1, :'inuse_r');
insert into public.assessment_assessor_guides (assessment_id, company_id, guide) values (:'inuse', :'co_a',
  '{"rubric":[{"key":"api","task_refs":[0]},{"key":"report","task_refs":[1]}]}');
insert into public.applications (job_id, candidate_id, company_id, status) values (:'job_a', :'cand_1', :'co_a', 'under_review') on conflict do nothing;
insert into public.assessment_assignments (assessment_id, application_id, candidate_id, company_id, status)
  select :'inuse', a.id, :'cand_1', :'co_a', 'assigned' from public.applications a where a.job_id = :'job_a' and a.candidate_id = :'cand_1';
select (public.split_shared_task_rubrics(:'inuse') = 0) as inuse_skipped \gset
\if :inuse_skipped
\else
  select 1/0; -- an in-use task must not be split
\endif
select (count(distinct rubric_id) = 1) as inuse_unchanged from public.assessment_questions where assessment_id = :'inuse' \gset
\if :inuse_unchanged
\else
  select 1/0;
\endif

-- ================================================================== B. a task with distinct questions
insert into public.assessments (company_id, title_en, title_ar, duration_minutes, passing_score, status)
  values (:'co_a', 'Three part task', 'مهمة ثلاثية', 90, 50, 'published') returning id as asmt \gset
insert into public.assessment_rubrics (assessment_id, title_en, title_ar, criteria, question_id) values
  (:'asmt', 'Q1', 'س1', '[{"key":"schema","name_en":"Schema","name_ar":"المخطط","max_points":6},{"key":"indexes","name_en":"Indexes","name_ar":"الفهارس","max_points":4}]', null) returning id as r1 \gset
insert into public.assessment_rubrics (assessment_id, title_en, title_ar, criteria) values
  (:'asmt', 'Q2', 'س2', '[{"key":"endpoint","name_en":"Endpoint","name_ar":"نقطة النهاية","max_points":5},{"key":"tests","name_en":"Tests","name_ar":"الاختبارات","max_points":3}]') returning id as r2 \gset
insert into public.assessment_questions (assessment_id, type, prompt_en, prompt_ar, points, position, rubric_id)
  values (:'asmt', 'case_study', 'Design the orders schema', 'صمّم المخطط', 10, 0, :'r1') returning id as q1 \gset
insert into public.assessment_questions (assessment_id, type, prompt_en, prompt_ar, points, position, rubric_id)
  values (:'asmt', 'coding', 'Implement POST /orders', 'نفّذ نقطة الطلبات', 8, 1, :'r2') returning id as q2 \gset
insert into public.assessment_questions (assessment_id, type, prompt_en, prompt_ar, points, position)
  values (:'asmt', 'long_answer', 'Analyse the sales data', 'حلّل بيانات المبيعات', 6, 2) returning id as q3 \gset
insert into public.assessment_questions (assessment_id, type, prompt_en, prompt_ar, points, position)
  values (:'asmt', 'multiple_choice', 'Which index type?', 'أي نوع فهرس؟', 2, 3) returning id as q4 \gset
insert into public.assessment_options (question_id, label_en, label_ar, is_correct, position) values (:'q4', 'B-tree', 'B-tree', true, 0) returning id as opt_ok \gset
insert into public.assessment_options (question_id, label_en, label_ar, is_correct, position) values (:'q4', 'Hash', 'Hash', false, 1);
insert into public.assessment_questions (assessment_id, type, prompt_en, prompt_ar, points, position)
  values (:'asmt', 'long_answer', 'Explain your trade-offs', 'اشرح المفاضلات', 4, 4) returning id as q5 \gset
insert into public.applications (job_id, candidate_id, company_id, status) values (:'job_a', :'cand_1', :'co_a', 'under_review') on conflict do nothing;
select id as app_1 from public.applications where job_id = :'job_a' and candidate_id = :'cand_1' \gset
insert into public.assessment_assignments (assessment_id, application_id, candidate_id, company_id, status)
  values (:'asmt', :'app_1', :'cand_1', :'co_a', 'assigned') returning id as asg \gset

select pg_temp.login(:'cand_1');
set role authenticated;
select (public.start_assessment(:'asg') ->> 'submission_id') as sub \gset
-- 1. Each file is stored and registered under the exact question it answers (any open question type).
insert into storage.objects (bucket_id, name, owner, metadata) values
  ('assessment-attachments', :'cand_1' || '/' || :'sub' || '/' || :'q1' || '/a-schema.pdf', :'cand_1', '{"size": 3000, "mimetype": "application/pdf"}'),
  ('assessment-attachments', :'cand_1' || '/' || :'sub' || '/' || :'q2' || '/b-api.zip', :'cand_1', '{"size": 9000, "mimetype": "application/zip"}'),
  ('assessment-attachments', :'cand_1' || '/' || :'sub' || '/' || :'q3' || '/c-analysis.docx', :'cand_1', '{"size": 4000, "mimetype": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}'),
  ('assessment-attachments', :'cand_1' || '/' || :'sub' || '/' || :'q3' || '/d-chart.png', :'cand_1', '{"size": 5000, "mimetype": "image/png"}'),
  ('assessment-attachments', :'cand_1' || '/' || :'sub' || '/solution/e-legacy.pdf', :'cand_1', '{"size": 100, "mimetype": "application/pdf"}');
select public.register_assessment_file(:'asg', :'q1', :'cand_1' || '/' || :'sub' || '/' || :'q1' || '/a-schema.pdf', 'schema.pdf', 'application/pdf', 3000);
select public.register_assessment_file(:'asg', :'q2', :'cand_1' || '/' || :'sub' || '/' || :'q2' || '/b-api.zip', 'api.zip', 'application/zip', 9000);
select public.register_assessment_file(:'asg', :'q3', :'cand_1' || '/' || :'sub' || '/' || :'q3' || '/c-analysis.docx', 'analysis.docx', 'x', 1);
select public.register_assessment_file(:'asg', :'q3', :'cand_1' || '/' || :'sub' || '/' || :'q3' || '/d-chart.png', 'chart.png', 'image/png', 5000);
select public.register_task_solution_file(:'asg', :'cand_1' || '/' || :'sub' || '/solution/e-legacy.pdf', 'legacy.pdf', 'application/pdf', 100);
-- a path under question 1 cannot be registered against question 2
select pg_temp.expect_error(format($$select public.register_assessment_file('%s', '%s', '%s/%s/%s/a-schema.pdf', 'x', 'application/pdf', 1)$$, :'asg', :'q2', :'cand_1', :'sub', :'q1'), 'invalid file path');
-- objective questions never take files (storage rule and registration)
select pg_temp.expect_error(format($$insert into storage.objects (bucket_id, name, owner) values ('assessment-attachments', '%s/%s/%s/x.pdf', '%s')$$, :'cand_1', :'sub', :'q4', :'cand_1'), '%row-level security%');
-- answers
select public.save_assessment_answer(:'asg', :'q1', '{}', 'Orders table with FK to users', null);
select public.save_assessment_answer(:'asg', :'q2', '{}', 'See api.zip', null);
select public.save_assessment_answer(:'asg', :'q3', '{}', 'Revenue grew 12%', null);
select public.save_assessment_answer(:'asg', :'q4', array[:'opt_ok'::uuid], null, null);
select public.submit_assessment(:'asg');
reset role;

do $$ declare v jsonb; begin
  select jsonb_object_agg(q.position, (select count(*) from public.assessment_answer_files f where f.question_id = q.id))
    into v from public.assessment_questions q join public.assessments a on a.id = q.assessment_id where a.title_en = 'Three part task';
  assert v = '{"0":1,"1":1,"2":2,"3":0,"4":0}'::jsonb, 'files per question: ' || v::text;
  assert (select count(*) from public.assessment_answer_files f join public.assessment_submissions s on s.id = f.submission_id
           join public.assessment_assignments aa on aa.id = s.assignment_id join public.assessments a on a.id = aa.assessment_id
          where a.title_en = 'Three part task' and f.question_id is null) = 1, 'legacy file stays unlinked';
  -- after submit: objective q4 auto-scored, 4 open questions pending
  assert (select s.auto_score = 2 and s.needs_review and s.percentage is null from public.assessment_submissions s
            join public.assessment_assignments aa on aa.id = s.assignment_id join public.assessments a on a.id = aa.assessment_id
           where a.title_en = 'Three part task'), 'auto 2, review pending';
end $$;

-- ================================================================== C. AI evaluations: recruiter-only, per question
select pg_temp.login(:'rec_a');
set role authenticated;
select public.record_ai_question_evaluation(:'sub', :'q1', jsonb_build_object('status', 'completed', 'rubric_source', 'employer_question', 'score', 9,
  'criteria', '[{"key":"schema","score":6},{"key":"indexes","score":3}]'::jsonb, 'files', jsonb_build_array(jsonb_build_object('file_name', 'schema.pdf')),
  'requirements', '[{"requirement":"FK to users","status":"fulfilled"}]'::jsonb, 'answer_present', true)) as ai1 \gset
select public.record_ai_question_evaluation(:'sub', :'q2', jsonb_build_object('status', 'completed', 'rubric_source', 'employer_question', 'score', 4,
  'requirements', '[{"requirement":"tests","status":"missing"}]'::jsonb)) as ai2 \gset
select public.record_ai_question_evaluation(:'sub', :'q5', jsonb_build_object('status', 'no_submission', 'rubric_source', 'ai_derived', 'score', 0)) as ai5 \gset
-- a score above the question's points is refused; the maximum always comes from the question
select pg_temp.expect_error(format($$select public.record_ai_question_evaluation('%s', '%s', '{"status":"completed","score":9}')$$, :'sub', :'q2'), 'score must be between 0 and 8');
do $$ begin
  assert (select max_score from public.assessment_ai_evaluations where question_id = (select id from public.assessment_questions where prompt_en = 'Implement POST /orders')) = 8, 'max from question';
  assert (select count(*) from public.assessment_ai_evaluations) = 3, 'recruiter reads its AI evaluations';
end $$;
-- 2/3. evaluations never mix: a question's review cannot reuse another question's AI result
select pg_temp.expect_error(format($$select public.review_assessment_question('%s', '%s', 3, '{}', null, null, '%s')$$, :'sub', :'q3', :'ai1'), 'the AI evaluation belongs to a different question');
select public.review_assessment_question(:'sub', :'q1', 9, '{"schema":6,"indexes":3}', 'private note q1',
  '{"strengths":"Clear FK design","missing":"No index on user_id","improvements":"Add composite index","secret":"dropped"}', :'ai1');
select public.review_assessment_question(:'sub', :'q2', 5, '{"endpoint":4,"tests":1}', 'private note q2', '{"missing":"No tests"}', :'ai2');
select public.review_assessment_question(:'sub', :'q3', 3, '{}', null, '{"strengths":"Correct growth figure"}', null);
-- human adjustment of an automatically scored question replaces its automatic score
select public.review_assessment_question(:'sub', :'q4', 1, '{}', 'partial credit', null, null);
do $$ begin
  assert (select string_agg(e.source, ',' order by q.position) from public.assessment_evaluations e join public.assessment_questions q on q.id = e.question_id
           where q.assessment_id = (select id from public.assessments where title_en = 'Three part task')) = 'ai_accepted,ai_adjusted,human,human', 'AI vs human source per question';
  assert (select e.candidate_feedback = '{"strengths":"Clear FK design","missing":"No index on user_id","improvements":"Add composite index"}'::jsonb
            from public.assessment_evaluations e join public.assessment_questions q on q.id = e.question_id where q.prompt_en = 'Design the orders schema'), 'feedback keys whitelisted';
  -- q5 still pending → no percentage yet, nothing counted for it
  assert (select s.needs_review and s.percentage is null and s.auto_score = 0 and s.manual_score = 18 from public.assessment_submissions s
            join public.assessment_assignments aa on aa.id = s.assignment_id join public.assessments a on a.id = aa.assessment_id
           where a.title_en = 'Three part task'), 'pending until every open question is reviewed; no double counting of q4';
end $$;
select public.review_assessment_question(:'sub', :'q5', 0, '{}', null, '{"missing":"Nothing was submitted"}', :'ai5');
-- 11. overall = Σ approved question scores / Σ question points = (9+5+3+1+0) / (10+8+6+2+4) = 60 %
do $$ begin
  assert (select s.status = 'evaluated' and not s.needs_review and s.auto_score = 0 and s.manual_score = 18 and s.max_score = 30 and s.percentage = 60.00
            from public.assessment_submissions s join public.assessment_assignments aa on aa.id = s.assignment_id
            join public.assessments a on a.id = aa.assessment_id where a.title_en = 'Three part task'), 'weighted overall score';
end $$;
-- re-scoring keeps an audit trail; the original AI evaluation is untouched
select public.review_assessment_question(:'sub', :'q2', 6, '{"endpoint":5,"tests":1}', 'raised after reading the tests', '{"missing":"Few tests"}', :'ai2');
do $$ begin
  assert (select count(*) from public.assessment_evaluation_history h join public.assessment_questions q on q.id = h.question_id where q.prompt_en = 'Implement POST /orders') = 2, 'two history rows for q2';
  assert (select h.previous_points = 5 and h.points = 6 and h.action = 'updated' from public.assessment_evaluation_history h join public.assessment_questions q on q.id = h.question_id
           where q.prompt_en = 'Implement POST /orders' order by h.id desc limit 1), 'change recorded with previous value';
  assert (select a.score = 4 from public.assessment_ai_evaluations a join public.assessment_questions q on q.id = a.question_id where q.prompt_en = 'Implement POST /orders'), 'AI result preserved';
  assert (select s.percentage = 63.33 from public.assessment_submissions s join public.assessment_assignments aa on aa.id = s.assignment_id
           join public.assessments a on a.id = aa.assessment_id where a.title_en = 'Three part task'), 'recomputed after change';
end $$;
-- the original entry point still works and keeps the candidate feedback
select public.evaluate_assessment_answer(:'sub', :'q3', 4, '{}', 'legacy path');
do $$ begin
  assert (select e.points = 4 and e.candidate_feedback ->> 'strengths' = 'Correct growth figure' from public.assessment_evaluations e
            join public.assessment_questions q on q.id = e.question_id where q.prompt_en = 'Analyse the sales data'), 'legacy evaluate keeps feedback';
end $$;
reset role;

-- ================================================================== D. who can see what
-- Another company's recruiter: nothing, and cannot record AI evaluations or reviews.
select pg_temp.login(:'rec_b');
set role authenticated;
select set_config('t.sub', :'sub', false);
do $$ begin
  assert (select count(*) from public.assessment_ai_evaluations where submission_id = current_setting('t.sub')::uuid) = 0, 'other company: no AI evaluations';
  assert (select count(*) from public.assessment_evaluation_history where submission_id = current_setting('t.sub')::uuid) = 0, 'other company: no history of this submission';
  assert (select count(*) from public.assessment_evaluations where submission_id = current_setting('t.sub')::uuid) = 0, 'other company: no reviews of this submission';
end $$;
select pg_temp.expect_error(format($$select public.record_ai_question_evaluation('%s', '%s', '{"status":"completed","score":1}')$$, :'sub', :'q1'), 'not authorized');
select pg_temp.expect_error(format($$select public.review_assessment_question('%s', '%s', 1)$$, :'sub', :'q1'), 'not authorized');
reset role;

-- The candidate: no AI evaluations, no reviewer notes, no history; per-question results only through the result RPC.
select pg_temp.login(:'cand_1');
set role authenticated;
do $$ declare r jsonb; begin
  assert (select count(*) from public.assessment_ai_evaluations) = 0, 'candidate: no AI evaluations';
  assert (select count(*) from public.assessment_evaluations) = 0, 'candidate: no reviewer rows (private notes)';
  assert (select count(*) from public.assessment_evaluation_history) = 0, 'candidate: no history';
  r := public.get_assessment_result((select id from public.assessment_assignments where assessment_id = (select id from public.assessments where title_en = 'Three part task')));
  assert (r -> 'submission' ->> 'percentage')::numeric = 66.67, 'overall shown (9+6+4+1+0)/30';
  assert (select bool_and(q -> 'feedback' = 'null'::jsonb) from jsonb_array_elements(r -> 'questions') q), 'feedback hidden until shared';
  assert (select string_agg(jsonb_array_length(q -> 'files')::text, ',') from jsonb_array_elements(r -> 'questions') q) = '1,1,2,0,0', 'files by question';
  assert jsonb_array_length(r -> 'unlinked_files') = 1, 'legacy unlinked file listed separately';
  assert r::text not like '%private note%' and r::text not like '%ai_evaluation%', 'no private notes or AI data';
end $$;
reset role;
select pg_temp.login(:'rec_a');
set role authenticated;
select public.share_assessment_feedback(:'sub', 'Good work overall');
reset role;
select pg_temp.login(:'cand_1');
set role authenticated;
do $$ declare r jsonb; begin
  r := public.get_assessment_result((select id from public.assessment_assignments where assessment_id = (select id from public.assessments where title_en = 'Three part task')));
  assert (r -> 'questions' -> 0 -> 'feedback' ->> 'missing') = 'No index on user_id', 'q1 feedback after sharing';
  assert (r -> 'questions' -> 1 -> 'feedback' ->> 'missing') = 'Few tests', 'q2 feedback is its own';
  assert (r -> 'questions' -> 1 -> 'answer' ->> 'points_awarded')::numeric = 6, 'q2 approved score';
  assert (r -> 'questions' -> 3 ->> 'auto_scored')::boolean and (r -> 'questions' -> 3 ->> 'reviewed')::boolean, 'q4 auto-scored and adjusted';
end $$;
reset role;

-- Anonymous: nothing callable.
set role anon;
select pg_temp.expect_error($$select public.record_ai_question_evaluation(gen_random_uuid(), gen_random_uuid(), '{}')$$, '%permission denied%');
select pg_temp.expect_error($$select public.review_assessment_question(gen_random_uuid(), gen_random_uuid(), 1)$$, '%permission denied%');
reset role;

rollback;
\echo 'question-level evaluation: all checks passed'
