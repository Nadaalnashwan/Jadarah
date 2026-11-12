-- Disposable local database only (tests/db/run-local.sh). Task Solution Files (migration 0032), exercised as real
-- roles: `set role authenticated` + request.jwt.claims, exactly how PostgREST runs requests.
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
select r.user_id as cand_2 from public.user_roles r join public.profiles p on p.id = r.user_id where r.role = 'candidate' and p.account_type = 'candidate' order by p.email offset 1 limit 1 \gset

-- 1. Employer assigns a task (no file_upload question: solution files are independent of questions).
select id as job_a from public.jobs where company_id = :'co_a' order by created_at limit 1 \gset
insert into public.assessments (company_id, title_en, title_ar, duration_minutes, passing_score, status)
  values (:'co_a', 'Solution task', 'مهمة حل', 60, 50, 'published') returning id as asmt \gset
insert into public.assessment_questions (assessment_id, type, prompt_en, prompt_ar, points, position)
  values (:'asmt', 'long_answer', 'Describe your approach', 'اشرح منهجك', 10, 1);
insert into public.applications (job_id, candidate_id, company_id, status)
  values (:'job_a', :'cand_1', :'co_a', 'under_review') on conflict do nothing;
select id as app_1 from public.applications where job_id = :'job_a' and candidate_id = :'cand_1' \gset
insert into public.assessment_assignments (assessment_id, application_id, candidate_id, company_id, status)
  values (:'asmt', :'app_1', :'cand_1', :'co_a', 'assigned') returning id as asg \gset

-- 2. Candidate opens the task.
select pg_temp.login(:'cand_1');
set role authenticated;
select (public.start_assessment(:'asg') ->> 'submission_id') as sub \gset

-- 3–6. Uploads: PDF, DOCX, ZIP and a legacy DOC (multiple files), stored under <uid>/<submission>/solution/.
insert into storage.objects (bucket_id, name, owner, metadata) values
  ('assessment-attachments', :'cand_1' || '/' || :'sub' || '/solution/a1-report.pdf', :'cand_1', '{"size": 2048, "mimetype": "application/pdf"}'),
  ('assessment-attachments', :'cand_1' || '/' || :'sub' || '/solution/a2-notes.docx', :'cand_1', '{"size": 4096, "mimetype": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}'),
  ('assessment-attachments', :'cand_1' || '/' || :'sub' || '/solution/a3-code.zip', :'cand_1', '{"size": 9000, "mimetype": "application/zip"}'),
  ('assessment-attachments', :'cand_1' || '/' || :'sub' || '/solution/a4-old.doc', :'cand_1', '{"size": 1000, "mimetype": "application/msword"}');
select public.register_task_solution_file(:'asg', :'cand_1' || '/' || :'sub' || '/solution/a1-report.pdf', 'report.pdf', 'application/pdf', 2048) as f_pdf \gset
select public.register_task_solution_file(:'asg', :'cand_1' || '/' || :'sub' || '/solution/a2-notes.docx', 'notes.docx', 'x', 1) as f_docx \gset
select public.register_task_solution_file(:'asg', :'cand_1' || '/' || :'sub' || '/solution/a3-code.zip', 'code.zip', 'application/zip', 9000) as f_zip \gset
select public.register_task_solution_file(:'asg', :'cand_1' || '/' || :'sub' || '/solution/a4-old.doc', 'old.doc', 'application/msword', 1000) as f_doc \gset
do $$ begin
  assert (select count(*) from public.assessment_answer_files where kind = 'solution' and question_id is null) = 4, 'four solution files persisted';
  -- storage metadata wins over the client-declared type/size
  assert (select mime_type from public.assessment_answer_files where file_name = 'notes.docx')
    = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'mime from storage metadata';
end $$;

-- Validation: disallowed type, wrong path shape, another candidate's folder, unknown object.
insert into storage.objects (bucket_id, name, owner, metadata)
  values ('assessment-attachments', :'cand_1' || '/' || :'sub' || '/solution/evil.exe', :'cand_1', '{"size": 10, "mimetype": "application/x-msdownload"}');
