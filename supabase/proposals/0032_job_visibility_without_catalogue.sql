-- PROPOSAL — NOT APPLIED. Needs owner approval and a backup first.
--
-- Finding (2026-11-12, read-only query on the hosted project): public.can_view_job() lets candidates see a published
-- job only when its organization has company_profiles.listed = true. `listed` means "shown in the public company
-- catalogue" and defaults to false, so an approved organization that is not in the catalogue can publish a job that
-- no candidate can see (6 approved, non-demo organizations are in that state today). The app now warns employers
-- about this on /company/jobs.
--
-- If job visibility should NOT depend on catalogue listing, apply the function below (a replacement of the 0020
-- definition with the `and c.listed` condition removed). Rollback: re-run the 0020 definition.
create or replace function public.can_view_job(p_job uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jobs j
    join public.company_profiles c on c.id = j.company_id
    where j.id = p_job and (
      (j.status in ('published', 'closed') and c.status = 'approved')
      or public.has_company_role(j.company_id)
      or public.is_super_admin()
      or exists (select 1 from public.applications a where a.job_id = j.id and a.candidate_id = auth.uid())
    )
  );
$$;
