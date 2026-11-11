-- JADARAH — 0016 internal interview calendar: availability, DB-enforced conflict prevention,
-- free/busy, attendance confirmation, richer notifications and scheduled reminders (pg_cron).
-- All timestamps are timestamptz (UTC at rest); display time zone defaults to Asia/Riyadh.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------- interview time window
alter table public.interviews add column if not exists ends_at timestamptz;
alter table public.interviews add column if not exists candidate_confirmed_at timestamptz;

create or replace function public.interviews_set_window()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.ends_at := new.scheduled_at + make_interval(mins => new.duration_minutes);
  if tg_op = 'UPDATE' and new.scheduled_at is distinct from old.scheduled_at then
    new.candidate_confirmed_at := null; -- a new time needs a new confirmation
  end if;
  return new;
end $$;
drop trigger if exists interviews_set_window on public.interviews;
create trigger interviews_set_window before insert or update of scheduled_at, duration_minutes on public.interviews
  for each row execute function public.interviews_set_window();
update public.interviews set ends_at = scheduled_at + make_interval(mins => duration_minutes) where ends_at is null;
alter table public.interviews alter column ends_at set not null;
alter table public.interviews add constraint interviews_duration_range check (duration_minutes between 15 and 240) not valid;

-- ---------------------------------------------------------------- per-participant booking + exclusion constraint
alter table public.interview_participants add column if not exists during tstzrange;
alter table public.interview_participants add column if not exists active boolean not null default true;

create or replace function public.interview_participants_set_window()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.interviews;
begin
  select * into v from public.interviews where id = new.interview_id;
  new.during := tstzrange(v.scheduled_at, v.ends_at, '[)');
  new.active := v.status = 'scheduled';
  return new;
end $$;
drop trigger if exists interview_participants_set_window on public.interview_participants;
create trigger interview_participants_set_window before insert on public.interview_participants
  for each row execute function public.interview_participants_set_window();

create or replace function public.interviews_sync_participants()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.interview_participants
     set during = tstzrange(new.scheduled_at, new.ends_at, '[)'), active = new.status = 'scheduled'
   where interview_id = new.id;
  return null;
end $$;
drop trigger if exists interviews_sync_participants on public.interviews;
create trigger interviews_sync_participants after update of scheduled_at, duration_minutes, status, ends_at on public.interviews
  for each row execute function public.interviews_sync_participants();

update public.interview_participants ip
   set during = tstzrange(i.scheduled_at, i.ends_at, '[)'), active = i.status = 'scheduled'
  from public.interviews i where i.id = ip.interview_id;
alter table public.interview_participants alter column during set not null;

-- The authoritative double-booking guard: no interviewer in two active interviews at overlapping times.
alter table public.interview_participants add constraint interview_participants_no_overlap
  exclude using gist (user_id with =, during with &&) where (active);

-- ---------------------------------------------------------------- weekly availability
create table public.interviewer_availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440),
  timezone text not null default 'Asia/Riyadh',
  created_at timestamptz not null default now(),
  check (end_minute > start_minute),
  exclude using gist (user_id with =, company_id with =, weekday with =, int4range(start_minute::int, end_minute::int) with &&)
);
create index interviewer_availability_company on public.interviewer_availability (company_id, user_id);
alter table public.interviewer_availability enable row level security;
create policy interviewer_availability_read on public.interviewer_availability for select to authenticated
  using (public.has_company_role(company_id));
create policy interviewer_availability_write on public.interviewer_availability for all to authenticated
  using ((user_id = (select auth.uid()) and public.has_company_role(company_id))
         or public.has_company_role(company_id, array['company_admin']::public.membership_role[]))
  with check (
    exists (select 1 from public.company_memberships m where m.company_id = interviewer_availability.company_id
            and m.user_id = interviewer_availability.user_id and m.status = 'active')
    and ((user_id = (select auth.uid()) and public.has_company_role(company_id))
         or public.has_company_role(company_id, array['company_admin']::public.membership_role[])));
grant select, insert, update, delete on public.interviewer_availability to authenticated;

-- ---------------------------------------------------------------- reminders ledger (idempotency)
create table public.interview_reminders (
  interview_id uuid not null references public.interviews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('reminder_24h', 'reminder_1h', 'evaluation_due')),
  for_time timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (interview_id, user_id, kind, for_time)
);
alter table public.interview_reminders enable row level security; -- no API access; written by the scheduler only

