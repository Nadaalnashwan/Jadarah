-- Disposable local database only (tests/db/run-local.sh). Exercises migration 0029 as real roles:
-- `set role authenticated` + request.jwt.claims, exactly how PostgREST runs requests.
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
select m.user_id as adm_a from public.company_memberships m where m.company_id = :'co_a' and m.role = 'company_admin' and m.status = 'active' limit 1 \gset
select m.user_id as int_a from public.company_memberships m where m.company_id = :'co_a' and m.role = 'interviewer' and m.status = 'active' limit 1 \gset
select m.user_id as rec_b from public.company_memberships m where m.company_id = :'co_b' and m.role = 'recruiter' and m.status = 'active' limit 1 \gset
select r.user_id as cand_1 from public.user_roles r join public.profiles p on p.id = r.user_id where r.role = 'candidate' and p.account_type = 'candidate' order by p.email limit 1 \gset
select r.user_id as cand_2 from public.user_roles r join public.profiles p on p.id = r.user_id where r.role = 'candidate' and p.account_type = 'candidate' order by p.email offset 1 limit 1 \gset

-- A job of company A with an application from cand_1 and a published task with a file_upload question.
select id as job_a from public.jobs where company_id = :'co_a' order by created_at limit 1 \gset
insert into public.assessments (company_id, title_en, title_ar, duration_minutes, passing_score, status)
  values (:'co_a', 'Upload task', 'مهمة رفع', 60, 50, 'published') returning id as asmt \gset
insert into public.assessment_questions (assessment_id, type, prompt_en, prompt_ar, points, position)
  values (:'asmt', 'file_upload', 'Upload your report', 'ارفع تقريرك', 10, 1) returning id as q_file \gset
insert into public.assessment_questions (assessment_id, type, prompt_en, prompt_ar, points, position)
  values (:'asmt', 'long_answer', 'Explain', 'اشرح', 5, 2) returning id as q_text \gset
insert into public.applications (job_id, candidate_id, company_id, status)
  values (:'job_a', :'cand_1', :'co_a', 'under_review')
  on conflict do nothing;
select id as app_1 from public.applications where job_id = :'job_a' and candidate_id = :'cand_1' \gset
insert into public.assessment_assignments (assessment_id, application_id, candidate_id, company_id, status)
  values (:'asmt', :'app_1', :'cand_1', :'co_a', 'assigned') returning id as asg \gset

-- Server key (hash only), as the owner would register it.
insert into private.service_keys (name, key_hash)
  values ('web', encode(sha256(convert_to('local-test-server-key-0123456789abcdef', 'UTF8')), 'hex'));

-- ------------------------------------------------------------------ 1. server key + shared rate limit
set role anon;
select pg_temp.expect_error($$select public.internal_rate_limit('wrong-key-wrong-key-wrong-key-0000', 'k', 3, 60)$$, 'not authorized');
do $$ declare r boolean[] := '{}'; i int; begin
  for i in 1..4 loop r := r || public.internal_rate_limit('local-test-server-key-0123456789abcdef', 'signin:abc', 3, 60); end loop;
  assert r = array[true, true, true, false], 'limit 3 → 4th call refused, got ' || r::text;
end $$;
select pg_temp.expect_error($$select * from private.rate_limits$$, '%permission denied%');
select pg_temp.expect_error($$select public.register_assessment_file(gen_random_uuid(), gen_random_uuid(), 'x', 'x', 'x', 1)$$, '%permission denied%');
do $$ begin assert (public.health_ping() ->> 'ok')::boolean; end $$;
reset role;

-- AI cooldowns are shared and only extend.
set role anon;
select public.internal_ai_cooldown_note('local-test-server-key-0123456789abcdef', 'gemini:m:fp', 600, 'quota');
select public.internal_ai_cooldown_note('local-test-server-key-0123456789abcdef', 'gemini:m:fp', 60, 'timeout');
do $$ begin
  assert (select until > now() + interval '9 minutes' from public.internal_ai_cooldowns('local-test-server-key-0123456789abcdef') where key = 'gemini:m:fp'), 'cooldown must not shrink';
end $$;
reset role;

