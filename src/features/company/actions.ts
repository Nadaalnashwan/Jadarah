"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCompanyMember, requireSession } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { APPLICATION_STATUSES } from "@/lib/domain/application-status";

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const lines = (v: FormDataEntryValue | null) => String(v ?? "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20);

async function recruiter() {
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  return { session: s, companyId: s.activeMembership.company_id };
}

// ------------------------------------------------------------------ onboarding & profile
const companySchema = z.object({
  name_en: z.string().trim().min(2).max(120),
  name_ar: z.string().trim().min(2).max(120),
  industry: z.string().trim().min(2).max(80),
  website: z.union([z.literal(""), z.string().url().max(200)]).optional(),
  size_range: z.enum(["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]),
  city: z.string().trim().min(2).max(80),
  description_en: opt(2000),
  description_ar: opt(2000),
  contact_email: z.union([z.literal(""), z.string().email().max(200)]).optional(),
  contact_phone: opt(30),
});

export async function registerCompany(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireSession("/onboarding/company");
  const { locale } = await getI18n();
  const parsed = companySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((i) => (fieldErrors[String(i.path[0])] = locale === "ar" ? "قيمة غير صالحة" : "Invalid value"));
    return { ok: false, error: locale === "ar" ? "راجع الحقول." : "Please review the fields.", fieldErrors };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_company", {
    p_name_en: v.name_en, p_name_ar: v.name_ar, p_industry: v.industry, p_website: v.website ?? "", p_size: v.size_range, p_city: v.city,
    p_description_en: v.description_en ?? "", p_description_ar: v.description_ar ?? "", p_contact_email: v.contact_email ?? "", p_contact_phone: v.contact_phone ?? "",
  });
  if (error) return { ok: false, error: localizeError(error, locale) };
  redirect("/company/verification");
}

export async function updateCompanyProfile(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const s = await requireCompanyMember(["company_admin"]);
  const { locale } = await getI18n();
  const parsed = companySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: locale === "ar" ? "راجع الحقول." : "Please review the fields." };
  const supabase = await createClient();
  const { error } = await supabase.from("company_profiles").update({ ...parsed.data, website: parsed.data.website || null, contact_email: parsed.data.contact_email || null }).eq("id", s.activeMembership.company_id);
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/company", "layout");
  return { ok: true, message: locale === "ar" ? "تم الحفظ" : "Saved" };
}

export async function submitVerification(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const s = await requireCompanyMember(["company_admin"]);
  const { locale } = await getI18n();
  const paths = form.getAll("document_paths").map(String).filter(Boolean).slice(0, 5);
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_company_verification", {
    p_company: s.activeMembership.company_id,
    p_commercial_registration: String(form.get("commercial_registration") ?? "").slice(0, 40),
    p_document_paths: paths,
    p_notes: String(form.get("notes") ?? "").slice(0, 1000),
  });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/company", "layout");
  return { ok: true, message: locale === "ar" ? "أُرسل طلب التحقق للمراجعة." : "Verification submitted for review." };
}

// ------------------------------------------------------------------ jobs
const jobSchema = z.object({
  title_en: z.string().trim().min(2).max(140),
  title_ar: z.string().trim().min(2).max(140),
  description_en: z.string().trim().max(5000).default(""),
  description_ar: z.string().trim().max(5000).default(""),
  category_id: z.union([z.literal(""), z.string().uuid()]).optional(),
  experience_level: z.enum(["entry", "junior", "mid", "senior", "lead"]),
  min_years: z.coerce.number().int().min(0).max(40),
  city: z.string().trim().min(2).max(80),
  work_mode: z.enum(["onsite", "remote", "hybrid"]),
  employment_type: z.enum(["full_time", "part_time", "contract", "internship", "temporary"]),
  salary_min: z.union([z.literal(""), z.coerce.number().int().min(0)]).optional(),
  salary_max: z.union([z.literal(""), z.coerce.number().int().min(0)]).optional(),
  salary_visible: z.preprocess((v) => v === "on", z.boolean()),
  education_level: opt(80),
  openings: z.coerce.number().int().min(1).max(500),
  deadline: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
  assessment_id: z.union([z.literal(""), z.string().uuid()]).optional(),
  ai_assisted: z.preprocess((v) => v === "true", z.boolean()).optional(),
});

