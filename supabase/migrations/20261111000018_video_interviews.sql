-- JADARAH — 0018 Daily.co video interviews: private room per interview, server-side access checks,
-- attendance tracking. The Daily API key never leaves the Next.js server; tokens are minted there
-- only after public.interview_video_access() confirms the caller belongs to the interview.

alter table public.interviews add column if not exists video_room_name text;
alter table public.interviews add column if not exists video_room_url text;
alter table public.interviews add constraint interviews_video_room_name_format
  check (video_room_name is null or video_room_name ~ '^jdr-[a-z0-9-]{8,60}$');
alter table public.interviews add constraint interviews_video_room_url_format
  check (video_room_url is null or video_room_url ~ '^https://[a-z0-9-]+\.daily\.co/jdr-[a-z0-9-]{8,60}$');

create table public.interview_attendance (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('candidate', 'interviewer')),
  joined_at timestamptz not null default now(),
  left_at timestamptz
);
create index interview_attendance_interview on public.interview_attendance (interview_id, user_id);
alter table public.interview_attendance enable row level security;
create policy interview_attendance_read on public.interview_attendance for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_interview_participant(interview_id)
    or exists (select 1 from public.interviews i where i.id = interview_id and public.can_recruit(i.company_id))
  );
grant select on public.interview_attendance to authenticated; -- writes only via record_interview_presence()

-- Who is the caller to this interview? candidate (own application) | interviewer (assigned) — else 42501.
create or replace function public.interview_video_access(p_interview uuid)
returns table (
  access_role text, title text, status public.interview_status, scheduled_at timestamptz, ends_at timestamptz,
  timezone text, room_name text, room_url text, display_name text, company_name_en text, company_name_ar text,
  job_title_en text, job_title_ar text
)
language plpgsql stable security definer set search_path = '' as $$
declare v_role text;
begin
  select case
           when a.candidate_id = auth.uid() then 'candidate'
           when exists (select 1 from public.interview_participants ip where ip.interview_id = i.id and ip.user_id = auth.uid()) then 'interviewer'
         end
    into v_role
    from public.interviews i join public.applications a on a.id = i.application_id
   where i.id = p_interview;
  if v_role is null then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select v_role, i.title, i.status, i.scheduled_at, i.ends_at, i.timezone, i.video_room_name, i.video_room_url,
           coalesce(p.full_name, 'Participant'), c.name_en, c.name_ar, j.title_en, j.title_ar
      from public.interviews i
      join public.applications a on a.id = i.application_id
      join public.jobs j on j.id = a.job_id
      join public.company_profiles c on c.id = i.company_id
      left join public.profiles p on p.id = auth.uid()
     where i.id = p_interview;
end $$;

-- Attach the server-created Daily room (recruiters of the company or assigned interviewers only; set once).
create or replace function public.attach_video_room(p_interview uuid, p_name text, p_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.interviews;
begin
  select * into v from public.interviews where id = p_interview for update;
  if v.id is null or not (public.can_recruit(v.company_id) or exists (
       select 1 from public.interview_participants ip where ip.interview_id = v.id and ip.user_id = auth.uid())) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v.video_room_name is not null and v.video_room_name <> p_name then
    raise exception 'a video room is already attached' using errcode = 'P0001';
  end if;
  update public.interviews set video_room_name = p_name, video_room_url = p_url where id = p_interview;
  perform public.write_audit('interview.video_room_attached', 'interview', p_interview, v.company_id, jsonb_build_object('room', p_name));
end $$;

-- Detach (after the server deleted/replaced the Daily room) — recruiters only.
create or replace function public.detach_video_room(p_interview uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.interviews;
begin
  select * into v from public.interviews where id = p_interview for update;
  if v.id is null or not public.can_recruit(v.company_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.interviews set video_room_name = null, video_room_url = null where id = p_interview;
end $$;

-- Join/leave tracking from the embedded call (candidate or assigned interviewer only).
create or replace function public.record_interview_presence(p_interview uuid, p_event text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_role text; v_company uuid; v_open uuid;
begin
  select case
           when a.candidate_id = auth.uid() then 'candidate'
           when exists (select 1 from public.interview_participants ip where ip.interview_id = i.id and ip.user_id = auth.uid()) then 'interviewer'
         end, i.company_id
    into v_role, v_company
    from public.interviews i join public.applications a on a.id = i.application_id
   where i.id = p_interview;
  if v_role is null then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_event = 'joined' then
    insert into public.interview_attendance (interview_id, user_id, role) values (p_interview, auth.uid(), v_role);
    perform public.write_audit('interview.joined', 'interview', p_interview, v_company, jsonb_build_object('role', v_role));
  elsif p_event = 'left' then
    select id into v_open from public.interview_attendance
     where interview_id = p_interview and user_id = auth.uid() and left_at is null order by joined_at desc limit 1;
    if v_open is not null then update public.interview_attendance set left_at = now() where id = v_open; end if;
  else
    raise exception 'unknown event' using errcode = 'P0001';
  end if;
end $$;

revoke all on function public.interview_video_access(uuid) from public, anon;
revoke all on function public.attach_video_room(uuid, text, text) from public, anon;
revoke all on function public.detach_video_room(uuid) from public, anon;
revoke all on function public.record_interview_presence(uuid, text) from public, anon;
grant execute on function public.interview_video_access(uuid) to authenticated;
grant execute on function public.attach_video_room(uuid, text, text) to authenticated;
grant execute on function public.detach_video_room(uuid) to authenticated;
grant execute on function public.record_interview_presence(uuid, text) to authenticated;
