"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompanyMember } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AIUnavailableError, generateJSON } from "@/services/ai/provider";
import { evidencePack, loadFinalReport } from "@/services/final-evaluation";
import { rubricSchema } from "@/services/interview-rubric";

const SOURCES = ["verified_fact", "cv_extraction", "semantic_match", "practical_assessment", "interviewer_judgment"] as const;
const point = z.object({ point: z.string().max(300), evidence: z.string().max(400), source: z.enum(SOURCES) });
const aiReportSchema = z.object({
  summary: z.string().max(1500),
  strengths: z.array(point).max(6),
  gaps: z.array(point).max(6),
  verify_next: z.array(z.string().max(300)).max(5),
  development: z.array(z.string().max(300)).max(4).default([]),
  recommendation: z.object({
    stance: z.enum(["advance", "hold", "do_not_advance", "insufficient_evidence"]),
    confidence: z.enum(["low", "medium", "high"]),
    basis: z.string().max(800),
  }),
});
export type AIReport = z.infer<typeof aiReportSchema>;

async function ctx() {
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  return { s, cid: s.activeMembership.company_id, supabase: await createClient(), ...(await getI18n()) };
}

async function ensureDraft(supabase: Awaited<ReturnType<typeof createClient>>, applicationId: string, companyId: string) {
  const { data } = await supabase.from("final_evaluations").select("id, status").eq("application_id", applicationId).maybeSingle();
  if (data) return data;
  const { data: created, error } = await supabase
    .from("final_evaluations")
    .insert({ application_id: applicationId, company_id: companyId })
    .select("id, status")
    .single();
  if (error) throw error;
  return created;
}

/**
 * AI-assisted evidence synthesis (deep task → OpenAI; visible fallback). Input is a de-identified
 * evidence pack; output is a recommendation WITH its basis, stored on the draft for human review.
 * It never changes the application status — the authorised company decides.
 */
export async function generateFinalAiReport(applicationId: string): Promise<ActionResult> {
  const { s, cid, supabase, locale } = await ctx();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const report = await loadFinalReport(supabase, applicationId, cid, locale);
  if (!report) return { ok: false, error: L("Application not found.", "الطلب غير موجود.") };
  if (report.final?.status === "finalized") return { ok: false, error: L("This evaluation is finalized.", "هذا التقييم نهائي.") };
  try {
    const { data, provider, model } = await generateJSON(
      {
        operation: "final_evaluation",
        userId: s.userId,
        system: `You assist a hiring panel by synthesising evidence about ONE candidate for ONE role.
Rules:
- Use ONLY the evidence provided. Never invent experience, scores or facts. If evidence is thin, say so and prefer stance "insufficient_evidence".
- Tag every strength/gap with its source: verified_fact | cv_extraction | semantic_match | practical_assessment | interviewer_judgment. Semantic similarity and related-skill matches are inference, not proof.
- Distinguish clearly what is demonstrated vs. claimed vs. inferred. Point out interviewer disagreement.
- Never consider or mention age, gender, nationality, religion, marital status, disability or any protected characteristic.
- You do NOT make the hiring decision; you recommend with a transparent basis. Write in ${locale === "ar" ? "Modern Standard Arabic" : "English"}.
Return JSON {summary, strengths:[{point,evidence,source}], gaps:[{point,evidence,source}], verify_next:[], development:[], recommendation:{stance, confidence, basis}}.`,
        prompt: `EVIDENCE PACK (de-identified):\n${JSON.stringify(evidencePack(report))}`,
      },
      aiReportSchema,
    );
    const draft = await ensureDraft(supabase, applicationId, cid);
    const { error } = await supabase
      .from("final_evaluations")
      .update({
        ai_report: data,
        ai_provider: provider,
        ai_model: model,
        ai_generated_at: new Date().toISOString(),
        ai_generated_by: s.userId,
      })
      .eq("id", draft.id);
    if (error) return { ok: false, error: localizeError(error, locale) };
    await supabase.from("ai_analysis_records").insert({
      user_id: s.userId,
      company_id: cid,
      kind: "final_evaluation",
      subject_type: "application",
      subject_id: applicationId,
      provider,
      model,
      status: "completed",
      output: { stance: data.recommendation.stance, confidence: data.recommendation.confidence },
    });
    revalidatePath(`/company/applications/${applicationId}/report`);
    return { ok: true, message: L("AI analysis ready. Review it before deciding.", "التحليل الآلي جاهز. راجعه قبل القرار.") };
  } catch (e) {
    if (e instanceof AIUnavailableError)
      return { ok: false, error: L("AI analysis is unavailable right now. The evidence report remains usable.", "التحليل الآلي غير متاح الآن، ويبقى تقرير الأدلة صالحًا للاستخدام.") };
    throw e;
  }
}