export async function saveJob(jobId: string | null, _: ActionResult<{ id: string }> | null, form: FormData): Promise<ActionResult<{ id: string }>> {
  const { session, companyId } = await recruiter();
  const { locale } = await getI18n();
  const parsed = jobSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((i) => (fieldErrors[String(i.path[0])] = locale === "ar" ? "قيمة غير صالحة" : "Invalid value"));
    return { ok: false, error: locale === "ar" ? "راجع الحقول المظللة." : "Please review the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;
  if (v.salary_min !== "" && v.salary_max !== "" && v.salary_min !== undefined && v.salary_max !== undefined && v.salary_max < v.salary_min)
    return { ok: false, error: locale === "ar" ? "الحد الأعلى للراتب أقل من الحد الأدنى." : "Maximum salary is below the minimum.", fieldErrors: { salary_max: "!" } };
  const row = {
    title_en: v.title_en, title_ar: v.title_ar, description_en: v.description_en, description_ar: v.description_ar,
    responsibilities_en: lines(form.get("responsibilities_en")), responsibilities_ar: lines(form.get("responsibilities_ar")),
    qualifications_en: lines(form.get("qualifications_en")), qualifications_ar: lines(form.get("qualifications_ar")),
    category_id: v.category_id || null, experience_level: v.experience_level, min_years: v.min_years, city: v.city, work_mode: v.work_mode,
    employment_type: v.employment_type, salary_min: v.salary_min === "" ? null : v.salary_min ?? null, salary_max: v.salary_max === "" ? null : v.salary_max ?? null,
    salary_visible: v.salary_visible, education_level: v.education_level, openings: v.openings, deadline: v.deadline || null,
    assessment_id: v.assessment_id || null, ai_assisted: v.ai_assisted ?? false,
  };
  const supabase = await createClient();
  let id = jobId;
  if (id) {
    const { error } = await supabase.from("jobs").update(row).eq("id", id).eq("company_id", companyId);
    if (error) return { ok: false, error: localizeError(error, locale) };
  } else {
    const { data, error } = await supabase.from("jobs").insert({ ...row, company_id: companyId, created_by: session.userId, status: "draft" }).select("id").single();
    if (error) return { ok: false, error: localizeError(error, locale) };
    id = data.id;
  }
  // skills: replace set
  const skills = form.getAll("skill").map(String);
  const rows = skills.map((s) => {
    const [skill_id, importance, lvl] = s.split(":");
    return { job_id: id!, skill_id, importance: importance === "preferred" ? "preferred" : "required", min_level: Math.min(5, Math.max(1, Number(lvl) || 3)) };
  }).filter((r) => /^[0-9a-f-]{36}$/.test(r.skill_id));
  await supabase.from("job_skills").delete().eq("job_id", id!);
  if (rows.length) await supabase.from("job_skills").insert(rows);
  // application questions: replace set
  const qEn = lines(form.get("questions_en"));
  const qAr = lines(form.get("questions_ar"));
  await supabase.from("job_application_questions").delete().eq("job_id", id!);
  if (qEn.length) await supabase.from("job_application_questions").insert(qEn.map((q, i) => ({ job_id: id!, question_en: q, question_ar: qAr[i] ?? q, position: i })));
  revalidatePath("/company", "layout");
  return { ok: true, data: { id: id! }, message: locale === "ar" ? "تم حفظ الوظيفة كمسودة." : "Job saved." };
}

export async function setJobStatus(jobId: string, status: "published" | "paused" | "closed" | "archived" | "draft"): Promise<ActionResult> {
  const { companyId } = await recruiter();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("status, job_skills(id)").eq("id", jobId).eq("company_id", companyId).single();
  if (!job) return { ok: false, error: localizeError({ code: "42501" }, locale) };
  if (status === "published" && job.job_skills.length === 0) return { ok: false, error: locale === "ar" ? "أضف مهارة مطلوبة واحدة على الأقل قبل النشر." : "Add at least one required skill before publishing." };
  const { error } = await supabase.from("jobs").update({ status }).eq("id", jobId);
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/company", "layout");
  return { ok: true };
}

// ------------------------------------------------------------------ application decisions
const statusSchema = z.object({
  to: z.enum(APPLICATION_STATUSES),
  reason: z.string().max(1000).optional(),
  candidate_message: z.string().max(2000).optional(),
});
export async function changeStatus(applicationId: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
  await recruiter();
  const { locale } = await getI18n();
  const parsed = statusSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: localizeError(null, locale) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_application_status", {
    p_app: applicationId, p_to: parsed.data.to, p_reason: parsed.data.reason ?? "", p_candidate_message: parsed.data.candidate_message ?? "",
  });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/applications/${applicationId}`);
  revalidatePath("/company", "layout");
  return { ok: true, message: locale === "ar" ? "تم تحديث الحالة وإبلاغ المرشح." : "Status updated and the candidate was notified." };
}

export async function addNote(applicationId: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { session } = await recruiter();
  const { locale } = await getI18n();
  const body = String(form.get("body") ?? "").trim().slice(0, 5000);
  if (!body) return { ok: false, error: locale === "ar" ? "اكتب الملاحظة." : "Write a note." };
  const supabase = await createClient();
  const { error } = await supabase.from("application_notes").insert({ application_id: applicationId, author_id: session.userId, body });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/applications/${applicationId}`);
  return { ok: true };
}

