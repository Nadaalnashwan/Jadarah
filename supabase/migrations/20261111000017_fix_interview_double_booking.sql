-- JADARAH — 0017 fix: create_interview must not swallow interviewer double-booking.
-- 0016 inserted participants with ON CONFLICT DO NOTHING, which also suppresses exclusion-constraint
-- violations, so an overlapping booking created an interview WITHOUT that interviewer. Interviewers are
-- now de-duplicated up front and conflicts raise 23P01 (found by tests/integration/calendar.test.ts).

create or replace function public.create_interview(
  p_application uuid, p_title text, p_type public.interview_type, p_scheduled_at timestamptz, p_duration int,
  p_timezone text, p_location text, p_meeting_url text, p_instructions text, p_interviewers uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_app public.applications; v_id uuid; v_u uuid; v_job public.jobs; v_tz text := coalesce(nullif(p_timezone, ''), 'Asia/Riyadh');
  v_dur int := coalesce(p_duration, 45); v_when text;
begin
  select * into v_app from public.applications where id = p_application for update;
  if v_app.id is null or not public.can_recruit(v_app.company_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  -- MANDATORY: shortlisted before interview (also enforced by trigger interviews_enforce_shortlist)
  if not (v_app.was_shortlisted and v_app.status in ('shortlisted', 'interview_scheduled', 'interview_completed')) then
    raise exception 'candidate must be shortlisted before an interview can be created' using errcode = 'P0001';
  end if;
  if p_scheduled_at < now() - interval '5 minutes' then raise exception 'interview time must be in the future' using errcode = 'P0001'; end if;
  if v_dur not between 15 and 240 then raise exception 'interview duration must be between 15 and 240 minutes' using errcode = 'P0001'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then raise exception 'unknown time zone' using errcode = 'P0001'; end if;
  if coalesce(cardinality(p_interviewers), 0) = 0 then raise exception 'assign at least one interviewer' using errcode = 'P0001'; end if;
  foreach v_u in array p_interviewers loop
    if not exists (select 1 from public.company_memberships where company_id = v_app.company_id and user_id = v_u and status = 'active') then
      raise exception 'interviewers must be members of the company' using errcode = 'P0001';
    end if;
  end loop;
  -- The candidate cannot be double-booked across their interviews.
  if exists (select 1 from public.interviews i join public.applications a on a.id = i.application_id
             where a.candidate_id = v_app.candidate_id and i.status = 'scheduled'
               and tstzrange(i.scheduled_at, i.ends_at, '[)') && tstzrange(p_scheduled_at, p_scheduled_at + make_interval(mins => v_dur), '[)')) then
    raise exception 'the candidate already has an interview at that time' using errcode = '23P01';
  end if;

  insert into public.interviews (application_id, company_id, title, type, scheduled_at, duration_minutes, timezone, location, meeting_url, instructions, created_by)
  values (p_application, v_app.company_id, coalesce(nullif(trim(p_title), ''), 'Interview'), p_type, p_scheduled_at, v_dur,
    v_tz, p_location, p_meeting_url, p_instructions, auth.uid())
  returning id into v_id;
  v_when := to_char(p_scheduled_at at time zone v_tz, 'YYYY-MM-DD HH24:MI') || ' (' || v_tz || ')';
  foreach v_u in array (select array_agg(distinct x) from unnest(p_interviewers) x) loop
    -- NO "on conflict do nothing": it would silently swallow the exclusion-constraint violation.
    -- An interviewer who is already booked at an overlapping time raises 23P01 and aborts the whole call.
    insert into public.interview_participants (interview_id, user_id, role) values (v_id, v_u, 'interviewer');
    perform public.notify(v_u, 'interview_assigned', 'You were assigned to an interview', 'تم تعيينك لإجراء مقابلة', v_when, v_when, '/company/interviews/' || v_id);
  end loop;
  if v_app.status <> 'interview_scheduled' then
    perform public._transition_application(p_application, 'interview_scheduled', 'Interview scheduled', null);
  end if;
  select * into v_job from public.jobs where id = v_app.job_id;
  perform public.notify(v_app.candidate_id, 'interview_scheduled', 'Interview invitation: ' || v_job.title_en, 'دعوة لمقابلة: ' || v_job.title_ar,
    v_when || ' — please confirm your attendance', v_when || ' — يرجى تأكيد حضورك', '/candidate/interviews');
  perform public.write_audit('interview.created', 'interview', v_id, v_app.company_id,
    jsonb_build_object('application', p_application, 'scheduled_at', p_scheduled_at, 'duration', v_dur, 'interviewers', p_interviewers));
  return v_id;
end $$;