-- ------------------------------------------------------------------ 2. assessment files
select pg_temp.login(:'cand_1');
set role authenticated;
select (public.start_assessment(:'asg') ->> 'submission_id') as sub \gset
reset role;
-- storage metadata as the storage server would set it
select pg_temp.login(:'cand_1');
set role authenticated;
insert into storage.objects (bucket_id, name, owner, metadata)
  values ('assessment-attachments', :'cand_1' || '/' || :'sub' || '/' || :'q_file' || '/report.pdf', :'cand_1', '{"size": 2048, "mimetype": "application/pdf"}');
-- wrong question type, other submission, other prefix → refused by storage policy
select pg_temp.expect_error(format($$insert into storage.objects (bucket_id, name, owner) values ('assessment-attachments', '%s/%s/%s/a.pdf', '%s')$$, :'cand_1', :'sub', :'q_text', :'cand_1'), '%row-level security%');
select pg_temp.expect_error(format($$insert into storage.objects (bucket_id, name, owner) values ('assessment-attachments', '%s/%s/%s/a.pdf', '%s')$$, :'cand_1', gen_random_uuid(), :'q_file', :'cand_1'), '%row-level security%');
select pg_temp.expect_error(format($$insert into storage.objects (bucket_id, name, owner) values ('assessment-attachments', '%s/%s/%s/a.pdf', '%s')$$, :'cand_2', :'sub', :'q_file', :'cand_1'), '%row-level security%');
select public.register_assessment_file(:'asg', :'q_file', :'cand_1' || '/' || :'sub' || '/' || :'q_file' || '/report.pdf', 'report.pdf', 'application/pdf', 2048) as file_1 \gset
-- registering twice is idempotent
do $$ begin assert (select count(*) from public.assessment_answer_files) = 1; end $$;
select pg_temp.expect_error(format($$select public.register_assessment_file('%s', '%s', '%s/%s/%s/nothere.pdf', 'n.pdf', 'application/pdf', 10)$$, :'asg', :'q_file', :'cand_1', :'sub', :'q_file'), 'uploaded file not found');
select pg_temp.expect_error(format($$select public.register_assessment_file('%s', '%s', '%s/%s/%s/report.pdf', 'r', 'application/pdf', 10)$$, :'asg', :'q_text', :'cand_1', :'sub', :'q_text'), 'this question does not accept files');
select pg_temp.expect_error(format($$select public.register_assessment_file('%s', '%s', '../%s/x.pdf', 'r', 'application/pdf', 10)$$, :'asg', :'q_file', :'sub'), 'invalid file path');
-- executable disguised as allowed name → storage metadata decides
insert into storage.objects (bucket_id, name, owner, metadata)
  values ('assessment-attachments', :'cand_1' || '/' || :'sub' || '/' || :'q_file' || '/evil.pdf', :'cand_1', '{"size": 10, "mimetype": "application/x-msdownload"}');
select pg_temp.expect_error(format($$select public.register_assessment_file('%s', '%s', '%s/%s/%s/evil.pdf', 'evil.pdf', 'application/pdf', 10)$$, :'asg', :'q_file', :'cand_1', :'sub', :'q_file'), 'file type is not allowed');
-- cannot delete a registered file's object directly
delete from storage.objects where name = :'cand_1' || '/' || :'sub' || '/' || :'q_file' || '/report.pdf';
do $$ begin assert (select count(*) from storage.objects where name like '%/report.pdf') = 1, 'registered object must survive direct delete'; end $$;
-- the unregistered one can be cleaned up by its owner
delete from storage.objects where name = :'cand_1' || '/' || :'sub' || '/' || :'q_file' || '/evil.pdf';
reset role;
do $$ begin assert (select count(*) from storage.objects where name like '%/evil.pdf') = 0, 'owner cleanup of unregistered object'; end $$;

-- other candidate sees nothing
select pg_temp.login(:'cand_2');
set role authenticated;
do $$ begin
  assert (select count(*) from public.assessment_answer_files) = 0, 'cand_2 must not see files';
  assert (select count(*) from storage.objects where bucket_id = 'assessment-attachments') = 0, 'cand_2 must not read objects';
end $$;
select pg_temp.expect_error(format($$select public.remove_assessment_file('%s')$$, :'file_1'), 'file not found');
reset role;