export async function assignAssessment(applicationId: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
  await recruiter();
  const { locale } = await getI18n();
  const assessmentId = String(form.get("assessment_id") ?? "");
  const due = String(form.get("due_at") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_assessment", { p_assessment: assessmentId, p_application: applicationId, p_due_at: due ? new Date(due).toISOString() : undefined });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/applications/${applicationId}`);
  return { ok: true, message: locale === "ar" ? "أُسند التقييم وأُبلغ المرشح." : "Assessment assigned; the candidate was notified." };
}

export async function evaluateAnswer(applicationId: string, submissionId: string, questionId: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
  await recruiter();
  const { locale } = await getI18n();
  const rubric: Record<string, number> = {};
  for (const [k, v] of form.entries()) if (k.startsWith("rubric_")) rubric[k.slice(7)] = Number(v) || 0;
  const points = Number(form.get("points"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("evaluate_assessment_answer", { p_submission: submissionId, p_question: questionId, p_points: points, p_rubric_scores: rubric, p_comments: String(form.get("comments") ?? "").slice(0, 2000) });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/applications/${applicationId}`);
  return { ok: true };
}

export async function shareAssessmentFeedback(applicationId: string, submissionId: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
  await recruiter();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const { error } = await supabase.rpc("share_assessment_feedback", { p_submission: submissionId, p_feedback: String(form.get("feedback") ?? "").slice(0, 2000) });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/applications/${applicationId}`);
  return { ok: true, message: locale === "ar" ? "تمت مشاركة الملاحظات مع المرشح." : "Feedback shared with the candidate." };
}

// ------------------------------------------------------------------ interviews
const interviewSchema = z.object({
  title: z.string().trim().min(2).max(140),
  type: z.enum(["phone", "video", "onsite", "technical", "behavioral", "panel"]),
  scheduled_at: z.string().min(10),
  duration: z.coerce.number().int().min(10).max(480),
  timezone: z.string().min(3).max(60),
  location: opt(200),
  meeting_url: z.union([z.literal(""), z.string().url().max(400)]).optional(),
  instructions: opt(2000),
});
export async function scheduleInterview(applicationId: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
  await recruiter();
  const { locale } = await getI18n();
  const parsed = interviewSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: locale === "ar" ? "أكمل بيانات المقابلة." : "Complete the interview details." };
  const interviewers = form.getAll("interviewers").map(String);
  const v = parsed.data;
  // datetime-local is interpreted in the chosen IANA time zone
  const iso = zonedToUtc(v.scheduled_at, v.timezone);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_interview", {
    p_application: applicationId, p_title: v.title, p_type: v.type, p_scheduled_at: iso, p_duration: v.duration, p_timezone: v.timezone,
    p_location: v.location ?? "", p_meeting_url: v.meeting_url ?? "", p_instructions: v.instructions ?? "", p_interviewers: interviewers,
  });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/applications/${applicationId}`);
  redirect(`/company/interviews/${data}`);
}

function zonedToUtc(local: string, timeZone: string): string {
  const asUtc = new Date(`${local}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(asUtc);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const zoned = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(asUtc.getTime() - (zoned - asUtc.getTime())).toISOString();
}

export async function setInterviewStatus(interviewId: string, status: "completed" | "cancelled"): Promise<ActionResult> {
  await recruiter();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_interview_status", { p_interview: interviewId, p_status: status });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/interviews/${interviewId}`);
  return { ok: true };
}

