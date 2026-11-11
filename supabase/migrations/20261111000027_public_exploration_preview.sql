-- JADARAH — 0027 exploratory task titles are public learning content (landing city previews); attempts stay private.
drop policy if exists exploration_tasks_read_anon on public.exploration_tasks;
create policy exploration_tasks_read_anon on public.exploration_tasks for select to anon using (active);
grant select on public.exploration_tasks to anon;