-- recruiter of company A sees it; recruiter of company B does not; interviewer without an interview does not
select pg_temp.login(:'rec_a');
set role authenticated;
do $$ begin
  assert (select count(*) from public.assessment_answer_files) = 1, 'rec_a sees the file row';
  assert (select count(*) from storage.objects where bucket_id = 'assessment-attachments' and name like '%/report.pdf') = 1, 'rec_a reads the object';
end $$;
reset role;
select pg_temp.login(:'rec_b');
set role authenticated;
do $$ begin
  assert (select count(*) from public.assessment_answer_files) = 0, 'rec_b must not see files';
  assert (select count(*) from storage.objects where bucket_id = 'assessment-attachments') = 0, 'rec_b must not read objects';
end $$;
reset role;
select pg_temp.login(:'int_a');
set role authenticated;
do $$ begin assert (select count(*) from public.assessment_answer_files) = 0, 'unassigned interviewer must not see files'; end $$;
reset role;

-- limit: 5 files per question
select pg_temp.login(:'cand_1');
set role authenticated;
select set_config('t.c', :'cand_1', false), set_config('t.s', :'sub', false), set_config('t.q', :'q_file', false), set_config('t.a', :'asg', false);
do $$ declare i int; v_c text := current_setting('t.c'); v_sub text := current_setting('t.s'); v_q text := current_setting('t.q');
  v_a uuid := current_setting('t.a')::uuid; begin
  for i in 2..6 loop
    insert into storage.objects (bucket_id, name, owner, metadata) values ('assessment-attachments', v_c || '/' || v_sub || '/' || v_q || '/f' || i || '.png', auth.uid(), '{"size": 5, "mimetype": "image/png"}');
  end loop;
  for i in 2..5 loop
    perform public.register_assessment_file(v_a, v_q::uuid, v_c || '/' || v_sub || '/' || v_q || '/f' || i || '.png', 'f.png', 'image/png', 5);
  end loop;
  begin
    perform public.register_assessment_file(v_a, v_q::uuid, v_c || '/' || v_sub || '/' || v_q || '/f6.png', 'f.png', 'image/png', 5);
    raise exception 'sixth file accepted';
  exception when others then assert sqlerrm = 'you can attach up to 5 files', sqlerrm; end;
end $$;
-- remove through the RPC, then the object can go
select public.remove_assessment_file(:'file_1') as removed_path \gset
delete from storage.objects where name = :'removed_path';
reset role;
do $$ begin assert (select count(*) from storage.objects where name like '%/report.pdf') = 0, 'object deleted after RPC removal'; end $$;
select pg_temp.login(:'cand_1');
set role authenticated;
select (file_path like '%/f2.png') as kept from public.assessment_answers where submission_id = :'sub' and question_id = :'q_file' \gset
\if :kept
\else
  select 1/0 as "answer must keep a remaining file";
\endif
-- submit → files are frozen
select public.submit_assessment(:'asg');
select pg_temp.expect_error(format($$select public.remove_assessment_file((select id from public.assessment_answer_files where submission_id = '%s' limit 1))$$, :'sub'), 'this assessment has already been submitted');
reset role;

-- ------------------------------------------------------------------ 3. interview attachments
select i.id as iv, i.company_id as iv_co, a.candidate_id as iv_cand from public.interviews i join public.applications a on a.id = i.application_id
  where i.status = 'scheduled' and i.company_id = :'co_a' limit 1 \gset
select ip.user_id as iv_int from public.interview_participants ip where ip.interview_id = :'iv' limit 1 \gset
select pg_temp.login(:'rec_a');
set role authenticated;
insert into storage.objects (bucket_id, name, owner, metadata) values ('interview-attachments', :'iv_co' || '/' || :'iv' || '/a1-brief.pdf', :'rec_a', '{"size": 100, "mimetype": "application/pdf"}');
select public.register_interview_attachment(:'iv', :'iv_co' || '/' || :'iv' || '/a1-brief.pdf', 'brief.pdf', 'application/pdf', 100, false) as att_1 \gset
reset role;
-- candidate cannot see the internal document; can after sharing
select pg_temp.login(:'iv_cand');
set role authenticated;
do $$ begin
  assert (select count(*) from public.interview_attachments) = 0, 'internal attachment hidden from candidate';
  assert (select count(*) from storage.objects where bucket_id = 'interview-attachments') = 0, 'internal object hidden from candidate';
