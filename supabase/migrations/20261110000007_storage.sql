-- JADARAH — 0007 private storage buckets and object policies
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('candidate-cvs', 'candidate-cvs', false, 10485760, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('candidate-certificates', 'candidate-certificates', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg']),
  ('candidate-projects', 'candidate-projects', false, 20971520, array['application/pdf', 'image/png', 'image/jpeg', 'application/zip']),
  ('assessment-attachments', 'assessment-attachments', false, 20971520, array['application/pdf', 'image/png', 'image/jpeg', 'application/zip', 'text/plain']),
  ('company-documents', 'company-documents', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg']),
  ('interview-attachments', 'interview-attachments', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg', 'text/plain'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_read_storage_object(p_bucket text, p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_first text := split_part(p_name, '/', 1); v_second text := split_part(p_name, '/', 2);
begin
  if auth.uid() is null then return false; end if;
  if public.is_super_admin() then return true; end if;
  if p_bucket in ('candidate-cvs', 'candidate-certificates', 'candidate-projects') then
    if v_first = auth.uid()::text then return true; end if;
    return exists (select 1 from public.candidate_documents d where d.bucket = p_bucket and d.storage_path = p_name and public.can_view_document(d.id));
  elsif p_bucket = 'assessment-attachments' then
    if v_first = auth.uid()::text then return true; end if;
    return exists (
      select 1 from public.assessment_answers a
      join public.assessment_submissions s on s.id = a.submission_id
      join public.assessment_assignments aa on aa.id = s.assignment_id
      where a.file_path = p_name and aa.company_id is not null and public.can_recruit(aa.company_id));
  elsif p_bucket = 'company-documents' then
    return v_first ~ '^[0-9a-f-]{36}$' and public.has_company_role(v_first::uuid);
  elsif p_bucket = 'interview-attachments' then
    return v_first ~ '^[0-9a-f-]{36}$' and v_second ~ '^[0-9a-f-]{36}$'
      and (public.can_recruit(v_first::uuid) or public.is_interview_participant(v_second::uuid));
  end if;
  return false;
end $$;

create or replace function public.can_write_storage_object(p_bucket text, p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_first text := split_part(p_name, '/', 1);
begin
  if auth.uid() is null or not public.is_active_user() then return false; end if;
  if p_bucket in ('candidate-cvs', 'candidate-certificates', 'candidate-projects', 'assessment-attachments') then
    return v_first = auth.uid()::text;
  elsif p_bucket = 'company-documents' then
    return v_first ~ '^[0-9a-f-]{36}$' and public.has_company_role(v_first::uuid, array['company_admin']::public.membership_role[]);
  elsif p_bucket = 'interview-attachments' then
    return v_first ~ '^[0-9a-f-]{36}$' and public.can_recruit(v_first::uuid);
  end if;
  return false;
end $$;
grant execute on function public.can_read_storage_object(text, text) to authenticated;
grant execute on function public.can_write_storage_object(text, text) to authenticated;

create policy jadarah_objects_select on storage.objects for select to authenticated
  using (bucket_id in ('candidate-cvs', 'candidate-certificates', 'candidate-projects', 'assessment-attachments', 'company-documents', 'interview-attachments')
    and public.can_read_storage_object(bucket_id, name));
create policy jadarah_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('candidate-cvs', 'candidate-certificates', 'candidate-projects', 'assessment-attachments', 'company-documents', 'interview-attachments')
    and public.can_write_storage_object(bucket_id, name));
-- no UPDATE policy: uploaded documents are never silently overwritten
create policy jadarah_objects_delete on storage.objects for delete to authenticated
  using (bucket_id in ('candidate-cvs', 'candidate-certificates', 'candidate-projects', 'assessment-attachments', 'company-documents', 'interview-attachments')
    and public.can_write_storage_object(bucket_id, name));
