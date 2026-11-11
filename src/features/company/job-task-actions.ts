"use server";
/**
 * Job ↔ practical task ("مهمة عملية") workflow for employers.
 * Tasks are stored as assessments (internal model) and linked to the job with `attach_job_task`, which the database
 * validates (same organization, published before the job is published, never replaced once candidates have it).
 * Every creation path carries a client-generated `creation_key`, so a refresh or retry never creates a second draft.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCompanyMember } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { jobTaskLocked } from "./job-task";

const DEFAULT_RUBRIC = [
  { key: "correctness", name_en: "Correctness", name_ar: "الصحة", max_points: 4 },
  { key: "reasoning", name_en: "Reasoning", name_ar: "الاستدلال", max_points: 3 },
  { key: "clarity", name_en: "Clarity", name_ar: "الوضوح", max_points: 3 },
];
const LEVEL_DIFFICULTY: Record<string, "beginner" | "intermediate" | "advanced"> = {
  entry: "beginner",
  junior: "beginner",
  mid: "intermediate",
  senior: "advanced",
  lead: "advanced",
};
const uuid = z.string().uuid();

async function ctx() {
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  return { s, cid: s.activeMembership.company_id, supabase: await createClient(), ...(await getI18n()) };
}

/** The job, only if it belongs to the caller's organization (RLS + explicit company filter). */
async function ownJob(supabase: ServerSupabase, cid: string, jobId: string) {
  if (!uuid.safeParse(jobId).success) return null;
  const { data } = await supabase
    .from("jobs")
    .select(
      "id, company_id, title_en, title_ar, description_en, description_ar, experience_level, assessment_id, status, category:job_categories(slug)",
    )
    .eq("id", jobId)
    .eq("company_id", cid)
    .maybeSingle();
  return data;
}

async function existingByKey(supabase: ServerSupabase, cid: string, key: string) {
  const { data } = await supabase
    .from("assessments")
    .select("id")
    .eq("company_id", cid)
    .eq("creation_key", key)
    .maybeSingle();
  return data?.id ?? null;
}

async function attach(supabase: ServerSupabase, jobId: string, assessmentId: string | null) {
  return supabase.rpc("attach_job_task", { p_job: jobId, p_assessment: assessmentId as string });
}

/** Manual creation: an empty draft prefilled from the job, attached to it. */
export async function createManualTask(jobId: string, key: string): Promise<ActionResult> {
  const { s, cid, supabase, locale } = await ctx();
  if (!uuid.safeParse(key).success) return { ok: false, error: localizeError(null, locale) };
  const job = await ownJob(supabase, cid, jobId);
  if (!job) return { ok: false, error: localizeError({ code: "42501" }, locale) };
  const existing = await existingByKey(supabase, cid, key);
  if (existing) redirect(`/company/assessments/${existing}?job=${jobId}`);
  if (job.assessment_id && (await jobTaskLocked(supabase, jobId)))
    return { ok: false, error: localizeError({ message: "practical task; it cannot be replaced" }, locale) };
  const { data, error } = await supabase
    .from("assessments")
    .insert({
      company_id: cid,
      title_en: `${job.title_en} — practical task`,
      title_ar: `${job.title_ar} — مهمة عملية`,
      description_en: job.description_en.slice(0, 2000) || null,
      description_ar: job.description_ar.slice(0, 2000) || null,
      category: (job.category as { slug: string } | null)?.slug ?? "practical",
      difficulty: LEVEL_DIFFICULTY[job.experience_level] ?? "intermediate",
      duration_minutes: 60,
      passing_score: 60,
      status: "draft",
      created_by: s.userId,
      job_id: jobId,
      creation_key: key,
    })
    .select("id")
    .single();
  if (error) {
    const again = await existingByKey(supabase, cid, key);
    if (again) redirect(`/company/assessments/${again}?job=${jobId}`);
    return { ok: false, error: localizeError(error, locale) };
  }
  await supabase.from("assessment_rubrics").insert({
    assessment_id: data.id,
    title_en: "Open response rubric",
    title_ar: "معايير الإجابات المفتوحة",
    criteria: DEFAULT_RUBRIC,
  });
  const { error: aErr } = await attach(supabase, jobId, data.id);
  if (aErr) return { ok: false, error: localizeError(aErr, locale) };
  revalidatePath(`/company/jobs/${jobId}`);
  redirect(`/company/assessments/${data.id}?job=${jobId}`);
}