end $$;
select pg_temp.expect_error(format($$select public.set_interview_attachment_shared('%s', true)$$, :'att_1'), 'not authorized');
reset role;
select pg_temp.login(:'iv_int');
set role authenticated;
do $$ begin assert (select count(*) from public.interview_attachments) = 1, 'assigned interviewer sees it'; end $$;
select public.set_interview_attachment_shared(:'att_1', true);
reset role;
select pg_temp.login(:'iv_cand');
set role authenticated;
do $$ begin
  assert (select count(*) from public.interview_attachments) = 1, 'shared attachment visible to candidate';
  assert (select count(*) from storage.objects where bucket_id = 'interview-attachments') = 1, 'shared object readable by candidate';
  assert exists (select 1 from public.notifications where kind = 'interview_attachment' and user_id = auth.uid()), 'candidate notified';
end $$;
-- candidate can add their own document while scheduled; cannot write into another interview's folder
insert into storage.objects (bucket_id, name, owner, metadata) values ('interview-attachments', :'iv_co' || '/' || :'iv' || '/c1-portfolio.pdf', :'iv_cand', '{"size": 50, "mimetype": "application/pdf"}');
select public.register_interview_attachment(:'iv', :'iv_co' || '/' || :'iv' || '/c1-portfolio.pdf', 'portfolio.pdf', 'application/pdf', 50, false);
select pg_temp.expect_error(format($$insert into storage.objects (bucket_id, name, owner) values ('interview-attachments', '%s/%s/x.pdf', '%s')$$, :'iv_co', gen_random_uuid(), :'iv_cand'), '%row-level security%');
select pg_temp.expect_error(format($$select public.remove_interview_attachment('%s')$$, :'att_1'), 'not authorized');
reset role;
select pg_temp.login(:'rec_b');
set role authenticated;
do $$ begin
  assert (select count(*) from public.interview_attachments) = 0, 'other company sees no attachments';
  assert (select count(*) from storage.objects where bucket_id = 'interview-attachments') = 0, 'other company reads no objects';
end $$;
select pg_temp.expect_error(format($$select public.register_interview_attachment('%s', '%s/%s/z.pdf', 'z', 'application/pdf', 1, false)$$, :'iv', :'iv_co', :'iv'), 'not authorized');
reset role;

-- ------------------------------------------------------------------ 4. email outbox + invitations
-- A real (non-demo) user gets queued email; demo identities are suppressed.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (gen_random_uuid(), 'new.recruiter@company-example.sa', now(), '{"full_name": "New Recruiter", "locale": "en"}') returning id as newbie \gset
select public.notify(:'newbie', 'application_status', 'Update', 'تحديث', 'Body', 'نص', '/candidate');
do $$ begin
  assert (select status from public.email_outbox o join public.notifications n on n.id = o.notification_id
          where n.user_id = (select id from public.profiles where email = 'new.recruiter@company-example.sa')) = 'queued', 'real user queued';
end $$;
select pg_temp.login(:'adm_a');
set role authenticated;
select public.invite_company_member(:'co_a', 'NEW.Recruiter@company-example.sa', 'recruiter') as inv \gset
select pg_temp.expect_error(format($$select public.invite_company_member('%s', 'new.recruiter@company-example.sa', 'recruiter')$$, :'co_a'), '%duplicate key%');
reset role;
select token as inv_token from public.company_invitations where id = :'inv' \gset
do $$ begin
  assert (select count(*) from public.email_outbox where template = 'company_invitation' and status = 'queued') = 1, 'invitation email queued';
  assert (select payload ? 'token' from public.email_outbox where template = 'company_invitation'), 'invitation carries token';
