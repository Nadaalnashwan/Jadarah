"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCandidate, requireSession } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeSkillGap } from "@/lib/domain/career";

const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

// ------------------------------------------------------------------ onboarding & profile
const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  headline: optText(140),
  summary: optText(2000),
  city: optText(80),
  years_experience: z.coerce.number().min(0).max(60).optional(),
  experience_level: z.enum(["entry", "junior", "mid", "senior", "lead"]).optional(),
  career_interests: optText(300),
  languages: optText(200),
  linkedin_url: z.union([z.literal(""), z.string().url().max(300)]).optional(),
  portfolio_url: z.union([z.literal(""), z.string().url().max(300)]).optional(),
  visibility: z.enum(["companies", "private"]).optional(),
  phone: optText(30),
});

export async function saveCandidateProfile(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const { locale } = await getI18n();
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((i) => (fieldErrors[String(i.path[0])] = locale === "ar" ? "قيمة غير صالحة" : "Invalid value"));
    return { ok: false, error: locale === "ar" ? "راجع الحقول المظللة." : "Please review the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { error: e1 } = await supabase.from("profiles").update({ full_name: v.full_name, phone: v.phone }).eq("id", session.userId);
  const { error: e2 } = await supabase.from("candidate_profiles").upsert({
    user_id: session.userId,
    headline: v.headline,
    summary: v.summary,
    city: v.city,
    years_experience: v.years_experience ?? null,
    experience_level: v.experience_level ?? null,
    career_interests: v.career_interests ? v.career_interests.split(",").map((s) => s.trim()).filter(Boolean) : [],
    languages: v.languages ? v.languages.split(",").map((s) => ({ name: s.trim() })).filter((l) => l.name) : [],
    linkedin_url: v.linkedin_url || null,
    portfolio_url: v.portfolio_url || null,
    ...(v.visibility ? { visibility: v.visibility } : {}),
  });
  if (e1 || e2) return { ok: false, error: localizeError(e1 ?? e2, locale) };
  revalidatePath("/candidate", "layout");
  return { ok: true, message: locale === "ar" ? "تم حفظ ملفك." : "Profile saved." };
}

export async function completeCandidateOnboarding(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const res = await saveCandidateProfile(null, form);
  if (!res.ok) return res;
  const session = await requireSession();
  const supabase = await createClient();
  const skills = form.getAll("skills").map(String).slice(0, 15);
  if (skills.length) {
    await supabase.from("candidate_skills").upsert(
      skills.map((skill_id) => ({ candidate_id: session.userId, skill_id, level: 3, source: "self" })),
      { onConflict: "candidate_id,skill_id", ignoreDuplicates: true },
    );
  }
  await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", session.userId);
  redirect("/candidate");
}

// generic child-record CRUD for profile sections
const sectionSchemas = {
  candidate_education: z.object({ institution: z.string().trim().min(2).max(160), degree: z.string().trim().min(2).max(160), field: optText(160), start_date: optText(10), end_date: optText(10), grade: optText(60) }),
  candidate_experience: z.object({ title: z.string().trim().min(2).max(160), company: z.string().trim().min(2).max(160), location: optText(80), start_date: z.string().min(8).max(10), end_date: optText(10), is_current: z.preprocess((v) => v === "on", z.boolean()), description: optText(2000) }),
  candidate_projects: z.object({ title: z.string().trim().min(2).max(160), description: optText(2000), url: z.union([z.literal(""), z.string().url().max(300)]).optional().transform((v) => v || null) }),
  candidate_certifications: z.object({ name: z.string().trim().min(2).max(160), issuer: optText(160), issue_date: optText(10), credential_url: z.union([z.literal(""), z.string().url().max(300)]).optional().transform((v) => v || null) }),
} as const;
export type SectionTable = keyof typeof sectionSchemas;

export async function addProfileItem(table: SectionTable, _: ActionResult | null, form: FormData): Promise<ActionResult> {
  const session = await requireCandidate();
  const { locale } = await getI18n();
  const parsed = sectionSchemas[table].safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: locale === "ar" ? "أكمل الحقول المطلوبة بقيم صالحة." : "Fill the required fields with valid values." };
  const supabase = await createClient();
  const { error } = await supabase.from(table).insert({ ...parsed.data, candidate_id: session.userId } as never);
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/candidate/profile");
  return { ok: true };
}