/** Template path: copy a published library or company task into an editable draft attached to the job. */
export async function createTaskFromTemplate(jobId: string, sourceId: string, key: string): Promise<ActionResult> {
  const { s, cid, supabase, locale } = await ctx();
  if (!uuid.safeParse(key).success || !uuid.safeParse(sourceId).success)
    return { ok: false, error: localizeError(null, locale) };
  const job = await ownJob(supabase, cid, jobId);
  if (!job) return { ok: false, error: localizeError({ code: "42501" }, locale) };
  const existing = await existingByKey(supabase, cid, key);
  if (existing) redirect(`/company/assessments/${existing}?job=${jobId}`);
  if (job.assessment_id && (await jobTaskLocked(supabase, jobId)))
    return { ok: false, error: localizeError({ message: "practical task; it cannot be replaced" }, locale) };
  // RLS: only published library tasks or the company's own tasks are readable here.
  const { data: src } = await supabase
    .from("assessments")
    .select("*, assessment_questions(*, assessment_options(*)), assessment_rubrics(*)")
    .eq("id", sourceId)
    .or(`company_id.is.null,company_id.eq.${cid}`)
    .maybeSingle();
  if (!src) return { ok: false, error: localizeError({ message: "assessment is not available" }, locale) };
  const { data: copy, error } = await supabase
    .from("assessments")
    .insert({
      company_id: cid,
      title_en: `${job.title_en} — ${src.title_en}`.slice(0, 140),
      title_ar: `${job.title_ar} — ${src.title_ar}`.slice(0, 140),
      description_en: src.description_en,
      description_ar: src.description_ar,
      category: src.category,
      difficulty: src.difficulty,
      duration_minutes: src.duration_minutes,
      passing_score: src.passing_score,
      learning_outcomes_en: src.learning_outcomes_en,
      learning_outcomes_ar: src.learning_outcomes_ar,
      status: "draft",
      created_by: s.userId,
      job_id: jobId,
      creation_key: key,
    })
    .select("id")
    .single();
  if (error) {
    const again = await existingByKey(supabase, cid, key);
    if (again) redirect(`/company/assessments/${again}?job=${jobId}`);
    return { ok: false, error: localizeError(error, locale) };
  }
  const { data: rub } = await supabase
    .from("assessment_rubrics")
    .insert({
      assessment_id: copy.id,
      title_en: src.assessment_rubrics[0]?.title_en ?? "Rubric",
      title_ar: src.assessment_rubrics[0]?.title_ar ?? "المعايير",
      criteria: src.assessment_rubrics[0]?.criteria ?? DEFAULT_RUBRIC,
    })
    .select("id")
    .single();
  for (const q of [...src.assessment_questions].sort((a, b) => a.position - b.position)) {
    const { data: nq } = await supabase
      .from("assessment_questions")
      .insert({
        assessment_id: copy.id,
        type: q.type,
        prompt_en: q.prompt_en,
        prompt_ar: q.prompt_ar,
        points: q.points,
        position: q.position,
        config: q.config,
        rubric_id: q.rubric_id && rub ? rub.id : null,
        explanation_en: q.explanation_en,
        explanation_ar: q.explanation_ar,
      })
      .select("id")
      .single();
    if (nq && q.assessment_options.length)
      await supabase.from("assessment_options").insert(
        q.assessment_options.map((o) => ({
          question_id: nq.id,
          label_en: o.label_en,
          label_ar: o.label_ar,
          is_correct: o.is_correct,
          position: o.position,
        })),
      );
  }
  const { error: aErr } = await attach(supabase, jobId, copy.id);
  if (aErr) return { ok: false, error: localizeError(aErr, locale) };
  revalidatePath(`/company/jobs/${jobId}`);
  redirect(`/company/assessments/${copy.id}?job=${jobId}`);
}

/** Attach an already-published task as-is (or detach with null). */
export async function setJobTask(jobId: string, assessmentId: string | null): Promise<ActionResult> {
  const { cid, supabase, locale } = await ctx();
  const job = await ownJob(supabase, cid, jobId);
  if (!job) return { ok: false, error: localizeError({ code: "42501" }, locale) };
  if (assessmentId !== null && !uuid.safeParse(assessmentId).success)
    return { ok: false, error: localizeError(null, locale) };
  const { error } = await attach(supabase, jobId, assessmentId);
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/jobs/${jobId}`);
  return {
    ok: true,
    message:
      assessmentId === null
        ? locale === "ar"
          ? "أُزيلت المهمة العملية من الوظيفة."
          : "The practical task was removed from the job."
        : locale === "ar"
          ? "رُبطت المهمة العملية بالوظيفة."
          : "The practical task is attached to the job.",
  };
}