end $$;
-- worker: claim → fail (retryable) → requeued with backoff → claim again later → sent
set role anon;
select id as em from public.internal_claim_emails('local-test-server-key-0123456789abcdef', 10) where template = 'company_invitation' \gset
do $$ begin assert (select count(*) from public.internal_claim_emails('local-test-server-key-0123456789abcdef', 10)) = 0, 'a leased email is not claimed twice'; end $$;
select public.internal_complete_email('local-test-server-key-0123456789abcdef', :'em', false, 'smtp', null, 'smtp_timeout', true);
reset role;
do $$ begin assert (select status = 'queued' and next_attempt_at > now() and attempts = 1 from public.email_outbox where template = 'company_invitation'), 'retry with backoff'; end $$;
update public.email_outbox set next_attempt_at = now() - interval '1 second' where template = 'company_invitation';
set role anon;
select id as em2 from public.internal_claim_emails('local-test-server-key-0123456789abcdef', 10) where template = 'company_invitation' \gset
select public.internal_complete_email('local-test-server-key-0123456789abcdef', :'em2', true, 'smtp', '<m1@jadarah>', null, false);
do $$ begin assert public.internal_complete_email('local-test-server-key-0123456789abcdef', (select gen_random_uuid()), true, 'smtp', 'x', null, false) = 'ignored'; end $$;
select pg_temp.expect_error($$select * from public.email_outbox$$, '%permission denied%');
reset role;
do $$ begin assert (select status = 'sent' and attempts = 2 from public.email_outbox where template = 'company_invitation'), 'sent once, no duplicate row'; end $$;

-- invitation link: other user, unconfirmed user, correct user
select pg_temp.login(:'cand_2');
set role authenticated;
do $$ begin assert (select count(*) from public.company_invitations) = 0, 'candidate cannot list invitations of others'; end $$;
select for_current_user as other_match from public.invitation_preview(:'inv_token') \gset
select pg_temp.expect_error(format($$select public.accept_company_invitation_by_token('%s')$$, :'inv_token'), 'this invitation was sent to a different email address');
select pg_temp.expect_error(format($$select public.accept_company_invitation_by_token('%s')$$, gen_random_uuid()), 'invitation not found');
reset role;
update auth.users set email_confirmed_at = null where id = :'newbie';
select pg_temp.login(:'newbie');
set role authenticated;
select pg_temp.expect_error(format($$select public.accept_company_invitation_by_token('%s')$$, :'inv_token'), 'confirm your email address first');
reset role;
update auth.users set email_confirmed_at = now() where id = :'newbie';
select pg_temp.login(:'newbie');
set role authenticated;
do $$ begin assert (select state = 'pending' and for_current_user from public.invitation_preview((select token from public.company_invitations where lower(email) = 'new.recruiter@company-example.sa'))), 'preview for invitee'; end $$;
select public.accept_company_invitation_by_token(:'inv_token');
select pg_temp.expect_error(format($$select public.accept_company_invitation_by_token('%s')$$, :'inv_token'), 'this invitation was already used');
reset role;
do $$ begin assert exists (select 1 from public.company_memberships m join public.profiles p on p.id = m.user_id where p.email = 'new.recruiter@company-example.sa' and m.role = 'recruiter' and m.status = 'active'), 'member added with invited role'; end $$;

-- an invitation never demotes the last admin
select email as adm_email from public.profiles where id = :'adm_a' \gset
insert into public.company_invitations (company_id, email, role, invited_by) values (:'co_a', :'adm_email', 'interviewer', :'adm_a') returning token as tok2 \gset
update auth.users set email_confirmed_at = now() where id = :'adm_a';
select pg_temp.login(:'adm_a');
set role authenticated;
select public.accept_company_invitation_by_token(:'tok2');
reset role;
select role as adm_role_after from public.company_memberships where company_id = :'co_a' and user_id = :'adm_a' \gset
select (:'adm_role_after' = 'company_admin') as admin_kept \gset
\if :admin_kept
\else
  \echo 'FAIL: admin demoted by invitation'
  select 1/0;
\endif

-- revoke + expired + resend rules
select pg_temp.login(:'adm_a');
set role authenticated;
select public.invite_company_member(:'co_a', 'someone.else@company-example.sa', 'interviewer') as inv3 \gset
select pg_temp.expect_error(format($$select public.resend_company_invitation('%s')$$, :'inv3'), 'please wait a few minutes before sending again');
select public.revoke_company_invitation(:'inv3');
select pg_temp.expect_error(format($$select public.revoke_company_invitation('%s')$$, :'inv3'), 'only pending invitations can be revoked');
reset role;
do $$ begin assert (select status from public.email_outbox where invitation_id = (select id from public.company_invitations where email = 'someone.else@company-example.sa')) = 'cancelled', 'revoked invitation email cancelled'; end $$;
select pg_temp.login(:'rec_a');
set role authenticated;
select pg_temp.expect_error(format($$select public.revoke_company_invitation('%s')$$, :'inv3'), 'only company admins can manage invitations');
do $$ begin assert (select count(*) from public.email_outbox) = 0, 'recruiters cannot read the outbox'; end $$;
reset role;
-- expired invitation can be re-sent as a new one
select pg_temp.login(:'adm_a');
set role authenticated;
select public.invite_company_member(:'co_a', 'late.person@company-example.sa', 'recruiter') as inv4 \gset
reset role;
update public.company_invitations set expires_at = now() - interval '1 day' where id = :'inv4';
select pg_temp.login(:'adm_a');
set role authenticated;
select public.invite_company_member(:'co_a', 'late.person@company-example.sa', 'recruiter');
reset role;
do $$ begin assert (select count(*) from public.company_invitations where email = 'late.person@company-example.sa' and status = 'expired') = 1, 'stale invite expired, new one created'; end $$;