-- ---------------------------------------------------------------- free/busy for scheduling
-- Busy windows of the given company members (any company — only times, never interview details).
create or replace function public.interviewer_busy(p_company uuid, p_users uuid[], p_from timestamptz, p_to timestamptz)
returns table (user_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_recruit(p_company) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_to - p_from > interval '62 days' then raise exception 'range too large' using errcode = 'P0001'; end if;
  return query
    select ip.user_id, lower(ip.during), upper(ip.during)
      from public.interview_participants ip
     where ip.active
       and ip.user_id = any (p_users)
       and ip.user_id in (select m.user_id from public.company_memberships m where m.company_id = p_company and m.status = 'active')
       and ip.during && tstzrange(p_from, p_to, '[)');
end $$;

-- ---------------------------------------------------------------- scheduling RPCs (business rules preserved)
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
  foreach v_u in array p_interviewers loop
    -- the exclusion constraint rejects an interviewer who is already booked (23P01)
    insert into public.interview_participants (interview_id, user_id, role) values (v_id, v_u, 'interviewer') on conflict do nothing;
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

create or replace function public.set_interview_status(p_interview uuid, p_status public.interview_status, p_new_time timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_i public.interviews; v_app public.applications; v_u uuid; v_when text;
begin
  select * into v_i from public.interviews where id = p_interview for update;
  if v_i.id is null or not public.can_recruit(v_i.company_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v_app from public.applications where id = v_i.application_id;
  if p_status = 'scheduled' and p_new_time is not null then
    if p_new_time < now() - interval '5 minutes' then raise exception 'interview time must be in the future' using errcode = 'P0001'; end if;
    if exists (select 1 from public.interviews i join public.applications a on a.id = i.application_id
               where a.candidate_id = v_app.candidate_id and i.status = 'scheduled' and i.id <> p_interview
                 and tstzrange(i.scheduled_at, i.ends_at, '[)') && tstzrange(p_new_time, p_new_time + make_interval(mins => v_i.duration_minutes), '[)')) then
      raise exception 'the candidate already has an interview at that time' using errcode = '23P01';
    end if;
    -- (behaviour preserved: rescheduling also re-activates a cancelled interview)
    update public.interviews set scheduled_at = p_new_time, status = 'scheduled' where id = p_interview; -- exclusion constraint re-checks interviewers
    v_when := to_char(p_new_time at time zone v_i.timezone, 'YYYY-MM-DD HH24:MI') || ' (' || v_i.timezone || ')';
    perform public.notify(v_app.candidate_id, 'interview_changed', 'Your interview was rescheduled', 'تم تغيير موعد مقابلتك',
      v_when || ' — please confirm again', v_when || ' — يرجى التأكيد مجددًا', '/candidate/interviews');
    for v_u in select user_id from public.interview_participants where interview_id = p_interview loop
      perform public.notify(v_u, 'interview_changed', 'Interview rescheduled', 'تم تغيير موعد المقابلة', v_when, v_when, '/company/interviews/' || p_interview);
    end loop;
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
    perform public.notify(v_app.candidate_id, 'interview_changed', 'Your interview was cancelled', 'تم إلغاء مقابلتك', null, null, '/candidate/interviews');
    for v_u in select user_id from public.interview_participants where interview_id = p_interview loop
      perform public.notify(v_u, 'interview_changed', 'Interview cancelled', 'تم إلغاء المقابلة', null, null, '/company/interviews/' || p_interview);
    end loop;
  end if;
  perform public.write_audit('interview.' || p_status::text, 'interview', p_interview, v_i.company_id,
    case when p_new_time is not null then jsonb_build_object('from', v_i.scheduled_at, 'to', p_new_time) else '{}'::jsonb end);
end $$;

-- Candidate confirms attendance for their own upcoming interview.
create or replace function public.confirm_interview_attendance(p_interview uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_i public.interviews; v_app public.applications; v_u uuid;
begin
  select * into v_i from public.interviews where id = p_interview for update;
  select * into v_app from public.applications where id = v_i.application_id;
  if v_i.id is null or v_app.candidate_id <> auth.uid() then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_i.status <> 'scheduled' or v_i.ends_at < now() then raise exception 'this interview can no longer be confirmed' using errcode = 'P0001'; end if;
  update public.interviews set candidate_confirmed_at = now() where id = p_interview;
  for v_u in select user_id from public.interview_participants where interview_id = p_interview loop
    perform public.notify(v_u, 'interview_confirmed', 'Candidate confirmed attendance', 'أكّد المرشح حضوره', null, null, '/company/interviews/' || p_interview);
  end loop;
  perform public.write_audit('interview.confirmed', 'interview', p_interview, v_i.company_id, '{}');
end $$;

-- ---------------------------------------------------------------- scheduled reminders (idempotent)
create or replace function public.send_interview_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare r record; v_n int := 0; v_when text; v_u uuid;
begin
  -- 24 h and 1 h before (candidate + interviewers), once per scheduled time.
  for r in
    select i.id, i.scheduled_at, i.timezone, a.candidate_id, j.title_en, j.title_ar,
           case when i.scheduled_at - now() <= interval '1 hour' then 'reminder_1h' else 'reminder_24h' end as kind
      from public.interviews i
      join public.applications a on a.id = i.application_id
      join public.jobs j on j.id = a.job_id
     where i.status = 'scheduled' and i.scheduled_at > now() and i.scheduled_at <= now() + interval '24 hours'
  loop
    v_when := to_char(r.scheduled_at at time zone r.timezone, 'YYYY-MM-DD HH24:MI') || ' (' || r.timezone || ')';
    insert into public.interview_reminders (interview_id, user_id, kind, for_time) values (r.id, r.candidate_id, r.kind, r.scheduled_at)
      on conflict do nothing;
    if found then
      perform public.notify(r.candidate_id, 'interview_reminder',
        case when r.kind = 'reminder_1h' then 'Your interview starts within the hour' else 'Interview tomorrow: ' || r.title_en end,
        case when r.kind = 'reminder_1h' then 'تبدأ مقابلتك خلال ساعة' else 'مقابلة غدًا: ' || r.title_ar end,
        v_when, v_when, '/candidate/interviews');
      v_n := v_n + 1;
    end if;
    for v_u in select ip.user_id from public.interview_participants ip where ip.interview_id = r.id loop
      insert into public.interview_reminders (interview_id, user_id, kind, for_time) values (r.id, v_u, r.kind, r.scheduled_at)
        on conflict do nothing;
      if found then
        perform public.notify(v_u, 'interview_reminder',
          case when r.kind = 'reminder_1h' then 'Interview starts within the hour' else 'Interview tomorrow: ' || r.title_en end,
          case when r.kind = 'reminder_1h' then 'تبدأ المقابلة خلال ساعة' else 'مقابلة غدًا: ' || r.title_ar end,
          v_when, v_when, '/company/interviews/' || r.id);
        v_n := v_n + 1;
      end if;
    end loop;
  end loop;

  -- Evaluation reminder: 30 min after the end, for interviewers who have not submitted an evaluation.
  for r in
    select i.id, i.ends_at, ip.user_id
      from public.interviews i
      join public.interview_participants ip on ip.interview_id = i.id
     where i.status in ('scheduled', 'completed')
       and i.ends_at < now() - interval '30 minutes' and i.ends_at > now() - interval '2 days'
       and not exists (select 1 from public.interview_evaluations e where e.interview_id = i.id and e.interviewer_id = ip.user_id)
  loop
    insert into public.interview_reminders (interview_id, user_id, kind, for_time) values (r.id, r.user_id, 'evaluation_due', r.ends_at)
      on conflict do nothing;
    if found then
      perform public.notify(r.user_id, 'evaluation_reminder', 'Please submit your interview evaluation', 'يرجى إرسال تقييمك للمقابلة',
        null, null, '/company/interviews/' || r.id);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

revoke all on function public.interviewer_busy(uuid, uuid[], timestamptz, timestamptz) from public, anon;
revoke all on function public.confirm_interview_attendance(uuid) from public, anon;
revoke all on function public.send_interview_reminders() from public, anon, authenticated;
revoke all on function public.interviews_set_window() from public, anon, authenticated;
revoke all on function public.interview_participants_set_window() from public, anon, authenticated;
revoke all on function public.interviews_sync_participants() from public, anon, authenticated;
grant execute on function public.interviewer_busy(uuid, uuid[], timestamptz, timestamptz) to authenticated;
grant execute on function public.confirm_interview_attendance(uuid) to authenticated;

-- Run reminders every 5 minutes (server-side, independent of any browser).
create extension if not exists pg_cron;
select cron.schedule('jadarah-interview-reminders', '*/5 * * * *', $cron$select public.send_interview_reminders()$cron$);
