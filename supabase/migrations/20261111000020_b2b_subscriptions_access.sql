-- JADARAH — 0020 B2B foundation: administratively provisioned organizations, subscriptions,
-- payments ledger, employee access requests with Super Admin approval, brand profiles, catalogue
-- publication. No company-count limit anywhere: eligibility is data-driven.

-- ---------------------------------------------------------------- organizations
alter table public.company_profiles
  add column if not exists registry_id text unique,
  add column if not exists organization_type text,
  add column if not exists sector_en text,
  add column if not exists sector_ar text,
  add column if not exists careers_url text,
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('verified_official', 'pending_live_verification', 'unverified')),
  add column if not exists partnership_status text not null default 'not_partner'
    check (partnership_status in ('not_partner', 'partner')),
  add column if not exists listed boolean not null default false,            -- shown in the public catalogue
  add column if not exists accepts_access_requests boolean not null default false,
  add column if not exists provenance jsonb not null default '{}'::jsonb;

create table public.company_brand_profiles (
  company_id uuid primary key references public.company_profiles (id) on delete cascade,
  logo_path text,                      -- private/public storage path of an AUTHORIZED logo only
  logo_source_url text,
  primary_hex text check (primary_hex is null or primary_hex ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_hex text check (secondary_hex is null or secondary_hex ~ '^#[0-9A-Fa-f]{6}$'),
  brand_source text,
  identity_status text not null default 'not_verified' check (identity_status in ('not_verified', 'verified')),
  usage_permission text not null default 'not_verified' check (usage_permission in ('not_verified', 'granted', 'denied')),
  notes text,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
alter table public.company_brand_profiles enable row level security;
-- Public read; the UI only renders a logo/colours when identity is verified AND usage is granted.
create policy brand_read on public.company_brand_profiles for select to anon, authenticated using (true);
create policy brand_admin on public.company_brand_profiles for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
grant select on public.company_brand_profiles to anon, authenticated;
grant insert, update, delete on public.company_brand_profiles to authenticated;

create table public.company_aliases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  alias text not null,
  language text not null default 'ar',
  alias_status text not null default 'common',
  unique (company_id, alias)
);
alter table public.company_aliases enable row level security;
create policy aliases_admin on public.company_aliases for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
grant select, insert, update, delete on public.company_aliases to authenticated;

-- ---------------------------------------------------------------- subscriptions & revenue
create table public.company_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.company_profiles (id) on delete cascade,
  plan text not null default 'standard',
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'expired', 'cancelled')),
  price_sar numeric(12, 2) check (price_sar is null or price_sar >= 0),   -- agreed contract value (null = not set)
  billing_period text check (billing_period in ('monthly', 'quarterly', 'annual', 'one_time', 'custom')),
  starts_on date,
  expires_on date,
  assessment_credits int check (assessment_credits is null or assessment_credits >= 0), -- null = unlimited
  credits_used int not null default 0 check (credits_used >= 0),
  payment_status text not null default 'not_invoiced'
    check (payment_status in ('not_invoiced', 'invoiced', 'partially_paid', 'paid', 'waived', 'demo')),
  is_demo boolean not null default false,  -- controlled demonstration access, NOT a real payment
  commercial_notes text,
  activated_by uuid references public.profiles (id),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on is null or starts_on is null or expires_on >= starts_on)
);
alter table public.company_subscriptions enable row level security;
create policy subs_admin on public.company_subscriptions for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
-- company admins can see their own subscription (status, validity, credits)
create policy subs_company_read on public.company_subscriptions for select to authenticated
  using (exists (select 1 from public.company_memberships m where m.company_id = company_subscriptions.company_id
                 and m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'company_admin'));
grant select, insert, update on public.company_subscriptions to authenticated;

-- Actual recorded payments (contract value ≠ revenue). Super Admin only.
create table public.company_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  subscription_id uuid references public.company_subscriptions (id) on delete set null,
  kind text not null default 'payment' check (kind in ('payment', 'refund')),
  amount_sar numeric(12, 2) not null check (amount_sar > 0),
  paid_on date not null,
  reference text,
  notes text,
  recorded_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.company_payments enable row level security;