export async function deleteProfileItem(table: SectionTable | "candidate_skills", id: string) {
  const session = await requireCandidate();
  const supabase = await createClient();
  await supabase.from(table).delete().eq("id", id).eq("candidate_id", session.userId);
  revalidatePath("/candidate", "layout");
}

const skillSchema = z.object({ skill_id: z.string().uuid(), level: z.coerce.number().int().min(1).max(5), evidence: optText(500) });
export async function upsertSkill(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const session = await requireCandidate();
  const { locale } = await getI18n();
  const parsed = skillSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: locale === "ar" ? "اختر مهارة ومستوى." : "Choose a skill and level." };
  const supabase = await createClient();
  // A candidate can only self-declare or attach evidence; 'assessment'/'verified' sources are never set by the candidate.
  const { data: existing } = await supabase.from("candidate_skills").select("id, source").eq("candidate_id", session.userId).eq("skill_id", parsed.data.skill_id).maybeSingle();
  const source = existing && existing.source !== "self" ? existing.source : "self";
  const { error } = await supabase.from("candidate_skills").upsert(
    { candidate_id: session.userId, skill_id: parsed.data.skill_id, level: parsed.data.level, evidence: parsed.data.evidence, source },
    { onConflict: "candidate_id,skill_id" },
  );
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/candidate", "layout");
  return { ok: true };
}

// ------------------------------------------------------------------ jobs & applications
export async function toggleSavedJob(jobId: string, save: boolean) {
  const session = await requireCandidate();
  const supabase = await createClient();
  if (save) await supabase.from("saved_jobs").upsert({ candidate_id: session.userId, job_id: jobId });
  else await supabase.from("saved_jobs").delete().eq("candidate_id", session.userId).eq("job_id", jobId);
  revalidatePath("/candidate/jobs", "layout");
}

const applySchema = z.object({
  job_id: z.string().uuid(),
  cv_document_id: z.union([z.literal(""), z.string().uuid()]).optional(),
  cover_letter: z.string().max(5000).optional(),
});
export async function applyToJob(_: ActionResult | null, form: FormData): Promise<ActionResult<{ id: string }>> {
  await requireCandidate();
  const { locale } = await getI18n();
  const parsed = applySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: localizeError(null, locale) };
  const answers = [...form.entries()]
    .filter(([k]) => k.startsWith("q_"))
    .map(([k, v]) => ({ question_id: k.slice(2), answer: String(v).slice(0, 4000) }));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_to_job", {
    p_job: parsed.data.job_id,
    p_cv_document: (parsed.data.cv_document_id || null) as string,
    p_cover_letter: parsed.data.cover_letter ?? "",
    p_answers: answers,
  });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/candidate", "layout");
  redirect(`/candidate/applications/${data}?submitted=1`);
}

export async function withdrawApplication(applicationId: string, form: FormData): Promise<void> {
  await requireCandidate();
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_application", { p_app: applicationId, p_reason: String(form.get("reason") ?? "").slice(0, 500) });
  if (error) {
    const { locale } = await getI18n();
    redirect(`/candidate/applications/${applicationId}?error=${encodeURIComponent(localizeError(error, locale))}`);
  }
  revalidatePath("/candidate", "layout");
}

