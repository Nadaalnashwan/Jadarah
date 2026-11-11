"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCompanyMember } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AIUnavailableError } from "@/services/ai/provider";
import {
  applyDraft,
  buildAssessment,
  generateAssessmentDraft,
  retrieveReferences,
  runValidation,
  type CompanyContext,
  type GeneratedDraft,
  type JobInput,
  type RetrievedRef,
} from "@/services/ai/assessment-builder";

const LEVEL_DIFFICULTY: Record<string, "beginner" | "intermediate" | "advanced"> = {
  entry: "beginner",
  junior: "beginner",
  mid: "intermediate",
  senior: "advanced",
  lead: "advanced",
};

async function ctx() {
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const supabase = await createClient();
  // Organization identity comes from the approved membership — never from client input.
  const { data: company } = await supabase
    .from("company_profiles")
    .select("id, name_en, name_ar, sector_en, organization_type")
    .eq("id", s.activeMembership.company_id)
    .single();
  return { s, supabase, company: company as CompanyContext, ...(await getI18n()) };
}

const inputSchema = z.object({
  job_id: z.string().uuid(),
  title: z.string().trim().min(2).max(140),
  seniority: z.string().trim().min(2).max(40),
  description: z.string().trim().max(3000).default(""),
  responsibilities: z.string().trim().max(3000).default(""),
  required_skills: z.string().trim().min(2).max(800),
  preferred_skills: z.string().trim().max(800).default(""),
  constraints: z.string().trim().max(1500).default(""),
  expected_outcomes: z.string().trim().max(1500).default(""),
  duration_minutes: z.coerce.number().int().min(30).max(480),
});
const list = (s: string) => s.split(/[\n,،]+/).map((x) => x.trim()).filter(Boolean);

/** Generate a NEW practical assessment for a company job. Saved as a DRAFT for human review. */
export async function generateFromJob(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { s, supabase, company, locale } = await ctx();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const p = inputSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: L("Complete the job details.", "أكمل بيانات الوظيفة.") };
  const { data: job } = await supabase.from("jobs").select("id, category:job_categories(slug)").eq("id", p.data.job_id).eq("company_id", company.id).maybeSingle();
  if (!job) return { ok: false, error: L("Job not found.", "الوظيفة غير موجودة.") };
  const input: JobInput = {
    ...p.data,
    responsibilities: list(p.data.responsibilities),
    required_skills: list(p.data.required_skills),
    preferred_skills: list(p.data.preferred_skills),
  };
  let refs: RetrievedRef[] = [];
  let result: Awaited<ReturnType<typeof buildAssessment>>;
  try {
    refs = await retrieveReferences(supabase, input, company);
    result = await buildAssessment({ userId: s.userId, company, job: input, references: refs });
  } catch (e) {
    if (e instanceof AIUnavailableError) return { ok: false, error: L("Generation is unavailable right now. Try again shortly.", "التوليد غير متاح الآن. حاول بعد قليل.") };
    throw e;
  }
  const d = result.draft;
  const { data: a, error } = await supabase
    .from("assessments")
    .insert({
      company_id: company.id,
      title_en: d.title_en,
      title_ar: d.title_ar,
      description_en: d.scenario_en,
      description_ar: d.scenario_ar,
      category: job.category?.slug ?? "practical",
      difficulty: LEVEL_DIFFICULTY[input.seniority] ?? d.difficulty,
      duration_minutes: d.duration_minutes,
      passing_score: 60,
      status: "draft",
      ai_generated: true,
      created_by: s.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: localizeError(error, locale) };
  await applyDraft(supabase, a.id, company.id, d);
  await supabase.from("assessment_generations").insert({
    assessment_id: a.id,
    company_id: company.id,
    job_id: input.job_id,
    job_snapshot: input,
    references_used: refs.map((r) => ({ reference_id: r.id, role: r.role_en, sector: r.sector_key, similarity: Number(r.similarity.toFixed(3)), score: Number(r.score.toFixed(3)), reason: r.reason })),
    output: d,
    validation: result.checks,
    status: "draft",
    provider: result.provider,
    model: result.model,
  });
  await supabase.from("ai_generation_records").insert({
    user_id: s.userId,
    company_id: company.id,
    kind: "assessment",
    provider: result.provider,
    model: result.model,
    input_summary: input.title,
    output: { assessment_id: a.id, tasks: d.tasks.length, checks_failed: result.checks.filter((c) => !c.passed).length },
    review_status: "pending_review",
  });
  redirect(`/company/assessments/${a.id}`);
}