create policy payments_admin on public.company_payments for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
grant select, insert, update, delete on public.company_payments to authenticated;

create or replace function public.company_subscriptions_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    new.activated_at := now();
    new.activated_by := coalesce(auth.uid(), new.activated_by);
  end if;
  return new;
end $$;
create trigger company_subscriptions_touch before insert or update on public.company_subscriptions
  for each row execute function public.company_subscriptions_touch();

create or replace function public.company_subscriptions_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.write_audit('subscription.' || lower(tg_op), 'company', new.company_id, new.company_id,
    jsonb_build_object('status', new.status, 'plan', new.plan, 'expires_on', new.expires_on,
                       'credits', new.assessment_credits, 'is_demo', new.is_demo));
  return new;
end $$;
create trigger company_subscriptions_audit after insert or update on public.company_subscriptions
  for each row execute function public.company_subscriptions_audit();

-- Paid employer services require: approved organization + active, in-date subscription.
create or replace function public.company_service_active(p_company uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_profiles c
    join public.company_subscriptions s on s.company_id = c.id
    where c.id = p_company and c.status = 'approved' and s.status = 'active'
      and (s.starts_on is null or s.starts_on <= current_date)
      and (s.expires_on is null or s.expires_on >= current_date)
  );
$$;

-- Central employer gate: every company RLS policy and RPC flows through has_company_role/can_recruit.
create or replace function public.has_company_role(p_company uuid, p_roles public.membership_role[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_memberships m
    join public.profiles p on p.id = m.user_id
    where m.company_id = p_company
      and m.user_id = auth.uid()
      and m.status = 'active'
      and p.status = 'active'
      and (p_roles is null or m.role = any (p_roles))
  ) and public.company_service_active(p_company);
$$;

create or replace function public.is_interview_participant(p_interview uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.interview_participants ip
    join public.interviews i on i.id = ip.interview_id
    where ip.interview_id = p_interview and ip.user_id = auth.uid() and public.company_service_active(i.company_id)
  );
$$;

-- Talent pool clause also requires an active service.
create or replace function public.can_view_candidate(p_candidate uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    p_candidate = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1 from public.applications a
      where a.candidate_id = p_candidate and public.can_recruit(a.company_id)
    )
    or exists (
      select 1 from public.candidate_profiles cp
      join public.company_memberships m on m.user_id = auth.uid() and m.status = 'active' and m.role in ('company_admin', 'recruiter')
      join public.company_profiles c on c.id = m.company_id and c.status = 'approved'
      where cp.user_id = p_candidate and cp.visibility = 'companies' and public.company_service_active(c.id)
    )
    or exists (
      select 1 from public.applications a
      join public.interviews i on i.application_id = a.id
      join public.interview_participants ip on ip.interview_id = i.id
      where a.candidate_id = p_candidate and ip.user_id = auth.uid() and public.company_service_active(i.company_id)
    );
$$;

-- Public catalogue: only LISTED approved organizations; members, Super Admin and applicants unchanged.
create or replace function public.can_view_job(p_job uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.jobs j
    join public.company_profiles c on c.id = j.company_id
    where j.id = p_job and (
      (j.status in ('published', 'closed') and c.status = 'approved' and c.listed)
      or public.has_company_role(j.company_id)
      or public.is_super_admin()
      or exists (select 1 from public.applications a where a.job_id = j.id and a.candidate_id = auth.uid())
    )
  );
$$;

-- Assessment credits: consumed per assignment; blocked when exhausted (null = unlimited).
create or replace function public.consume_assessment_credit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.company_subscriptions;
begin
  select * into v from public.company_subscriptions where company_id = new.company_id for update;
  if v.id is null then return new; end if;
  if v.assessment_credits is not null and v.credits_used >= v.assessment_credits then
    raise exception 'assessment credits exhausted for this subscription' using errcode = 'P0001';
  end if;
  update public.company_subscriptions set credits_used = credits_used + 1 where id = v.id;
  return new;
end $$;
create trigger assessment_assignments_credit before insert on public.assessment_assignments
  for each row execute function public.consume_assessment_credit();

-- ---------------------------------------------------------------- employee access requests
create table public.company_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.company_profiles (id) on delete cascade,
  job_title text not null check (length(job_title) between 2 and 120),
  requested_role public.membership_role not null,
  granted_role public.membership_role,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decision_note text check (decision_note is null or length(decision_note) <= 1000),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index company_access_requests_one_pending on public.company_access_requests (user_id, company_id) where status = 'pending';
alter table public.company_access_requests enable row level security;
create policy access_requests_read on public.company_access_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_super_admin());
grant select on public.company_access_requests to authenticated; -- writes only through the RPCs below

