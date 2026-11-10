-- JADARAH — 0006 business rules (SECURITY DEFINER RPCs with explicit authorization)
-- These functions are the only write path for recruitment state. Each one re-checks
-- the caller's identity and role; RLS does not grant direct INSERT/UPDATE on these tables.

-- ---------------------------------------------------------------- status machine
-- Mirror of src/lib/domain/application-status.ts (kept in sync by unit + integration tests).
create or replace function public.application_transition_allowed(p_from public.application_status, p_to public.application_status)
returns boolean language sql immutable set search_path = '' as $$
  select case p_from
    when 'submitted'            then p_to in ('under_review', 'assessment_pending', 'shortlisted', 'rejected', 'hired', 'withdrawn')
    when 'under_review'         then p_to in ('assessment_pending', 'shortlisted', 'rejected', 'hired', 'withdrawn')
    when 'assessment_pending'   then p_to in ('assessment_completed', 'under_review', 'shortlisted', 'rejected', 'hired', 'withdrawn')
    when 'assessment_completed' then p_to in ('under_review', 'assessment_pending', 'shortlisted', 'rejected', 'hired', 'withdrawn')
    when 'shortlisted'          then p_to in ('assessment_pending', 'interview_scheduled', 'rejected', 'hired', 'withdrawn')
    when 'interview_scheduled'  then p_to in ('interview_completed', 'shortlisted', 'rejected', 'hired', 'withdrawn')
    when 'interview_completed'  then p_to in ('interview_scheduled', 'shortlisted', 'rejected', 'hired', 'withdrawn')
    else false
  end;
$$;

-- Defense in depth: every status change on applications must follow the machine.
create or replace function public.enforce_application_transition()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if not public.application_transition_allowed(old.status, new.status) then
      raise exception 'invalid application status transition: % -> %', old.status, new.status using errcode = 'P0001';
    end if;
    if new.status = 'shortlisted' then new.was_shortlisted := true; end if;
    if new.status in ('hired', 'rejected', 'withdrawn') then new.decided_at := now(); end if;
  end if;
  return new;
end $$;
create trigger applications_enforce_transition before update of status on public.applications
  for each row execute function public.enforce_application_transition();

-- MANDATORY RULE: a candidate must be shortlisted before an interview can be created.
create or replace function public.enforce_interview_shortlist()
returns trigger language plpgsql set search_path = '' as $$
declare v_app public.applications;
begin
  select * into v_app from public.applications where id = new.application_id;
  if v_app.id is null then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if new.company_id <> v_app.company_id then
    raise exception 'interview company must match application company' using errcode = 'P0001';
  end if;
  if not (v_app.was_shortlisted and v_app.status in ('shortlisted', 'interview_scheduled', 'interview_completed')) then
    raise exception 'candidate must be shortlisted before an interview can be created' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger interviews_enforce_shortlist before insert on public.interviews
  for each row execute function public.enforce_interview_shortlist();

create or replace function public.notify_company_recruiters(
  p_company uuid, p_kind text, p_title_en text, p_title_ar text, p_body_en text, p_body_ar text, p_link text
) returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select user_id from public.company_memberships
           where company_id = p_company and status = 'active' and role in ('company_admin', 'recruiter') loop
    perform public.notify(r.user_id, p_kind, p_title_en, p_title_ar, p_body_en, p_body_ar, p_link);
  end loop;