export async function rescheduleInterview(interviewId: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
  await recruiter();
  const { locale } = await getI18n();
  const local = String(form.get("scheduled_at") ?? "");
  const tz = String(form.get("timezone") ?? "Asia/Riyadh");
  if (!local) return { ok: false, error: localizeError(null, locale) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_interview_status", { p_interview: interviewId, p_status: "scheduled", p_new_time: zonedToUtc(local, tz) });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/interviews/${interviewId}`);
  return { ok: true, message: locale === "ar" ? "تم تغيير الموعد وإبلاغ المرشح." : "Rescheduled; the candidate was notified." };
}

export async function addInterviewQuestions(interviewId: string, questions: { question: string; kind: "technical" | "behavioral" | "role" | "follow_up"; ai: boolean }[]): Promise<ActionResult> {
  await recruiter();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const { count } = await supabase.from("interview_questions").select("id", { count: "exact", head: true }).eq("interview_id", interviewId);
  const { error } = await supabase.from("interview_questions").insert(questions.slice(0, 15).map((q, i) => ({ interview_id: interviewId, question: q.question.slice(0, 500), kind: q.kind, ai_generated: q.ai, position: (count ?? 0) + i })));
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/interviews/${interviewId}`);
  return { ok: true };
}

const evalSchema = z.object({
  recommendation: z.enum(["strong_yes", "yes", "neutral", "no", "strong_no"]),
  technical: z.coerce.number().int().min(1).max(5),
  problem_solving: z.coerce.number().int().min(1).max(5),
  communication: z.coerce.number().int().min(1).max(5),
  culture: z.coerce.number().int().min(1).max(5),
  strengths: opt(2000),
  concerns: opt(2000),
  comments: opt(3000),
});
export async function submitInterviewEvaluation(interviewId: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
  const s = await requireCompanyMember();
  const { locale } = await getI18n();
  const parsed = evalSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: locale === "ar" ? "أكمل التقييم." : "Complete all ratings." };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("interview_evaluations").upsert(
    { interview_id: interviewId, interviewer_id: s.userId, recommendation: v.recommendation, ratings: { technical: v.technical, problem_solving: v.problem_solving, communication: v.communication, culture: v.culture }, strengths: v.strengths, concerns: v.concerns, comments: v.comments, submitted_at: new Date().toISOString() },
    { onConflict: "interview_id,interviewer_id" },
  );
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/interviews/${interviewId}`);
  return { ok: true, message: locale === "ar" ? "تم حفظ تقييمك السري." : "Your confidential evaluation was saved." };
}

export async function addInterviewFeedback(interviewId: string, applicationId: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
  const s = await requireCompanyMember();
  const { locale } = await getI18n();
  const body = String(form.get("body") ?? "").trim().slice(0, 3000);
  if (!body) return { ok: false, error: locale === "ar" ? "اكتب الملاحظات." : "Write the feedback." };
  const supabase = await createClient();
  const { error } = await supabase.from("interview_feedback").insert({ interview_id: interviewId, application_id: applicationId, author_id: s.userId, body });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/interviews/${interviewId}`);
  return { ok: true };
}

export async function toggleFeedbackShare(interviewId: string, feedbackId: string, share: boolean): Promise<void> {
  await recruiter();
  const supabase = await createClient();
  await supabase.rpc("share_interview_feedback", { p_feedback: feedbackId, p_share: share });
  revalidatePath(`/company/interviews/${interviewId}`);
}

// ------------------------------------------------------------------ team
export async function inviteMember(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const s = await requireCompanyMember(["company_admin"]);
  const { locale } = await getI18n();
  const supabase = await createClient();
  const role = String(form.get("role")) as "recruiter" | "interviewer" | "company_admin";
  const { error } = await supabase.rpc("invite_company_member", { p_company: s.activeMembership.company_id, p_email: String(form.get("email") ?? ""), p_role: role });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/company/team");
  return { ok: true, message: locale === "ar" ? "أُنشئت الدعوة. يقبلها العضو بعد تسجيل الدخول بنفس البريد." : "Invitation created. The person accepts it after signing in with that email." };
}

export async function updateMember(membershipId: string, role: "company_admin" | "recruiter" | "interviewer", active: boolean): Promise<ActionResult> {
  await requireCompanyMember(["company_admin"]);
  const { locale } = await getI18n();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_company_member", { p_membership: membershipId, p_role: role, p_active: active });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/company/team");
  return { ok: true };
}

export async function acceptInvitation(invitationId: string): Promise<void> {
  await requireSession("/invitations");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_company_invitation", { p_invitation: invitationId });
  if (error) redirect("/invitations?error=1");
  redirect("/company");
}