-- ------------------------------------------------------------------ 5. Daily webhooks
update public.interviews set video_room_name = 'jdr-testroom-0001' where id = :'iv';
select set_config('t.cand', :'iv_cand', false);
set role anon;
-- out of order: left arrives before joined; duplicates; unknown participant; meeting end before start
do $$ declare k text := 'local-test-server-key-0123456789abcdef'; cand text := current_setting('t.cand'); o text; begin
  o := public.internal_ingest_daily_event(k, 'e-left-1', 'participant.left', now(), 'jdr-testroom-0001', 'sess-1', cand, null, 600);
  assert o = 'participant_left', o;
  o := public.internal_ingest_daily_event(k, 'e-join-1', 'participant.joined', now() - interval '10 minutes', 'jdr-testroom-0001', 'sess-1', cand, now() - interval '10 minutes', null);
  assert o = 'participant_joined', o;
  o := public.internal_ingest_daily_event(k, 'e-join-1-retry', 'participant.joined', now() - interval '10 minutes', 'jdr-testroom-0001', 'sess-1', cand, now() - interval '10 minutes', null);
  assert o = 'duplicate', 'participant duplicate with a new id: ' || o;
  o := public.internal_ingest_daily_event(k, 'e-x', 'participant.joined', now(), 'jdr-testroom-0001', 'sess-x', gen_random_uuid()::text, now(), null);
  assert o = 'unknown_participant', o;
  o := public.internal_ingest_daily_event(k, 'e-x2', 'participant.joined', now(), 'jdr-testroom-0001', 'sess-y', 'not-a-uuid', now(), null);
  assert o = 'unknown_participant', o;
  o := public.internal_ingest_daily_event(k, 'met-end-1', 'meeting.ended', now(), 'jdr-testroom-0001', null, null, null, null);
  o := public.internal_ingest_daily_event(k, 'met-sta-1', 'meeting.started', now() - interval '12 minutes', 'jdr-testroom-0001', null, null, null, null);
  o := public.internal_ingest_daily_event(k, 'met-sta-1', 'meeting.started', now() - interval '12 minutes', 'jdr-testroom-0001', null, null, null, null);
  assert o = 'duplicate', o;
  o := public.internal_ingest_daily_event(k, 'met-sta-2', 'meeting.started', now() - interval '5 minutes', 'jdr-testroom-0001', null, null, null, null);
  o := public.internal_ingest_daily_event(k, 'other', 'meeting.started', now(), 'jdr-unknown-room', null, null, null, null);
  assert o = 'unknown_room', o;
end $$;
select pg_temp.expect_error($$select * from public.video_webhook_events$$, '%permission denied%');
reset role;
do $$ begin
  assert (select count(*) from public.interview_attendance where daily_session_id = 'sess-1') = 1, 'one attendance row per session';
  assert (select left_at is not null and joined_at < left_at and source = 'webhook' from public.interview_attendance where daily_session_id = 'sess-1'), 'merged join/leave';
  assert (select video_started_at < now() - interval '11 minutes' and video_ended_at is not null from public.interviews where video_room_name = 'jdr-testroom-0001'), 'earliest start kept';
end $$;
select pg_temp.login(:'rec_b');
set role authenticated;
do $$ begin assert (select count(*) from public.video_webhook_events) = 0, 'other company sees no webhook events'; end $$;
reset role;

rollback;
\echo '0029 platform tests: all assertions passed'
