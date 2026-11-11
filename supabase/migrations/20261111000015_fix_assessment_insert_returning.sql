-- JADARAH — 0015 fix: companies could not create or clone assessments.
-- INSERT ... RETURNING must also pass the SELECT policy. assessments_select uses
-- can_view_assessment(id), which looks the row up by id and cannot see the row being inserted
-- in the same statement → 42501. This additional permissive SELECT policy checks the row's own
-- company_id directly. It grants nothing new: can_manage_assessment already allowed recruiters
-- of the owning company to read these rows.
create policy assessments_select_company on public.assessments for select to authenticated
  using (company_id is not null and public.can_recruit(company_id));