async function loadGeneration(assessmentId: string) {
  const c = await ctx();
  const { data: g } = await c.supabase
    .from("assessment_generations")
    .select("id, output, job_snapshot, references_used, status")
    .eq("assessment_id", assessmentId)
    .eq("company_id", c.company.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { ...c, g };
}

async function refsFor(supabase: Awaited<ReturnType<typeof createClient>>, used: { reference_id: string }[], job: JobInput, company: CompanyContext) {
  // Re-retrieve (fresh RLS-scoped read) and keep the same references in order.
  const all = await retrieveReferences(supabase, job, company);
  const ids = used.map((u) => u.reference_id);
  return all.filter((r) => ids.includes(r.id));
}

/** Regenerate one section (scenario | tasks | rubric | data) keeping the rest consistent. Draft only. */
export async function regenerateSection(assessmentId: string, section: "scenario" | "tasks" | "rubric" | "data"): Promise<ActionResult> {
  const { s, supabase, company, locale, g } = await loadGeneration(assessmentId);
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  if (!g || g.status !== "draft") return { ok: false, error: L("Only AI drafts can be regenerated.", "يمكن إعادة توليد المسودات الآلية فقط.") };
  const job = g.job_snapshot as unknown as JobInput;
  try {
    const refs = await refsFor(supabase, (g.references_used as { reference_id: string }[]) ?? [], job, company);
    const res = await generateAssessmentDraft({
      userId: s.userId,
      company,
      job,
      references: refs,
      repairOf: { draft: g.output as unknown as GeneratedDraft, issues: [`Rewrite the ${section} with a fresh approach.`] },
      focusSection: section,
    });
    const checks = runValidation(res.data, job, refs);
    await applyDraft(supabase, assessmentId, company.id, res.data);
    await supabase.from("assessment_generations").update({ output: res.data, validation: checks, provider: res.provider, model: res.model }).eq("id", g.id);
  } catch (e) {
    if (e instanceof AIUnavailableError) return { ok: false, error: L("Generation is unavailable right now.", "التوليد غير متاح الآن.") };
    return { ok: false, error: localizeError(e as { message?: string }, locale) };
  }
  revalidatePath(`/company/assessments/${assessmentId}`);
  return { ok: true, message: L("Section regenerated.", "أُعيد توليد القسم.") };
}

const taskEdit = z.object({
  title_en: z.string().trim().min(2).max(140),
  title_ar: z.string().trim().min(2).max(140),
  instructions_en: z.string().trim().min(10).max(2500),
  instructions_ar: z.string().trim().min(10).max(2500),
  deliverables: z.string().trim().min(2).max(1200),
  time_minutes: z.coerce.number().int().min(5).max(300),
});
const scenarioEdit = z.object({
  title_en: z.string().trim().min(2).max(140),
  title_ar: z.string().trim().min(2).max(140),
  scenario_en: z.string().trim().min(20).max(2500),
  scenario_ar: z.string().trim().min(20).max(2500),
  duration_minutes: z.coerce.number().int().min(30).max(480),
});

/** Human edits to the draft (scenario or one task). Re-applied and re-validated. */
export async function editDraft(assessmentId: string, part: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase, company, locale, g } = await loadGeneration(assessmentId);
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  if (!g || g.status !== "draft") return { ok: false, error: L("Only drafts can be edited.", "يمكن تعديل المسودات فقط.") };
  const d = structuredClone(g.output as unknown as GeneratedDraft);
  if (part === "scenario") {
    const p = scenarioEdit.safeParse(Object.fromEntries(form));
    if (!p.success) return { ok: false, error: L("Check the fields.", "تحقق من الحقول.") };
    Object.assign(d, p.data);
  } else {
    const i = Number(part.replace("task:", ""));
    const p = taskEdit.safeParse(Object.fromEntries(form));
    if (!p.success || !d.tasks[i]) return { ok: false, error: L("Check the fields.", "تحقق من الحقول.") };
    const deliverables = p.data.deliverables.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = /^(.*?)\s*\(([^)]+)\)\s*(?:[-—:]\s*(.*))?$/.exec(l);
      return m ? { name: m[1], format: m[2], description: m[3] } : { name: l, format: "document" };
    });
    d.tasks[i] = { ...d.tasks[i], ...p.data, deliverables };
  }
  const job = g.job_snapshot as unknown as JobInput;
  const refs = await refsFor(supabase, (g.references_used as { reference_id: string }[]) ?? [], job, company).catch(() => []);
  const checks = runValidation(d, job, refs);
  try {
    await applyDraft(supabase, assessmentId, company.id, d);
  } catch (e) {
    return { ok: false, error: localizeError(e as { message?: string }, locale) };
  }
  await supabase.from("assessment_generations").update({ output: d, validation: checks }).eq("id", g.id);
  revalidatePath(`/company/assessments/${assessmentId}`);
  return { ok: true, message: L("Saved and re-validated.", "حُفظ وأُعيد التحقق.") };
}

