-- JADARAH — 0012 fix: cast assignment status to its enum in submit_assessment (found by live integration tests)
create or replace function public.submit_assessment(p_assignment uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_as public.assessment_assignments; v_sub public.assessment_submissions; v_q record; v_ans public.assessment_answers;
  v_correct uuid[]; v_hits int; v_wrong int; v_pts numeric; v_auto numeric := 0; v_review boolean := false; v_max numeric := 0;
  v_accepted jsonb; v_app public.applications; v_title_en text; v_title_ar text;
begin
  select * into v_as from public.assessment_assignments where id = p_assignment for update;
  if v_as.id is null or v_as.candidate_id <> auth.uid() then raise exception 'assessment not found' using errcode = '42501'; end if;
  select * into v_sub from public.assessment_submissions where assignment_id = p_assignment for update;
  if v_sub.id is null then raise exception 'assessment has not been started' using errcode = 'P0001'; end if;
  if v_sub.status <> 'in_progress' then raise exception 'already submitted' using errcode = 'P0001'; end if;

  for v_q in select * from public.assessment_questions where assessment_id = v_as.assessment_id loop
    v_max := v_max + v_q.points;
    select * into v_ans from public.assessment_answers where submission_id = v_sub.id and question_id = v_q.id;
    if v_q.type in ('multiple_choice', 'true_false', 'multiple_select') then
      select coalesce(array_agg(id), '{}') into v_correct from public.assessment_options where question_id = v_q.id and is_correct;
      if v_ans.id is null then
        insert into public.assessment_answers (submission_id, question_id, is_correct, points_awarded) values (v_sub.id, v_q.id, false, 0);
        continue;
      end if;
      select count(*) filter (where s = any (v_correct)), count(*) filter (where not (s = any (v_correct)))
        into v_hits, v_wrong from unnest(v_ans.selected_option_ids) s;
      if v_q.type = 'multiple_select' then
        v_pts := case when cardinality(v_correct) = 0 then 0 else greatest(0, (v_hits - v_wrong)::numeric / cardinality(v_correct)) * v_q.points end;
      else
        v_pts := case when v_hits = 1 and v_wrong = 0 and cardinality(v_ans.selected_option_ids) = 1 then v_q.points else 0 end;
      end if;
      update public.assessment_answers set points_awarded = round(v_pts, 2), is_correct = (v_pts = v_q.points) where id = v_ans.id;
      v_auto := v_auto + v_pts;
    elsif v_q.type = 'short_answer' and jsonb_typeof(v_q.config -> 'accepted_answers') = 'array' then
      v_accepted := v_q.config -> 'accepted_answers';
      if v_ans.id is null then
        insert into public.assessment_answers (submission_id, question_id, is_correct, points_awarded) values (v_sub.id, v_q.id, false, 0);
        continue;
      end if;
      v_pts := case when exists (select 1 from jsonb_array_elements_text(v_accepted) x where lower(trim(x)) = lower(trim(coalesce(v_ans.text_answer, '')))) then v_q.points else 0 end;
      update public.assessment_answers set points_awarded = v_pts, is_correct = (v_pts > 0) where id = v_ans.id;
      v_auto := v_auto + v_pts;
    else
      v_review := true;
      if v_ans.id is null then
        insert into public.assessment_answers (submission_id, question_id) values (v_sub.id, v_q.id);
      end if;
    end if;
  end loop;

  update public.assessment_submissions set status = case when v_review then 'submitted' else 'evaluated' end,
    auto_score = round(v_auto, 2), max_score = v_max, needs_review = v_review, submitted_at = now(),
    evaluated_at = case when v_review then null else now() end,
    percentage = case when v_review or v_max = 0 then null else round(v_auto / v_max * 100, 2) end
  where id = v_sub.id;
  update public.assessment_assignments set status = (case when v_review then 'submitted' else 'evaluated' end)::public.assignment_status, submitted_at = now() where id = p_assignment;

  select title_en, title_ar into v_title_en, v_title_ar from public.assessments where id = v_as.assessment_id;
  if v_as.application_id is not null then
    select * into v_app from public.applications where id = v_as.application_id;
    if v_app.status = 'assessment_pending' then
      perform public._transition_application(v_app.id, 'assessment_completed', 'Assessment submitted', null);
    end if;
    perform public.notify_company_recruiters(v_as.company_id, 'assessment_completed', 'Assessment submitted: ' || v_title_en,
      'تم تسليم تقييم: ' || v_title_ar, null, null, '/company/applications/' || v_as.application_id);
  end if;
  perform public.notify(auth.uid(), 'assessment_completed', 'Assessment submitted: ' || v_title_en, 'تم تسليم التقييم: ' || v_title_ar,
    null, null, '/candidate/assessments/' || p_assignment);
  return jsonb_build_object('auto_score', round(v_auto, 2), 'max_score', v_max, 'needs_review', v_review);
end $$;
