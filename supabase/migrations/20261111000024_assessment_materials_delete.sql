-- Assessment materials: the owning company may remove its files (needed to regenerate a draft's
-- data files). Uploads stay insert-only (no overwrite); reads stay per material row.
create policy assessment_materials_delete on storage.objects for delete to authenticated
  using (bucket_id = 'assessment-materials' and public.can_manage_assessment((split_part(name, '/', 1))::uuid));