// ------------------------------------------------------------------ career development
export async function startCareerGoal(templateId: string): Promise<void> {
  const session = await requireCandidate();
  const supabase = await createClient();
  const { data: tpl } = await supabase.from("development_plans").select("*, development_plan_items(*)").eq("id", templateId).eq("is_template", true).single();
  if (!tpl) redirect("/candidate/career?error=1");
  const { data: skills } = await supabase.from("candidate_skills").select("level, source, skill:skills(slug)").eq("candidate_id", session.userId);
  const gap = analyzeSkillGap(
    tpl.required_skill_slugs,
    (skills ?? []).filter((s) => s.skill).map((s) => ({ slug: s.skill!.slug, level: s.level, source: s.source as "self" })),
  );
  await supabase.from("career_goals").update({ status: "archived" }).eq("candidate_id", session.userId).eq("status", "active");
  await supabase.from("development_plans").update({ status: "archived" }).eq("candidate_id", session.userId).eq("status", "active");
  const { data: goal } = await supabase
    .from("career_goals")
    .insert({ candidate_id: session.userId, target_role_slug: tpl.role_slug, target_role_en: tpl.title_en, target_role_ar: tpl.title_ar, target_level: tpl.target_level, target_date: new Date(Date.now() + tpl.estimated_weeks * 7 * 86400000).toISOString().slice(0, 10) })
    .select("id")
    .single();
  await supabase.from("skill_gap_analyses").insert({ candidate_id: session.userId, goal_id: goal!.id, method: "rule_based", provider: "rule_based", analysis: { ...gap } });
  const { data: plan } = await supabase
    .from("development_plans")
    .insert({ candidate_id: session.userId, goal_id: goal!.id, is_template: false, role_slug: tpl.role_slug, title_en: tpl.title_en, title_ar: tpl.title_ar, description_en: tpl.description_en, description_ar: tpl.description_ar, target_level: tpl.target_level, required_skill_slugs: tpl.required_skill_slugs, estimated_weeks: tpl.estimated_weeks })
    .select("id")
    .single();
  // Skills the candidate already has strongly are marked completed up front; gaps stay open.
  const items = [...tpl.development_plan_items].sort((a, b) => a.position - b.position);
  await supabase.from("development_plan_items").insert(
    items.map((i) => ({
      plan_id: plan!.id, title_en: i.title_en, title_ar: i.title_ar, description_en: i.description_en, description_ar: i.description_ar,
      skill_slug: i.skill_slug, kind: i.kind, resource_id: i.resource_id, position: i.position, estimated_hours: i.estimated_hours,
      status: i.skill_slug && gap.strong.includes(i.skill_slug) && i.kind === "activity" ? ("completed" as const) : ("not_started" as const),
      completed_at: i.skill_slug && gap.strong.includes(i.skill_slug) && i.kind === "activity" ? new Date().toISOString() : null,
    })),
  );
  revalidatePath("/candidate", "layout");
  redirect("/candidate/career");
}

export async function setPlanItemStatus(itemId: string, status: "not_started" | "in_progress" | "completed") {
  await requireCandidate();
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("development_plan_items")
    .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
    .eq("id", itemId)
    .select("resource_id, title_en, title_ar, plan:development_plans(candidate_id)")
    .single();
  if (item?.resource_id) {
    await supabase.from("learning_progress").upsert(
      { candidate_id: item.plan!.candidate_id!, resource_id: item.resource_id, status, progress_percent: status === "completed" ? 100 : status === "in_progress" ? 40 : 0, updated_at: new Date().toISOString() },
      { onConflict: "candidate_id,resource_id" },
    );
  }
  revalidatePath("/candidate", "layout");
}

// ------------------------------------------------------------------ privacy
export async function requestDeactivation(): Promise<void> {
  const session = await requireSession();
  const supabase = await createClient();
  await supabase.from("profiles").update({ deactivation_requested_at: new Date().toISOString() }).eq("id", session.userId);
  await supabase.from("candidate_profiles").update({ visibility: "private", open_to_work: false }).eq("user_id", session.userId);
  revalidatePath("/candidate/settings");
}
