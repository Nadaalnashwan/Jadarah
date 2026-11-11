-- JADARAH — 0021 fix: companies could not create jobs.
-- jobs_select uses can_view_job(id), which looks the row up by id and cannot see a row being
-- inserted in the same statement, so INSERT … RETURNING (the app's create-job action) failed RLS.
-- Same pattern as 0015 (assessments). Row-based policy for the owning company; grants nothing new
-- (can_view_job already allowed company members and Super Admin to read these rows).
create policy jobs_select_company on public.jobs for select to authenticated
  using (public.has_company_role(company_id) or public.is_super_admin());