select pg_temp.expect_error(format($$select public.register_task_solution_file('%s', '%s/%s/solution/evil.exe', 'evil.exe', 'application/pdf', 10)$$, :'asg', :'cand_1', :'sub'), 'file type is not allowed');
select pg_temp.expect_error(format($$select public.register_task_solution_file('%s', '%s/%s/other/x.pdf', 'x.pdf', 'application/pdf', 10)$$, :'asg', :'cand_1', :'sub'), 'invalid file path');
select pg_temp.expect_error(format($$select public.register_task_solution_file('%s', '%s/%s/solution/missing.pdf', 'm.pdf', 'application/pdf', 10)$$, :'asg', :'cand_1', :'sub'), 'uploaded file not found');
-- storage write rules: not into a random submission, not into someone else's folder
select pg_temp.expect_error(format($$insert into storage.objects (bucket_id, name, owner) values ('assessment-attachments', '%s/%s/solution/a.pdf', '%s')$$, :'cand_1', gen_random_uuid(), :'cand_1'), '%row-level security%');
select pg_temp.expect_error(format($$insert into storage.objects (bucket_id, name, owner) values ('assessment-attachments', '%s/%s/solution/a.pdf', '%s')$$, :'cand_2', :'sub', :'cand_1'), '%row-level security%');
reset role;

-- Another candidate cannot register into, list or read this submission.
select pg_temp.login(:'cand_2');
set role authenticated;
select pg_temp.expect_error(format($$select public.register_task_solution_file('%s', '%s/%s/solution/a1-report.pdf', 'r.pdf', 'application/pdf', 1)$$, :'asg', :'cand_1', :'sub'), 'attempt not found');
do $$ begin
  assert (select count(*) from public.assessment_answer_files where kind = 'solution') = 0, 'cand_2 sees no solution rows';
  assert (select count(*) from storage.objects where name like '%/solution/%') = 0, 'cand_2 reads no solution objects';
end $$;
reset role;

-- 7. Remove / replace before submission.
select pg_temp.login(:'cand_1');
set role authenticated;
select public.remove_assessment_file(:'f_doc') as removed_path \gset
do $$ begin assert (select count(*) from public.assessment_answer_files where kind = 'solution') = 3, 'removed before submission'; end $$;
delete from storage.objects where name = :'removed_path';
insert into storage.objects (bucket_id, name, owner, metadata)
  values ('assessment-attachments', :'cand_1' || '/' || :'sub' || '/solution/a5-new.doc', :'cand_1', '{"size": 1200, "mimetype": "application/msword"}');
select public.register_task_solution_file(:'asg', :'cand_1' || '/' || :'sub' || '/solution/a5-new.doc', 'new.doc', 'application/msword', 1200);

-- 8. Submit; afterwards files are frozen (no removal, no new uploads).
select public.submit_assessment(:'asg');
select pg_temp.expect_error(format($$select public.remove_assessment_file('%s')$$, :'f_pdf'), 'this assessment has already been submitted');
select pg_temp.expect_error(format($$insert into storage.objects (bucket_id, name, owner) values ('assessment-attachments', '%s/%s/solution/late.pdf', '%s')$$, :'cand_1', :'sub', :'cand_1'), '%row-level security%');
-- 14. still there after "refresh" (a new read)
do $$ begin assert (select count(*) from public.assessment_answer_files where kind = 'solution') = 4, 'files persist after submission'; end $$;
reset role;
-- 13. Submission status and timestamp are recorded.
select (status::text <> 'in_progress' and submitted_at is not null) as submitted_ok from public.assessment_submissions where id = :'sub' \gset
\if :submitted_ok
\else
  select 1/0; -- submission status/timestamp not recorded
\endif

-- 11. The hiring company's recruiter can list and read the files.
select pg_temp.login(:'rec_a');
set role authenticated;
do $$ begin
  assert (select count(*) from public.assessment_answer_files where kind = 'solution') = 4, 'recruiter of the company sees the solution files';
  assert (select count(*) from storage.objects where name like '%/solution/%' and bucket_id = 'assessment-attachments') >= 4, 'recruiter can read the objects (signed URLs)';
end $$;
reset role;

-- 12. A recruiter of another company cannot.
select pg_temp.login(:'rec_b');
set role authenticated;
do $$ begin
  assert (select count(*) from public.assessment_answer_files where kind = 'solution') = 0, 'other company sees nothing';
  assert (select count(*) from storage.objects where name like '%/solution/%') = 0, 'other company reads no objects';
end $$;
reset role;

-- Anonymous callers cannot call the RPC at all.
set role anon;
select pg_temp.expect_error($$select public.register_task_solution_file(gen_random_uuid(), 'x', 'x', 'x', 1)$$, '%permission denied%');
reset role;

-- Existing per-question answer files keep working (kind defaults to 'answer' and requires a question).
select pg_temp.expect_error(format($$insert into public.assessment_answer_files (submission_id, question_id, candidate_id, storage_path, file_name, mime_type, size_bytes) values ('%s', null, '%s', 'x/y', 'f', 'application/pdf', 1)$$, :'sub', :'cand_1'), '%assessment_answer_files_kind_question%');

rollback;
\echo 'task solution files: all checks passed'