-- Organizations currently accepting employee access requests (safe public fields only).
create or replace function public.access_request_companies()
returns table (id uuid, name_en text, name_ar text, sector_en text, sector_ar text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name_en, c.name_ar, c.sector_en, c.sector_ar from public.company_profiles c
  where c.status = 'approved' and c.accepts_access_requests order by c.name_en;
$$;

create or replace function public.request_company_access(p_company uuid, p_job_title text, p_role public.membership_role)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_id uuid; r record; v_name_en text; v_name_ar text;
begin
  if v_uid is null or not public.is_active_user() then raise exception 'authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null) then
    raise exception 'confirm your email first' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and account_type = 'company') then
    raise exception 'only employer accounts can request company access' using errcode = '42501';
  end if;
  select name_en, name_ar into v_name_en, v_name_ar from public.company_profiles
   where id = p_company and status = 'approved' and accepts_access_requests;
  if v_name_en is null then raise exception 'this organization is not accepting access requests' using errcode = 'P0001'; end if;
  if exists (select 1 from public.company_memberships where company_id = p_company and user_id = v_uid and status = 'active') then
    raise exception 'you already have access to this organization' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.company_access_requests where company_id = p_company and user_id = v_uid and status = 'pending') then
    raise exception 'a request is already pending' using errcode = 'P0001';
  end if;
  insert into public.company_access_requests (user_id, company_id, job_title, requested_role)
  values (v_uid, p_company, left(trim(p_job_title), 120), p_role) returning id into v_id;
  for r in select user_id from public.user_roles where role = 'super_admin' loop
    perform public.notify(r.user_id, 'access_request', 'Access request: ' || v_name_en, 'طلب انضمام: ' || v_name_ar, null, null, '/admin/access-requests');
  end loop;
  perform public.write_audit('company.access_requested', 'company', p_company, p_company, jsonb_build_object('request', v_id, 'role', p_role));
  return v_id;
end $$;

create or replace function public.review_access_request(p_request uuid, p_decision text, p_role public.membership_role default null, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.company_access_requests; v_role public.membership_role;
begin
  if not public.is_super_admin() then raise exception 'super admin only' using errcode = '42501'; end if;
  select * into v from public.company_access_requests where id = p_request for update;
  if v.id is null then raise exception 'request not found' using errcode = 'P0001'; end if;
  if v.status <> 'pending' then raise exception 'request already reviewed' using errcode = 'P0001'; end if;
  if p_decision = 'approve' then
    v_role := coalesce(p_role, v.requested_role);
    insert into public.company_memberships (company_id, user_id, role, status)
    values (v.company_id, v.user_id, v_role, 'active')
    on conflict (company_id, user_id) do update set role = excluded.role, status = 'active';
    update public.profiles set onboarding_completed = true where id = v.user_id;
    update public.company_access_requests set status = 'approved', granted_role = v_role, reviewed_by = auth.uid(), reviewed_at = now(), decision_note = p_note where id = p_request;
    perform public.notify(v.user_id, 'access_approved', 'Your access was approved', 'تمت الموافقة على طلبك', null, null, '/company');
  elsif p_decision = 'reject' then
    update public.company_access_requests set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), decision_note = p_note where id = p_request;
    perform public.notify(v.user_id, 'access_rejected', 'Your access request was not approved', 'لم تتم الموافقة على طلبك', p_note, p_note, '/onboarding/company');
  else
    raise exception 'unknown decision' using errcode = 'P0001';
  end if;
  perform public.write_audit('company.access_' || p_decision, 'company', v.company_id, v.company_id,
    jsonb_build_object('request', p_request, 'user', v.user_id, 'role', v_role));