end $$;
revoke execute on function public.notify_company_recruiters(uuid, text, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.status_label(p_status public.application_status, p_lang text)
returns text language sql immutable set search_path = '' as $$
  select case p_lang when 'ar' then case p_status
      when 'submitted' then 'تم التقديم' when 'under_review' then 'قيد المراجعة'
      when 'assessment_pending' then 'بانتظار التقييم' when 'assessment_completed' then 'اكتمل التقييم'
      when 'shortlisted' then 'القائمة المختصرة' when 'interview_scheduled' then 'تمت جدولة مقابلة'
      when 'interview_completed' then 'اكتملت المقابلة' when 'hired' then 'تم التوظيف'
      when 'rejected' then 'لم يتم الاختيار' when 'withdrawn' then 'تم السحب' end
    else initcap(replace(p_status::text, '_', ' ')) end;
$$;

-- internal: perform a validated transition + history + candidate notification
create or replace function public._transition_application(
  p_app uuid, p_to public.application_status, p_reason text, p_candidate_message text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_app public.applications; v_job public.jobs;
begin
  select * into v_app from public.applications where id = p_app for update;
  if v_app.status = p_to then return; end if;
  update public.applications set status = p_to where id = p_app;
  insert into public.application_status_history (application_id, from_status, to_status, changed_by, reason, candidate_message)
  values (p_app, v_app.status, p_to, auth.uid(), nullif(trim(p_reason), ''), nullif(trim(p_candidate_message), ''));
  select * into v_job from public.jobs where id = v_app.job_id;
  perform public.notify(
    v_app.candidate_id, 'application_status',
    'Application update: ' || v_job.title_en, 'تحديث على طلبك: ' || v_job.title_ar,
    'Your application status is now "' || public.status_label(p_to, 'en') || '".',
    'أصبحت حالة طلبك "' || public.status_label(p_to, 'ar') || '".',
    '/candidate/applications/' || p_app
  );
  perform public.write_audit('application.status_changed', 'application', p_app, v_app.company_id,
    jsonb_build_object('from', v_app.status, 'to', p_to));
end $$;
revoke execute on function public._transition_application(uuid, public.application_status, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- candidate: apply / withdraw
create or replace function public.apply_to_job(
  p_job uuid, p_cv_document uuid, p_cover_letter text default null, p_answers jsonb default '[]'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_job public.jobs; v_app uuid; v_q record; v_answer text;
begin
  if v_uid is null or not public.is_active_user() then raise exception 'authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.user_roles where user_id = v_uid and role = 'candidate') then
    raise exception 'only candidates can apply to jobs' using errcode = '42501';
  end if;
  select * into v_job from public.jobs where id = p_job;
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

  insert into public.applications (job_id, company_id, candidate_id, cv_document_id, cover_letter)
  values (p_job, v_job.company_id, v_uid, p_cv_document, nullif(trim(p_cover_letter), ''))
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

  perform public.notify(v_uid, 'application_submitted', 'Application submitted: ' || v_job.title_en,
    'تم إرسال طلبك: ' || v_job.title_ar, 'We will notify you as the company reviews it.',
    'سنبلغك عند مراجعة الشركة لطلبك.', '/candidate/applications/' || v_app);
  perform public.notify_company_recruiters(v_job.company_id, 'application_received',
    'New application: ' || v_job.title_en, 'طلب جديد: ' || v_job.title_ar, null, null, '/company/applications/' || v_app);
  perform public.write_audit('application.submitted', 'application', v_app, v_job.company_id, jsonb_build_object('job_id', p_job));
  return v_app;
end $$;

create or replace function public.withdraw_application(p_app uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_app public.applications;
begin
  select * into v_app from public.applications where id = p_app;
  if v_app.id is null or v_app.candidate_id <> auth.uid() then raise exception 'application not found' using errcode = '42501'; end if;
  if not public.application_transition_allowed(v_app.status, 'withdrawn') then
    raise exception 'this application can no longer be withdrawn' using errcode = 'P0001';
  end if;
  perform public._transition_application(p_app, 'withdrawn', p_reason, null);
  perform public.notify_company_recruiters(v_app.company_id, 'application_withdrawn', 'A candidate withdrew an application',
    'قام مرشح بسحب طلبه', null, null, '/company/applications/' || p_app);
end $$;

-- ---------------------------------------------------------------- company: status changes
create or replace function public.change_application_status(
  p_app uuid, p_to public.application_status, p_reason text default null, p_candidate_message text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_app public.applications;
begin
  select * into v_app from public.applications where id = p_app;
  if v_app.id is null or not public.can_recruit(v_app.company_id) then
    raise exception 'not authorized for this application' using errcode = '42501';
  end if;
  -- These states are produced only by their workflows (assessment submission, interview scheduling/completion, candidate withdrawal).
  if p_to in ('assessment_completed', 'interview_scheduled', 'interview_completed', 'withdrawn', 'submitted') then
    raise exception 'status "%" is set automatically by its workflow', p_to using errcode = 'P0001';
  end if;
  if not public.application_transition_allowed(v_app.status, p_to) then
    raise exception 'invalid status transition: % -> %', v_app.status, p_to using errcode = 'P0001';
  end if;
  perform public._transition_application(p_app, p_to, p_reason, p_candidate_message);
end $$;

-- candidate-safe timeline: never exposes internal reasons or notes
create or replace function public.get_application_timeline(p_app uuid)
returns table (to_status public.application_status, candidate_message text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.applications a where a.id = p_app and (a.candidate_id = auth.uid() or public.can_recruit(a.company_id))) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select h.to_status, h.candidate_message, h.created_at
    from public.application_status_history h where h.application_id = p_app order by h.created_at;
end $$;

-- ---------------------------------------------------------------- company onboarding & approval
create or replace function public.create_company(
  p_name_en text, p_name_ar text, p_industry text, p_website text, p_size text, p_city text,
  p_description_en text, p_description_ar text, p_contact_email text, p_contact_phone text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_slug text; r record;
begin
  if v_uid is null or not public.is_active_user() then raise exception 'authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and account_type = 'company') then
    raise exception 'only company accounts can register a company' using errcode = '42501';
  end if;
  if exists (select 1 from public.company_memberships where user_id = v_uid and status = 'active') then
    raise exception 'this account already belongs to a company' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_name_en), '') = '' or coalesce(trim(p_name_ar), '') = '' then
    raise exception 'company name is required in Arabic and English' using errcode = 'P0001';
  end if;
  v_slug := trim(both '-' from regexp_replace(lower(p_name_en), '[^a-z0-9]+', '-', 'g'));
  if length(v_slug) < 2 then v_slug := 'company'; end if;
  v_slug := left(v_slug, 50);
  if exists (select 1 from public.company_profiles where slug = v_slug) then
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
  end if;
  insert into public.company_profiles (slug, name_en, name_ar, industry, website, size_range, city, description_en,
    description_ar, contact_email, contact_phone, created_by, status)
  values (v_slug, trim(p_name_en), trim(p_name_ar), p_industry, nullif(trim(p_website), ''), p_size, p_city,
    p_description_en, p_description_ar, p_contact_email, p_contact_phone, v_uid, 'pending')
  returning id into v_id;
  insert into public.company_memberships (company_id, user_id, role) values (v_id, v_uid, 'company_admin');
  update public.profiles set onboarding_completed = true where id = v_uid;
  for r in select user_id from public.user_roles where role = 'super_admin' loop
    perform public.notify(r.user_id, 'company_registered', 'New company awaiting approval: ' || p_name_en,
      'شركة جديدة بانتظار الاعتماد: ' || p_name_ar, null, null, '/admin/companies/' || v_id);
  end loop;
  perform public.write_audit('company.registered', 'company', v_id, v_id, '{}');
  return v_id;
end $$;

create or replace function public.submit_company_verification(
  p_company uuid, p_commercial_registration text, p_document_paths text[], p_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; p text;
begin
  if not public.has_company_role(p_company, array['company_admin']::public.membership_role[]) then
    raise exception 'only company admins can submit verification' using errcode = '42501';
  end if;
  foreach p in array coalesce(p_document_paths, '{}') loop
    if p not like p_company::text || '/%' then raise exception 'invalid document path' using errcode = 'P0001'; end if;
  end loop;
  insert into public.company_verification_requests (company_id, submitted_by, commercial_registration, document_paths, notes)
  values (p_company, auth.uid(), p_commercial_registration, coalesce(p_document_paths, '{}'), p_notes)
  returning id into v_id;
  update public.company_profiles set status = 'pending' where id = p_company and status = 'info_requested';
  perform public.write_audit('company.verification_submitted', 'company', p_company, p_company, jsonb_build_object('request_id', v_id));
  return v_id;
end $$;

create or replace function public.review_company(p_company uuid, p_decision text, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_c public.company_profiles; v_status public.company_status; r record;
  v_title_en text; v_title_ar text;
begin
  if not public.is_super_admin() then raise exception 'super admin only' using errcode = '42501'; end if;
  select * into v_c from public.company_profiles where id = p_company for update;
  if v_c.id is null then raise exception 'company not found' using errcode = 'P0002'; end if;
  v_status := case p_decision
    when 'approve' then 'approved' when 'reject' then 'rejected' when 'request_info' then 'info_requested'
    when 'suspend' then 'suspended' when 'reactivate' then 'approved' else null end::public.company_status;
  if v_status is null then raise exception 'unknown decision' using errcode = 'P0001'; end if;
  if p_decision = 'reactivate' and v_c.status <> 'suspended' then raise exception 'company is not suspended' using errcode = 'P0001'; end if;
  if p_decision = 'suspend' and v_c.status <> 'approved' then raise exception 'only approved companies can be suspended' using errcode = 'P0001'; end if;
  if p_decision in ('approve', 'reject', 'request_info') and v_c.status not in ('pending', 'info_requested', 'rejected') then
    raise exception 'company is not awaiting review' using errcode = 'P0001';
  end if;
  if p_decision in ('reject', 'request_info', 'suspend') and coalesce(trim(p_notes), '') = '' then
    raise exception 'a reason is required' using errcode = 'P0001';
  end if;

  update public.company_profiles set status = v_status, status_reason = nullif(trim(p_notes), ''),
    approved_at = case when v_status = 'approved' then coalesce(approved_at, now()) else approved_at end,
    approved_by = case when v_status = 'approved' then auth.uid() else approved_by end
  where id = p_company;
  update public.company_verification_requests set status = case p_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'info_requested' end,
    reviewer_id = auth.uid(), reviewer_notes = p_notes, reviewed_at = now()
  where company_id = p_company and status in ('pending', 'info_requested') and p_decision in ('approve', 'reject', 'request_info');
  if p_decision = 'suspend' then
    update public.jobs set status = 'paused' where company_id = p_company and status = 'published';
  end if;

  v_title_en := case p_decision when 'approve' then 'Your company has been approved' when 'reject' then 'Your company registration was not approved'
    when 'request_info' then 'Additional information requested' when 'suspend' then 'Your company workspace was suspended'
    else 'Your company workspace was reactivated' end;
  v_title_ar := case p_decision when 'approve' then 'تم اعتماد شركتك' when 'reject' then 'لم يتم اعتماد تسجيل شركتك'
    when 'request_info' then 'مطلوب معلومات إضافية' when 'suspend' then 'تم تعليق مساحة شركتك'
    else 'تمت إعادة تفعيل مساحة شركتك' end;
  for r in select user_id from public.company_memberships where company_id = p_company and role = 'company_admin' and status = 'active' loop
    perform public.notify(r.user_id, 'company_review', v_title_en, v_title_ar, p_notes, p_notes, '/company/verification');
  end loop;
  perform public.write_audit('company.' || p_decision, 'company', p_company, p_company, jsonb_build_object('notes', p_notes));
end $$;

-- ---------------------------------------------------------------- super admin: users & roles
create or replace function public.admin_set_user_status(p_user uuid, p_status public.account_status, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'super admin only' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'you cannot change your own account status' using errcode = 'P0001'; end if;
  update public.profiles set status = p_status where id = p_user;
  if not found then raise exception 'user not found' using errcode = 'P0002'; end if;
  perform public.write_audit('user.status_' || p_status::text, 'user', p_user, null, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_grant_role(p_user uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'super admin only' using errcode = '42501'; end if;
  if p_role not in ('super_admin', 'candidate') then raise exception 'company roles are managed through memberships' using errcode = 'P0001'; end if;
  insert into public.user_roles (user_id, role, granted_by) values (p_user, p_role, auth.uid()) on conflict do nothing;
  perform public.write_audit('role.granted', 'user', p_user, null, jsonb_build_object('role', p_role));
end $$;

create or replace function public.admin_revoke_role(p_user uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'super admin only' using errcode = '42501'; end if;
  if p_user = auth.uid() and p_role = 'super_admin' then raise exception 'you cannot revoke your own super admin role' using errcode = 'P0001'; end if;
  delete from public.user_roles where user_id = p_user and role = p_role;
  perform public.write_audit('role.revoked', 'user', p_user, null, jsonb_build_object('role', p_role));
end $$;

create or replace function public.admin_set_membership(p_company uuid, p_user uuid, p_role public.membership_role, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'super admin only' using errcode = '42501'; end if;
  insert into public.company_memberships (company_id, user_id, role, status, invited_by)
  values (p_company, p_user, p_role, case when p_active then 'active' else 'removed' end, auth.uid())
  on conflict (company_id, user_id) do update set role = excluded.role, status = excluded.status;
  perform public.write_audit('membership.admin_set', 'company', p_company, p_company, jsonb_build_object('user', p_user, 'role', p_role, 'active', p_active));
end $$;

-- ---------------------------------------------------------------- company team
create or replace function public.invite_company_member(p_company uuid, p_email text, p_role public.membership_role)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user uuid;
begin
  if not public.has_company_role(p_company, array['company_admin']::public.membership_role[]) then
    raise exception 'only company admins can invite members' using errcode = '42501';
  end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email' using errcode = 'P0001'; end if;
  insert into public.company_invitations (company_id, email, role, invited_by)
  values (p_company, lower(trim(p_email)), p_role, auth.uid()) returning id into v_id;
  select id into v_user from public.profiles where lower(email) = lower(trim(p_email));
  if v_user is not null then
    perform public.notify(v_user, 'company_invitation', 'You were invited to join a company team', 'تمت دعوتك للانضمام إلى فريق شركة',
      null, null, '/invitations');
  end if;
  perform public.write_audit('membership.invited', 'company', p_company, p_company, jsonb_build_object('email', lower(p_email), 'role', p_role));
  return v_id;
end $$;

create or replace function public.accept_company_invitation(p_invitation uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.company_invitations; v_email text;
begin
  select email into v_email from public.profiles where id = auth.uid();
  select * into v_inv from public.company_invitations where id = p_invitation for update;
  if v_inv.id is null or v_inv.status <> 'pending' or v_inv.expires_at < now() or lower(v_inv.email) <> lower(v_email) then
    raise exception 'invitation is not valid for this account' using errcode = 'P0001';
  end if;
  insert into public.company_memberships (company_id, user_id, role, invited_by)
  values (v_inv.company_id, auth.uid(), v_inv.role, v_inv.invited_by)
  on conflict (company_id, user_id) do update set role = excluded.role, status = 'active';
  update public.company_invitations set status = 'accepted', accepted_at = now() where id = p_invitation;
  update public.profiles set onboarding_completed = true where id = auth.uid() and account_type = 'company';
  perform public.write_audit('membership.accepted', 'company', v_inv.company_id, v_inv.company_id, '{}');
  return v_inv.company_id;
end $$;

create or replace function public.update_company_member(p_membership uuid, p_role public.membership_role, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_m public.company_memberships;
begin
  select * into v_m from public.company_memberships where id = p_membership for update;
  if v_m.id is null or not public.has_company_role(v_m.company_id, array['company_admin']::public.membership_role[]) then
    raise exception 'only company admins can manage members' using errcode = '42501';
  end if;
  if v_m.role = 'company_admin' and (p_role <> 'company_admin' or not p_active) and (
    select count(*) from public.company_memberships where company_id = v_m.company_id and role = 'company_admin' and status = 'active') <= 1 then
    raise exception 'a company must keep at least one active admin' using errcode = 'P0001';
  end if;
  update public.company_memberships set role = p_role, status = case when p_active then 'active' else 'removed' end where id = p_membership;
  perform public.write_audit('membership.updated', 'company', v_m.company_id, v_m.company_id,
    jsonb_build_object('membership', p_membership, 'role', p_role, 'active', p_active));
end $$;

-- ---------------------------------------------------------------- assessments
create or replace function public.assign_assessment(p_assessment uuid, p_application uuid, p_due_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_app public.applications; v_a public.assessments; v_id uuid;
begin
  select * into v_app from public.applications where id = p_application;
  if v_app.id is null or not public.can_recruit(v_app.company_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v_a from public.assessments where id = p_assessment;
  if v_a.id is null or v_a.status <> 'published' or (v_a.company_id is not null and v_a.company_id <> v_app.company_id) then
    raise exception 'assessment is not available' using errcode = 'P0001';
  end if;
  if v_app.status in ('hired', 'rejected', 'withdrawn') then raise exception 'application is closed' using errcode = 'P0001'; end if;
  if p_due_at is not null and p_due_at < now() then raise exception 'due date must be in the future' using errcode = 'P0001'; end if;
  insert into public.assessment_assignments (assessment_id, application_id, candidate_id, company_id, assigned_by, due_at)
  values (p_assessment, p_application, v_app.candidate_id, v_app.company_id, auth.uid(), p_due_at)
  returning id into v_id;
  if public.application_transition_allowed(v_app.status, 'assessment_pending') then
    perform public._transition_application(p_application, 'assessment_pending', 'Assessment assigned', null);
  end if;
  perform public.notify(v_app.candidate_id, 'assessment_assigned', 'New assessment: ' || v_a.title_en, 'تقييم جديد: ' || v_a.title_ar,
    case when p_due_at is not null then 'Due ' || to_char(p_due_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI') end,
    case when p_due_at is not null then 'الموعد النهائي ' || to_char(p_due_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI') end,
    '/candidate/assessments/' || v_id);
  perform public.write_audit('assessment.assigned', 'assessment_assignment', v_id, v_app.company_id, jsonb_build_object('application', p_application));
  return v_id;
end $$;

-- Returns the attempt WITHOUT answer keys or explanations. Starts the attempt on first call.
create or replace function public.start_assessment(p_assignment uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_as public.assessment_assignments; v_a public.assessments; v_sub public.assessment_submissions; v_result jsonb;
begin
  select * into v_as from public.assessment_assignments where id = p_assignment for update;
  if v_as.id is null or v_as.candidate_id <> auth.uid() then raise exception 'assessment not found' using errcode = '42501'; end if;
  if v_as.status in ('cancelled', 'expired') then raise exception 'this assessment is no longer available' using errcode = 'P0001'; end if;
  select * into v_a from public.assessments where id = v_as.assessment_id;
  select * into v_sub from public.assessment_submissions where assignment_id = p_assignment;
  if v_sub.id is null then
    if v_as.due_at is not null and v_as.due_at < now() then
      update public.assessment_assignments set status = 'expired' where id = p_assignment;
      raise exception 'the deadline for this assessment has passed' using errcode = 'P0001';
    end if;
    insert into public.assessment_submissions (assignment_id, candidate_id, max_score)
    values (p_assignment, auth.uid(), (select coalesce(sum(points), 0) from public.assessment_questions where assessment_id = v_a.id))
    returning * into v_sub;
    update public.assessment_assignments set status = 'in_progress', started_at = now() where id = p_assignment;
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

create or replace function public.save_assessment_answer(
  p_assignment uuid, p_question uuid, p_selected uuid[] default '{}', p_text text default null, p_file_path text default null
) returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_sub public.assessment_submissions; v_a public.assessments; v_q public.assessment_questions; v_at timestamptz;
begin
  select s.* into v_sub from public.assessment_submissions s where s.assignment_id = p_assignment;
  if v_sub.id is null or v_sub.candidate_id <> auth.uid() then raise exception 'attempt not found' using errcode = '42501'; end if;
  if v_sub.status <> 'in_progress' then raise exception 'this assessment has already been submitted' using errcode = 'P0001'; end if;
  select a.* into v_a from public.assessments a join public.assessment_assignments aa on aa.assessment_id = a.id where aa.id = p_assignment;
  if now() > v_sub.started_at + make_interval(mins => v_a.duration_minutes + 2) then
    raise exception 'time is up for this assessment' using errcode = 'P0001';
  end if;
  select * into v_q from public.assessment_questions where id = p_question and assessment_id = v_a.id;
  if v_q.id is null then raise exception 'question not found' using errcode = 'P0002'; end if;
  if exists (select 1 from unnest(coalesce(p_selected, '{}')) sel where not exists (
      select 1 from public.assessment_options o where o.id = sel and o.question_id = p_question)) then
    raise exception 'invalid option' using errcode = 'P0001';
  end if;
  if p_file_path is not null and p_file_path not like auth.uid()::text || '/%' then
    raise exception 'invalid file path' using errcode = 'P0001';
  end if;
  insert into public.assessment_answers (submission_id, question_id, selected_option_ids, text_answer, file_path)
  values (v_sub.id, p_question, coalesce(p_selected, '{}'), p_text, p_file_path)
  on conflict (submission_id, question_id) do update
    set selected_option_ids = excluded.selected_option_ids, text_answer = excluded.text_answer, file_path = coalesce(excluded.file_path, public.assessment_answers.file_path)
  returning updated_at into v_at;
  return v_at;
end $$;

-- Objective scoring rules (mirrored in src/lib/domain/scoring.ts):
--  single choice / true-false: exact match = full points
--  multiple select: max(0, (correct picks - wrong picks) / total correct) * points
--  short answer with config.accepted_answers: case-insensitive trimmed match
--  everything else requires rubric-based human review
create or replace function public.submit_assessment(p_assignment uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_as public.assessment_assignments; v_sub public.assessment_submissions; v_q record; v_ans public.assessment_answers;
  v_correct uuid[]; v_hits int; v_wrong int; v_pts numeric; v_auto numeric := 0; v_review boolean := false; v_max numeric := 0;
  v_accepted jsonb; v_app public.applications; v_title_en text; v_title_ar text;
begin
  select * into v_as from public.assessment_assignments where id = p_assignment for update;
  if v_as.id is null or v_as.candidate_id <> auth.uid() then raise exception 'assessment not found' using errcode = '42501'; end if;
  select * into v_sub from public.assessment_submissions where assignment_id = p_assignment for update;
  if v_sub.id is null then raise exception 'assessment has not been started' using errcode = 'P0001'; end if;
  if v_sub.status <> 'in_progress' then raise exception 'already submitted' using errcode = 'P0001'; end if;

  for v_q in select * from public.assessment_questions where assessment_id = v_as.assessment_id loop
    v_max := v_max + v_q.points;
    select * into v_ans from public.assessment_answers where submission_id = v_sub.id and question_id = v_q.id;
    if v_q.type in ('multiple_choice', 'true_false', 'multiple_select') then
      select coalesce(array_agg(id), '{}') into v_correct from public.assessment_options where question_id = v_q.id and is_correct;
      if v_ans.id is null then
        insert into public.assessment_answers (submission_id, question_id, is_correct, points_awarded) values (v_sub.id, v_q.id, false, 0);
        continue;
      end if;
      select count(*) filter (where s = any (v_correct)), count(*) filter (where not (s = any (v_correct)))
        into v_hits, v_wrong from unnest(v_ans.selected_option_ids) s;
      if v_q.type = 'multiple_select' then
        v_pts := case when cardinality(v_correct) = 0 then 0 else greatest(0, (v_hits - v_wrong)::numeric / cardinality(v_correct)) * v_q.points end;
      else
        v_pts := case when v_hits = 1 and v_wrong = 0 and cardinality(v_ans.selected_option_ids) = 1 then v_q.points else 0 end;
      end if;
      update public.assessment_answers set points_awarded = round(v_pts, 2), is_correct = (v_pts = v_q.points) where id = v_ans.id;
      v_auto := v_auto + v_pts;
    elsif v_q.type = 'short_answer' and jsonb_typeof(v_q.config -> 'accepted_answers') = 'array' then
      v_accepted := v_q.config -> 'accepted_answers';
      if v_ans.id is null then
        insert into public.assessment_answers (submission_id, question_id, is_correct, points_awarded) values (v_sub.id, v_q.id, false, 0);
        continue;
      end if;
      v_pts := case when exists (select 1 from jsonb_array_elements_text(v_accepted) x where lower(trim(x)) = lower(trim(coalesce(v_ans.text_answer, '')))) then v_q.points else 0 end;
      update public.assessment_answers set points_awarded = v_pts, is_correct = (v_pts > 0) where id = v_ans.id;
      v_auto := v_auto + v_pts;
    else
      v_review := true;
      if v_ans.id is null then
        insert into public.assessment_answers (submission_id, question_id) values (v_sub.id, v_q.id);
      end if;
    end if;
  end loop;

  update public.assessment_submissions set status = case when v_review then 'submitted' else 'evaluated' end,
    auto_score = round(v_auto, 2), max_score = v_max, needs_review = v_review, submitted_at = now(),
    evaluated_at = case when v_review then null else now() end,
    percentage = case when v_review or v_max = 0 then null else round(v_auto / v_max * 100, 2) end
  where id = v_sub.id;
  update public.assessment_assignments set status = case when v_review then 'submitted' else 'evaluated' end, submitted_at = now() where id = p_assignment;

  select title_en, title_ar into v_title_en, v_title_ar from public.assessments where id = v_as.assessment_id;
  if v_as.application_id is not null then
    select * into v_app from public.applications where id = v_as.application_id;
    if v_app.status = 'assessment_pending' then
      perform public._transition_application(v_app.id, 'assessment_completed', 'Assessment submitted', null);
    end if;
    perform public.notify_company_recruiters(v_as.company_id, 'assessment_completed', 'Assessment submitted: ' || v_title_en,
      'تم تسليم تقييم: ' || v_title_ar, null, null, '/company/applications/' || v_as.application_id);
  end if;
  perform public.notify(auth.uid(), 'assessment_completed', 'Assessment submitted: ' || v_title_en, 'تم تسليم التقييم: ' || v_title_ar,
    null, null, '/candidate/assessments/' || p_assignment);
  return jsonb_build_object('auto_score', round(v_auto, 2), 'max_score', v_max, 'needs_review', v_review);
end $$;

create or replace function public.evaluate_assessment_answer(
  p_submission uuid, p_question uuid, p_points numeric, p_rubric_scores jsonb default '{}', p_comments text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_sub public.assessment_submissions; v_as public.assessment_assignments; v_q public.assessment_questions; v_pending int; v_manual numeric;
begin
  select * into v_sub from public.assessment_submissions where id = p_submission for update;
  select * into v_as from public.assessment_assignments where id = v_sub.assignment_id;
  if v_sub.id is null or v_as.company_id is null or not public.can_recruit(v_as.company_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_sub.status = 'in_progress' then raise exception 'submission is not complete yet' using errcode = 'P0001'; end if;
  select * into v_q from public.assessment_questions where id = p_question and assessment_id = v_as.assessment_id;
  if v_q.id is null then raise exception 'question not found' using errcode = 'P0002'; end if;
  if p_points < 0 or p_points > v_q.points then raise exception 'points must be between 0 and %', v_q.points using errcode = 'P0001'; end if;
  insert into public.assessment_evaluations (submission_id, question_id, evaluator_id, rubric_scores, points, comments)
  values (p_submission, p_question, auth.uid(), coalesce(p_rubric_scores, '{}'), p_points, p_comments)
  on conflict (submission_id, question_id) do update set evaluator_id = excluded.evaluator_id, rubric_scores = excluded.rubric_scores,
    points = excluded.points, comments = excluded.comments, created_at = now();
  update public.assessment_answers set points_awarded = p_points, is_correct = null where submission_id = p_submission and question_id = p_question;

  select count(*) into v_pending from public.assessment_questions q
    where q.assessment_id = v_as.assessment_id
      and not (q.type in ('multiple_choice', 'true_false', 'multiple_select') or (q.type = 'short_answer' and jsonb_typeof(q.config -> 'accepted_answers') = 'array'))
      and not exists (select 1 from public.assessment_evaluations e where e.submission_id = p_submission and e.question_id = q.id);
  select coalesce(sum(points), 0) into v_manual from public.assessment_evaluations where submission_id = p_submission;
  update public.assessment_submissions set manual_score = v_manual,
    status = case when v_pending = 0 then 'evaluated' else status end,
    needs_review = v_pending > 0,
    evaluated_at = case when v_pending = 0 then now() else null end,
    percentage = case when v_pending = 0 and max_score > 0 then round((auto_score + v_manual) / max_score * 100, 2) else null end
  where id = p_submission;
  if v_pending = 0 then
    update public.assessment_assignments set status = 'evaluated' where id = v_as.id;
  end if;
end $$;

create or replace function public.share_assessment_feedback(p_submission uuid, p_feedback text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_as public.assessment_assignments;
begin
  select aa.* into v_as from public.assessment_assignments aa join public.assessment_submissions s on s.assignment_id = aa.id where s.id = p_submission;
  if v_as.id is null or v_as.company_id is null or not public.can_recruit(v_as.company_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.assessment_submissions set candidate_feedback = nullif(trim(p_feedback), ''), feedback_shared = nullif(trim(p_feedback), '') is not null
  where id = p_submission;
  perform public.notify(v_as.candidate_id, 'assessment_feedback', 'Feedback shared on your assessment', 'تمت مشاركة ملاحظات على تقييمك',
    null, null, '/candidate/assessments/' || v_as.id);
end $$;

-- Candidate result view: answer keys/explanations only after submission.
create or replace function public.get_assessment_result(p_assignment uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_as public.assessment_assignments; v_sub public.assessment_submissions; v_a public.assessments;
begin
  select * into v_as from public.assessment_assignments where id = p_assignment;
  if v_as.id is null or not (v_as.candidate_id = auth.uid() or (v_as.company_id is not null and public.can_recruit(v_as.company_id)) or public.is_super_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into v_sub from public.assessment_submissions where assignment_id = p_assignment;
  if v_sub.id is null or v_sub.status = 'in_progress' then raise exception 'results are available after submission' using errcode = 'P0001'; end if;
  select * into v_a from public.assessments where id = v_as.assessment_id;
  return jsonb_build_object(
    'assessment', jsonb_build_object('title_en', v_a.title_en, 'title_ar', v_a.title_ar, 'passing_score', v_a.passing_score,
      'learning_outcomes_en', v_a.learning_outcomes_en, 'learning_outcomes_ar', v_a.learning_outcomes_ar),
    'submission', jsonb_build_object('status', v_sub.status, 'auto_score', v_sub.auto_score, 'manual_score', v_sub.manual_score,
      'max_score', v_sub.max_score, 'percentage', v_sub.percentage, 'needs_review', v_sub.needs_review, 'submitted_at', v_sub.submitted_at,
      'feedback', case when v_sub.feedback_shared or v_as.candidate_id <> auth.uid() then v_sub.candidate_feedback end),
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', q.id, 'type', q.type, 'prompt_en', q.prompt_en, 'prompt_ar', q.prompt_ar, 'points', q.points,
      'explanation_en', q.explanation_en, 'explanation_ar', q.explanation_ar,
      'options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'label_en', o.label_en, 'label_ar', o.label_ar, 'is_correct', o.is_correct) order by o.position)
        from public.assessment_options o where o.question_id = q.id), '[]'),
      'answer', (select jsonb_build_object('selected_option_ids', aa.selected_option_ids, 'text_answer', aa.text_answer,
        'is_correct', aa.is_correct, 'points_awarded', aa.points_awarded) from public.assessment_answers aa where aa.submission_id = v_sub.id and aa.question_id = q.id)
    ) order by q.position) from public.assessment_questions q where q.assessment_id = v_a.id), '[]'));
end $$;

-- ---------------------------------------------------------------- interviews
create or replace function public.create_interview(
  p_application uuid, p_title text, p_type public.interview_type, p_scheduled_at timestamptz, p_duration int,
  p_timezone text, p_location text, p_meeting_url text, p_instructions text, p_interviewers uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_app public.applications; v_id uuid; v_u uuid; v_job public.jobs;
begin
  select * into v_app from public.applications where id = p_application for update;
  if v_app.id is null or not public.can_recruit(v_app.company_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  -- MANDATORY: shortlisted before interview (also enforced by trigger interviews_enforce_shortlist)
  if not (v_app.was_shortlisted and v_app.status in ('shortlisted', 'interview_scheduled', 'interview_completed')) then
    raise exception 'candidate must be shortlisted before an interview can be created' using errcode = 'P0001';
  end if;
  if p_scheduled_at < now() - interval '5 minutes' then raise exception 'interview time must be in the future' using errcode = 'P0001'; end if;
  if coalesce(cardinality(p_interviewers), 0) = 0 then raise exception 'assign at least one interviewer' using errcode = 'P0001'; end if;
  foreach v_u in array p_interviewers loop
    if not exists (select 1 from public.company_memberships where company_id = v_app.company_id and user_id = v_u and status = 'active') then
      raise exception 'interviewers must be members of the company' using errcode = 'P0001';
    end if;
  end loop;

  insert into public.interviews (application_id, company_id, title, type, scheduled_at, duration_minutes, timezone, location, meeting_url, instructions, created_by)
  values (p_application, v_app.company_id, coalesce(nullif(trim(p_title), ''), 'Interview'), p_type, p_scheduled_at, coalesce(p_duration, 45),
    coalesce(p_timezone, 'Asia/Riyadh'), p_location, p_meeting_url, p_instructions, auth.uid())
  returning id into v_id;
  foreach v_u in array p_interviewers loop
    insert into public.interview_participants (interview_id, user_id, role) values (v_id, v_u, 'interviewer') on conflict do nothing;
    perform public.notify(v_u, 'interview_assigned', 'You were assigned to an interview', 'تم تعيينك لإجراء مقابلة', null, null, '/company/interviews/' || v_id);
  end loop;
  if v_app.status <> 'interview_scheduled' then
    perform public._transition_application(p_application, 'interview_scheduled', 'Interview scheduled', null);
  end if;
  select * into v_job from public.jobs where id = v_app.job_id;
  perform public.notify(v_app.candidate_id, 'interview_scheduled', 'Interview scheduled: ' || v_job.title_en, 'تمت جدولة مقابلة: ' || v_job.title_ar,
    to_char(p_scheduled_at at time zone coalesce(p_timezone, 'Asia/Riyadh'), 'YYYY-MM-DD HH24:MI') || ' (' || coalesce(p_timezone, 'Asia/Riyadh') || ')',
    to_char(p_scheduled_at at time zone coalesce(p_timezone, 'Asia/Riyadh'), 'YYYY-MM-DD HH24:MI') || ' (' || coalesce(p_timezone, 'Asia/Riyadh') || ')',
    '/candidate/applications/' || p_application);
  perform public.write_audit('interview.created', 'interview', v_id, v_app.company_id, jsonb_build_object('application', p_application));
  return v_id;
end $$;

create or replace function public.set_interview_status(p_interview uuid, p_status public.interview_status, p_new_time timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_i public.interviews; v_app public.applications;
begin
  select * into v_i from public.interviews where id = p_interview for update;
  if v_i.id is null or not public.can_recruit(v_i.company_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v_app from public.applications where id = v_i.application_id;
  if p_status = 'scheduled' and p_new_time is not null then
    update public.interviews set scheduled_at = p_new_time, status = 'scheduled' where id = p_interview;
    perform public.notify(v_app.candidate_id, 'interview_changed', 'Your interview was rescheduled', 'تم تغيير موعد مقابلتك',
      to_char(p_new_time at time zone v_i.timezone, 'YYYY-MM-DD HH24:MI'), to_char(p_new_time at time zone v_i.timezone, 'YYYY-MM-DD HH24:MI'),
      '/candidate/applications/' || v_app.id);
  elsif p_status = 'completed' then
    update public.interviews set status = 'completed' where id = p_interview;
    if v_app.status = 'interview_scheduled' then
      perform public._transition_application(v_app.id, 'interview_completed', 'Interview completed', null);
    end if;
  elsif p_status = 'cancelled' then
    update public.interviews set status = 'cancelled' where id = p_interview;
    if v_app.status = 'interview_scheduled' and not exists (
      select 1 from public.interviews where application_id = v_app.id and status = 'scheduled' and id <> p_interview) then
      perform public._transition_application(v_app.id, 'shortlisted', 'Interview cancelled', null);
    end if;
    perform public.notify(v_app.candidate_id, 'interview_changed', 'Your interview was cancelled', 'تم إلغاء مقابلتك', null, null,
      '/candidate/applications/' || v_app.id);
  end if;
  perform public.write_audit('interview.' || p_status::text, 'interview', p_interview, v_i.company_id, '{}');
end $$;

create or replace function public.share_interview_feedback(p_feedback uuid, p_share boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_f public.interview_feedback; v_i public.interviews; v_cand uuid;
begin
  select * into v_f from public.interview_feedback where id = p_feedback for update;
  select * into v_i from public.interviews where id = v_f.interview_id;
  if v_f.id is null or not public.can_recruit(v_i.company_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.interview_feedback set shared_with_candidate = p_share, shared_at = case when p_share then now() end where id = p_feedback;
  if p_share then
    select candidate_id into v_cand from public.applications where id = v_f.application_id;
    perform public.notify(v_cand, 'interview_feedback', 'Interview feedback shared with you', 'تمت مشاركة ملاحظات المقابلة معك', null, null,
      '/candidate/applications/' || v_f.application_id);
  end if;
  perform public.write_audit('interview.feedback_' || case when p_share then 'shared' else 'unshared' end, 'interview', v_i.id, v_i.company_id, '{}');
end $$;

-- ---------------------------------------------------------------- dashboards (real aggregates)
create or replace function public.admin_platform_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'super admin only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'candidates', (select count(*) from public.user_roles where role = 'candidate'),
    'companies', (select count(*) from public.company_profiles),
    'companies_by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.company_profiles group by status) s),
    'pending_companies', (select count(*) from public.company_profiles where status in ('pending', 'info_requested')),
    'active_jobs', (select count(*) from public.jobs where status = 'published'),
    'applications', (select count(*) from public.applications),
    'applications_by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.applications group by status) s),
    'interviews', (select count(*) from public.interviews),
    'hires', (select count(*) from public.applications where status = 'hired'),
    'assessments_submitted', (select count(*) from public.assessment_submissions where status <> 'in_progress'),
    'ai_requests_30d', (select count(*) from public.ai_provider_logs where created_at > now() - interval '30 days'),
    'user_growth', (select coalesce(jsonb_agg(jsonb_build_object('month', m, 'count', n) order by m), '[]') from (
      select to_char(date_trunc('month', created_at), 'YYYY-MM') m, count(*) n from public.profiles group by 1) g),
    'application_growth', (select coalesce(jsonb_agg(jsonb_build_object('month', m, 'count', n) order by m), '[]') from (
      select to_char(date_trunc('month', submitted_at), 'YYYY-MM') m, count(*) n from public.applications group by 1) g),
    'active_users_30d', (select count(distinct user_id) from public.notifications where read_at > now() - interval '30 days')
  );
end $$;

create or replace function public.company_dashboard_stats(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.has_company_role(p_company) or public.is_super_admin()) then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'jobs_by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.jobs where company_id = p_company group by status) s),
    'applications_by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.applications where company_id = p_company group by status) s),
    'funnel', jsonb_build_object(
      'applied', (select count(*) from public.applications where company_id = p_company),
      'reviewed', (select count(*) from public.applications where company_id = p_company and status <> 'submitted'),
      'assessed', (select count(distinct application_id) from public.assessment_assignments where company_id = p_company and status in ('submitted', 'evaluated')),
      'shortlisted', (select count(*) from public.applications where company_id = p_company and was_shortlisted),
      'interviewed', (select count(distinct application_id) from public.interviews where company_id = p_company),
      'hired', (select count(*) from public.applications where company_id = p_company and status = 'hired')),
    'applications_per_job', (select coalesce(jsonb_agg(jsonb_build_object('job_id', j.id, 'title_en', j.title_en, 'title_ar', j.title_ar, 'count',
        (select count(*) from public.applications a where a.job_id = j.id)) order by j.created_at desc), '[]')
      from public.jobs j where j.company_id = p_company and j.status in ('published', 'paused', 'closed')),
    'weekly_applications', (select coalesce(jsonb_agg(jsonb_build_object('week', w, 'count', n) order by w), '[]') from (
      select to_char(date_trunc('week', submitted_at), 'YYYY-MM-DD') w, count(*) n from public.applications
      where company_id = p_company and submitted_at > now() - interval '12 weeks' group by 1) g),
    'upcoming_interviews', (select count(*) from public.interviews where company_id = p_company and status = 'scheduled' and scheduled_at > now()),
    'pending_reviews', (select count(*) from public.assessment_submissions s join public.assessment_assignments aa on aa.id = s.assignment_id
      where aa.company_id = p_company and s.needs_review and s.status = 'submitted'),
    'avg_assessment_score', (select round(avg(s.percentage), 1) from public.assessment_submissions s join public.assessment_assignments aa on aa.id = s.assignment_id
      where aa.company_id = p_company and s.percentage is not null)
  );
end $$;

-- grant the callable surface explicitly
-- PUBLIC holds EXECUTE by default; remove it so anonymous callers only get what is listed below.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.application_transition_allowed(public.application_status, public.application_status) to anon, authenticated;
-- helpers referenced by policies that apply to the anon role (they return false for anonymous users)
grant execute on function public.can_view_job(uuid) to anon;
grant execute on function public.is_company_approved(uuid) to anon;
grant execute on function public.is_super_admin() to anon;
-- internal helpers stay unavailable to API callers
revoke execute on function public.notify(uuid, text, text, text, text, text, text) from authenticated;
revoke execute on function public.write_audit(text, text, uuid, uuid, jsonb) from authenticated;
revoke execute on function public.notify_company_recruiters(uuid, text, text, text, text, text, text) from authenticated;
revoke execute on function public._transition_application(uuid, public.application_status, text, text) from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