export async function saveFinalSummary(applicationId: string, summary: string): Promise<ActionResult> {
  const { cid, supabase, locale } = await ctx();
  const draft = await ensureDraft(supabase, applicationId, cid);
  const { error } = await supabase.from("final_evaluations").update({ summary: summary.slice(0, 4000) }).eq("id", draft.id);
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/applications/${applicationId}/report`);
  return { ok: true, message: locale === "ar" ? "حُفظت الخلاصة." : "Summary saved." };
}

export async function addFinalComment(applicationId: string, body: string): Promise<ActionResult> {
  const { cid, supabase, locale } = await ctx();
  const text = body.trim().slice(0, 3000);
  if (!text) return { ok: false, error: localizeError(null, locale) };
  const draft = await ensureDraft(supabase, applicationId, cid);
  const { error } = await supabase.from("final_evaluation_comments").insert({ final_evaluation_id: draft.id, body: text });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/applications/${applicationId}/report`);
  return { ok: true };
}

const decisionSchema = z.object({
  decision: z.enum(["hire", "reject", "hold"]),
  rationale: z.string().trim().min(10).max(2000),
  candidate_message: z.string().trim().max(1000).optional(),
});

/** Final HUMAN decision; finalizes and locks the evaluation (hire allowed without shortlisting). */
export async function decideFinal(applicationId: string, input: unknown): Promise<ActionResult> {
  const { cid, supabase, locale } = await ctx();
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: locale === "ar" ? "اكتب مبررًا للقرار (10 أحرف على الأقل)." : "Explain the decision (at least 10 characters)." };
  const draft = await ensureDraft(supabase, applicationId, cid);
  const { error } = await supabase.rpc("decide_final_evaluation", {
    p_eval: draft.id,
    p_decision: parsed.data.decision,
    p_rationale: parsed.data.rationale,
    p_candidate_message: parsed.data.candidate_message || undefined,
  });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/applications/${applicationId}`, "layout");
  return { ok: true, message: locale === "ar" ? "سُجّل القرار واعتُمد التقييم." : "Decision recorded; evaluation finalized." };
}

export async function shareFinalFeedback(applicationId: string, feedback: string): Promise<ActionResult> {
  const { cid, supabase, locale } = await ctx();
  const draft = await ensureDraft(supabase, applicationId, cid);
  const { error } = await supabase.rpc("share_final_feedback", { p_eval: draft.id, p_feedback: feedback });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/applications/${applicationId}/report`);
  return { ok: true, message: locale === "ar" ? "تمت مشاركة الملاحظات مع المرشح." : "Feedback shared with the candidate." };
}

/** Edit the company's structured interview rubric (recruiters/admins). */
export async function saveInterviewRubric(criteria: unknown): Promise<ActionResult> {
  const { s, cid, supabase, locale } = await ctx();
  const parsed = rubricSchema.safeParse(criteria);
  if (!parsed.success)
    return { ok: false, error: locale === "ar" ? "تحقق من المعايير (اسم ووزن لكل معيار، دون تكرار)." : "Check the criteria (name and weight each, no duplicates)." };
  const { error } = await supabase
    .from("interview_rubrics")
    .upsert({ company_id: cid, criteria: parsed.data, updated_by: s.userId, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/company/interviews", "layout");
  return { ok: true, message: locale === "ar" ? "حُفظت معايير المقابلة." : "Interview rubric saved." };
}