end $$;

-- Super Admin provisions organizations (no code change needed to add a customer).
create or replace function public.admin_provision_company(
  p_name_en text, p_name_ar text, p_registry_id text default null, p_sector_en text default null, p_sector_ar text default null,
  p_website text default null, p_organization_type text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_slug text;
begin
  if not public.is_super_admin() then raise exception 'super admin only' using errcode = '42501'; end if;
  if coalesce(trim(p_name_en), '') = '' or coalesce(trim(p_name_ar), '') = '' then
    raise exception 'company name is required in Arabic and English' using errcode = 'P0001';
  end if;
  v_slug := left(trim(both '-' from regexp_replace(lower(p_name_en), '[^a-z0-9]+', '-', 'g')), 50);
  if length(v_slug) < 2 then v_slug := 'company'; end if;
  if exists (select 1 from public.company_profiles where slug = v_slug) then v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6); end if;
  insert into public.company_profiles (slug, name_en, name_ar, registry_id, sector_en, sector_ar, industry, website, organization_type, status, approved_at, approved_by, created_by)
  values (v_slug, trim(p_name_en), trim(p_name_ar), nullif(trim(p_registry_id), ''), p_sector_en, p_sector_ar, p_sector_en,
          nullif(trim(p_website), ''), p_organization_type, 'approved', now(), auth.uid(), auth.uid())
  returning id into v_id;
  insert into public.company_subscriptions (company_id, status) values (v_id, 'pending');
  insert into public.company_brand_profiles (company_id) values (v_id);
  perform public.write_audit('company.provisioned', 'company', v_id, v_id, jsonb_build_object('registry_id', p_registry_id));
  return v_id;
end $$;

-- Public self-registration can no longer create organizations.
revoke execute on function public.create_company(text, text, text, text, text, text, text, text, text, text) from authenticated;

revoke all on function public.company_service_active(uuid) from public, anon;
revoke all on function public.consume_assessment_credit() from public, anon, authenticated;
revoke all on function public.company_subscriptions_touch() from public, anon, authenticated;
revoke all on function public.company_subscriptions_audit() from public, anon, authenticated;
revoke all on function public.request_company_access(uuid, text, public.membership_role) from public, anon;
revoke all on function public.review_access_request(uuid, text, public.membership_role, text) from public, anon;
revoke all on function public.admin_provision_company(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.company_service_active(uuid) to authenticated;
grant execute on function public.access_request_companies() to anon, authenticated;
grant execute on function public.request_company_access(uuid, text, public.membership_role) to authenticated;
grant execute on function public.review_access_request(uuid, text, public.membership_role, text) to authenticated;
grant execute on function public.admin_provision_company(text, text, text, text, text, text, text) to authenticated;

-- Existing fictional demo organizations keep working (controlled demo access, not revenue) but are
-- removed from the public catalogue. Scoped strictly to is_demo rows; nothing is deleted or renamed.
insert into public.company_subscriptions (company_id, plan, status, is_demo, payment_status, commercial_notes)
select c.id, 'legacy_demo', 'active', true, 'demo', 'Legacy fictional demo organization (regression/test data). Not a customer.'
  from public.company_profiles c
 where c.is_demo and c.status = 'approved'
on conflict (company_id) do nothing;
insert into public.company_brand_profiles (company_id) select id from public.company_profiles on conflict do nothing;

-- Expire lapsed subscriptions daily (scoped; data untouched).
select cron.schedule('jadarah-expire-subscriptions', '15 0 * * *',
  $cron$update public.company_subscriptions set status = 'expired' where status = 'active' and expires_on is not null and expires_on < current_date$cron$);