/** Human approval: re-validates the CURRENT content; publishes only when every check passes. */
export async function approveAndPublish(assessmentId: string): Promise<ActionResult> {
  const { s, supabase, company, locale, g } = await loadGeneration(assessmentId);
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  if (!g) return { ok: false, error: L("Not found.", "غير موجود.") };
  const d = g.output as unknown as GeneratedDraft;
  // Pick up rubric edits made in the rubric editor.
  const { data: rub } = await supabase.from("assessment_rubrics").select("criteria").eq("assessment_id", assessmentId).limit(1).maybeSingle();
  const edited = (rub?.criteria as { key: string; name_en: string; name_ar: string; max_points: number }[] | null) ?? [];
  const merged: GeneratedDraft = {
    ...d,
    rubric: d.rubric
      .filter((c) => !edited.length || edited.some((e) => e.key === c.key))
      .map((c) => {
        const e = edited.find((x) => x.key === c.key);
        return e ? { ...c, criterion_en: e.name_en, criterion_ar: e.name_ar, max_points: e.max_points } : c;
      }),
  };
  const job = g.job_snapshot as unknown as JobInput;
  const refs = await refsFor(supabase, (g.references_used as { reference_id: string }[]) ?? [], job, company).catch(() => []);
  const checks = runValidation(merged, job, refs);
  await supabase.from("assessment_generations").update({ validation: checks }).eq("id", g.id);
  const failed = checks.filter((c) => !c.passed);
  if (failed.length) {
    revalidatePath(`/company/assessments/${assessmentId}`);
    return { ok: false, error: L(`Resolve ${failed.length} validation issue(s) before publishing.`, `عالج ${failed.length} من ملاحظات التحقق قبل النشر.`) };
  }
  const { error } = await supabase.from("assessments").update({ status: "published", reviewed_by: s.userId }).eq("id", assessmentId).eq("status", "draft");
  if (error) return { ok: false, error: localizeError(error, locale) };
  await supabase.from("assessment_generations").update({ status: "approved", approved_by: s.userId, approved_at: new Date().toISOString() }).eq("id", g.id);
  revalidatePath(`/company/assessments/${assessmentId}`);
  return { ok: true, message: L("Approved and published.", "اعتُمد ونُشر.") };
}

/** Short-lived signed link for an assessment file (storage RLS decides: company or assigned candidate). */
export async function materialUrl(materialId: string): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();
  const { locale } = await getI18n();
  const { data: m } = await supabase.from("assessment_materials").select("storage_path, file_name").eq("id", materialId).maybeSingle();
  if (!m) return { ok: false, error: localizeError({ code: "42501" }, locale) };
  const { data, error } = await supabase.storage.from("assessment-materials").createSignedUrl(m.storage_path, 60, { download: m.file_name });
  if (error || !data) return { ok: false, error: localizeError(error, locale) };
  return { ok: true, data: { url: data.signedUrl } };
}
