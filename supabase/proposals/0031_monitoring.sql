-- JADARAH — 0031 monitoring instrumentation  (PROPOSED — requires owner approval; additive and reversible)
-- The application works without it: AI logging falls back to the existing columns, fallback correlation then uses a
-- clearly-labelled time-window heuristic, and alerts are shown on the monitoring page without in-app notifications.
--  A. Exact correlation of AI attempts: request_id (one logical operation), attempt number, fallback flag.
--  B. Indexes for period-filtered server-side aggregation.
--  C. raise_monitoring_alert(): in-app notification to Super Admins with de-duplication and a cooldown.
--  D. monitoring_assessment_generations(): metadata-only Assessment Builder records for Super Admin monitoring.
-- Rollback: drop function public.monitoring_assessment_generations(timestamptz, timestamptz);
--           drop function public.raise_monitoring_alert(text, text, text, integer); drop table private.monitoring_alerts;
--           drop index if exists ...; alter table public.ai_provider_logs drop column request_id, drop column attempt,
--           drop column is_fallback;

-- =================================================================== A. correlation
alter table public.ai_provider_logs
  add column if not exists request_id uuid,
  add column if not exists attempt smallint check (attempt is null or attempt between 1 and 50),
  add column if not exists is_fallback boolean;

-- =================================================================== B. indexes
create index if not exists ai_provider_logs_request_idx on public.ai_provider_logs (request_id) where request_id is not null;
create index if not exists ai_provider_logs_provider_time_idx on public.ai_provider_logs (provider, created_at desc);
create index if not exists ai_provider_logs_operation_time_idx on public.ai_provider_logs (operation, created_at desc);
create index if not exists ai_generation_records_kind_time_idx on public.ai_generation_records (kind, created_at desc);
create index if not exists assessment_generations_time_idx on public.assessment_generations (created_at desc);
create index if not exists applications_submitted_idx on public.applications (submitted_at desc);

-- =================================================================== C. alerts → in-app notifications
create schema if not exists private;
create table if not exists private.monitoring_alerts (
  key text primary key check (key ~ '^[a-z0-9_.:-]{3,80}$'),
  last_raised_at timestamptz not null,
  raised_count integer not null default 1,
  last_detail text
);

-- Raises an alert once per cooldown window: every active Super Admin gets one in-app notification.
-- Only Super Admins can call it (the monitoring page evaluates thresholds server-side, then calls this).
create or replace function public.raise_monitoring_alert(p_key text, p_title_en text, p_title_ar text, p_cooldown_minutes integer default 360)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_last timestamptz; r record;
begin
  if not public.is_super_admin() then raise exception 'super admin only' using errcode = '42501'; end if;
  if p_key !~ '^[a-z0-9_.:-]{3,80}$' then raise exception 'invalid alert key' using errcode = '22023'; end if;
  select last_raised_at into v_last from private.monitoring_alerts where key = p_key for update;
  if v_last is not null and v_last > now() - make_interval(mins => greatest(15, least(p_cooldown_minutes, 10080))) then
    return false; -- de-duplicated: still inside the cooldown
  end if;
  insert into private.monitoring_alerts (key, last_raised_at, last_detail) values (p_key, now(), left(p_title_en, 300))
  on conflict (key) do update set last_raised_at = now(), raised_count = private.monitoring_alerts.raised_count + 1,
    last_detail = left(p_title_en, 300);
  for r in select ur.user_id from public.user_roles ur join public.profiles p on p.id = ur.user_id
           where ur.role = 'super_admin' and p.status = 'active' loop
    perform public.notify(r.user_id, 'monitoring_alert', left(p_title_en, 200), left(p_title_ar, 200), null, null, '/admin/monitoring');
  end loop;
  perform public.write_audit('monitoring.alert_raised', 'monitoring_alert', null, null, jsonb_build_object('key', p_key));
  return true;
end $$;
revoke all on function public.raise_monitoring_alert(text, text, text, integer) from public, anon;
grant execute on function public.raise_monitoring_alert(text, text, text, integer) to authenticated;

-- =================================================================== D. Assessment Builder metadata for monitoring
-- assessment_generations rows contain full drafts (incl. confidential assessor guidance) and are readable only by the
-- company's recruiters. Monitoring needs metadata only, so Super Admins get this aggregate-friendly view instead of a
-- wider RLS policy: no task text, rubric, assessor guide or job snapshot is returned.
create or replace function public.monitoring_assessment_generations(p_from timestamptz, p_to timestamptz)
returns table (assessment_id uuid, company_id uuid, status text, model text, checks jsonb, refs integer,
               created_at timestamptz, assessment_status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'super admin only' using errcode = '42501'; end if;
  return query
    select g.assessment_id, g.company_id, g.status, g.model,
           coalesce((select jsonb_agg(jsonb_build_object('check', c->>'check', 'passed', (c->>'passed')::boolean))
                       from jsonb_array_elements(coalesce(g.validation, '[]'::jsonb)) c), '[]'::jsonb),
           jsonb_array_length(coalesce(g.references_used, '[]'::jsonb)), g.created_at, a.status
      from public.assessment_generations g
      left join public.assessments a on a.id = g.assessment_id
     where g.created_at >= p_from and g.created_at < p_to
     order by g.created_at;
end $$;
revoke all on function public.monitoring_assessment_generations(timestamptz, timestamptz) from public, anon;
grant execute on function public.monitoring_assessment_generations(timestamptz, timestamptz) to authenticated;
-- Rollback (D): drop function public.monitoring_assessment_generations(timestamptz, timestamptz);
