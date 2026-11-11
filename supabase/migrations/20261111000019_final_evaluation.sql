-- JADARAH — 0019 comprehensive post-interview evaluation.
-- Company-editable interview rubric, Final Candidate Evaluation (draft → finalized, locked), reviewer
-- comments with attribution, AI-assisted report storage, human decision through the existing status
-- machine (hire allowed without shortlisting), and explicit candidate feedback sharing. Internal to
-- the company (RLS); candidates only see feedback that was explicitly shared.

-- ---------------------------------------------------------------- interview rubric (per company)
create table public.interview_rubrics (
  company_id uuid primary key references public.company_profiles (id) on delete cascade,
  criteria jsonb not null check (jsonb_typeof(criteria) = 'array' and jsonb_array_length(criteria) between 1 and 12),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
alter table public.interview_rubrics enable row level security;
create policy interview_rubrics_read on public.interview_rubrics for select to authenticated
  using (public.has_company_role(company_id));
create policy interview_rubrics_write on public.interview_rubrics for all to authenticated
  using (public.can_recruit(company_id)) with check (public.can_recruit(company_id));
grant select, insert, update on public.interview_rubrics to authenticated;

-- ---------------------------------------------------------------- final evaluation
create table public.final_evaluations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications (id) on delete cascade,
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  ai_report jsonb,
  ai_provider text,
  ai_model text,
  ai_generated_at timestamptz,
  ai_generated_by uuid references public.profiles (id),
  summary text check (summary is null or length(summary) <= 4000),
  decision text check (decision in ('hire', 'reject', 'hold')),
  decision_rationale text check (decision_rationale is null or length(decision_rationale) <= 2000),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  finalized_by uuid references public.profiles (id),
  finalized_at timestamptz,
  candidate_feedback text check (candidate_feedback is null or length(candidate_feedback) <= 3000),
  feedback_shared_at timestamptz,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index final_evaluations_company on public.final_evaluations (company_id);

create or replace function public.final_evaluations_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- company must own the application
  if not exists (select 1 from public.applications a where a.id = new.application_id and a.company_id = new.company_id) then
    raise exception 'company does not own this application' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'finalized' and current_setting('jadarah.final_eval_rpc', true) is distinct from 'on' then
      raise exception 'a finalized evaluation is locked' using errcode = 'P0001';
    end if;
    -- workflow columns are set only by the RPCs below
    if current_setting('jadarah.final_eval_rpc', true) is distinct from 'on' and (
         new.status is distinct from old.status or new.decision is distinct from old.decision
         or new.decided_by is distinct from old.decided_by or new.finalized_by is distinct from old.finalized_by
         or new.candidate_feedback is distinct from old.candidate_feedback
         or new.feedback_shared_at is distinct from old.feedback_shared_at) then
      raise exception 'use the decision/sharing workflow' using errcode = '42501';
    end if;
  elsif new.status <> 'draft' or new.decision is not null or new.candidate_feedback is not null then
    raise exception 'new evaluations start as drafts' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger final_evaluations_guard before insert or update on public.final_evaluations
  for each row execute function public.final_evaluations_guard();

alter table public.final_evaluations enable row level security;
create policy final_evaluations_read on public.final_evaluations for select to authenticated
  using (public.can_recruit(company_id));
create policy final_evaluations_insert on public.final_evaluations for insert to authenticated
  with check (public.can_recruit(company_id));
create policy final_evaluations_update on public.final_evaluations for update to authenticated
  using (public.can_recruit(company_id)) with check (public.can_recruit(company_id));
grant select, insert, update on public.final_evaluations to authenticated;

create table public.final_evaluation_comments (
  id uuid primary key default gen_random_uuid(),
  final_evaluation_id uuid not null references public.final_evaluations (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id),
  body text not null check (length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);
alter table public.final_evaluation_comments enable row level security;
create policy final_evaluation_comments_read on public.final_evaluation_comments for select to authenticated
  using (exists (select 1 from public.final_evaluations f where f.id = final_evaluation_id and public.can_recruit(f.company_id)));
create policy final_evaluation_comments_insert on public.final_evaluation_comments for insert to authenticated
  with check (author_id = (select auth.uid())
    and exists (select 1 from public.final_evaluations f where f.id = final_evaluation_id and public.can_recruit(f.company_id)));
grant select, insert on public.final_evaluation_comments to authenticated;

-- ---------------------------------------------------------------- workflow RPCs
-- Human decision + finalize. hire/reject go through change_application_status (status machine,
-- hire-without-shortlist rule, audit, candidate notification); hold changes no status.
create or replace function public.decide_final_evaluation(p_eval uuid, p_decision text, p_rationale text, p_candidate_message text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.final_evaluations; v_app public.applications;
begin
  select * into v from public.final_evaluations where id = p_eval for update;
  if v.id is null or not public.can_recruit(v.company_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  if v.status = 'finalized' then raise exception 'a finalized evaluation is locked' using errcode = 'P0001'; end if;
  if p_decision not in ('hire', 'reject', 'hold') then raise exception 'unknown decision' using errcode = 'P0001'; end if;
  if coalesce(length(trim(p_rationale)), 0) < 10 then raise exception 'explain the decision (at least 10 characters)' using errcode = 'P0001'; end if;
  select * into v_app from public.applications where id = v.application_id;
  if p_decision = 'hire' and v_app.status <> 'hired' then
    perform public.change_application_status(v.application_id, 'hired', p_rationale, p_candidate_message);
  elsif p_decision = 'reject' and v_app.status <> 'rejected' then
    perform public.change_application_status(v.application_id, 'rejected', p_rationale, p_candidate_message);
  end if;
  perform set_config('jadarah.final_eval_rpc', 'on', true);
  update public.final_evaluations
     set decision = p_decision, decision_rationale = p_rationale, decided_by = auth.uid(), decided_at = now(),
         status = 'finalized', finalized_by = auth.uid(), finalized_at = now()
   where id = p_eval;
  perform set_config('jadarah.final_eval_rpc', 'off', true);
  perform public.write_audit('final_evaluation.decided', 'application', v.application_id, v.company_id,
    jsonb_build_object('decision', p_decision, 'evaluation', p_eval));
end $$;

-- Share selected feedback with the candidate (explicit, audited, notifies the candidate).
create or replace function public.share_final_feedback(p_eval uuid, p_feedback text)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.final_evaluations; v_cand uuid;
begin
  select * into v from public.final_evaluations where id = p_eval for update;
  if v.id is null or not public.can_recruit(v.company_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  if coalesce(length(trim(p_feedback)), 0) < 10 then raise exception 'feedback is too short' using errcode = 'P0001'; end if;
  perform set_config('jadarah.final_eval_rpc', 'on', true);
  update public.final_evaluations set candidate_feedback = left(p_feedback, 3000), feedback_shared_at = now() where id = p_eval;
  perform set_config('jadarah.final_eval_rpc', 'off', true);
  select candidate_id into v_cand from public.applications where id = v.application_id;
  perform public.notify(v_cand, 'final_feedback', 'Feedback on your application', 'ملاحظات على طلبك', null, null,
    '/candidate/applications/' || v.application_id);
  perform public.write_audit('final_evaluation.feedback_shared', 'application', v.application_id, v.company_id, '{}');
end $$;

-- Candidate-safe read: only the explicitly shared feedback, only for their own application.
create or replace function public.get_shared_final_feedback(p_app uuid)
returns table (feedback text, shared_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select f.candidate_feedback, f.feedback_shared_at
    from public.final_evaluations f join public.applications a on a.id = f.application_id
   where f.application_id = p_app and a.candidate_id = auth.uid() and f.feedback_shared_at is not null;
$$;

revoke all on function public.final_evaluations_guard() from public, anon, authenticated;
revoke all on function public.decide_final_evaluation(uuid, text, text, text) from public, anon;
revoke all on function public.share_final_feedback(uuid, text) from public, anon;
revoke all on function public.get_shared_final_feedback(uuid) from public, anon;
grant execute on function public.decide_final_evaluation(uuid, text, text, text) to authenticated;
grant execute on function public.share_final_feedback(uuid, text) to authenticated;
grant execute on function public.get_shared_final_feedback(uuid) to authenticated;
