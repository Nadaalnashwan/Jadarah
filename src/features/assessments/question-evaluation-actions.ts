"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompanyMember } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { isAutoScored, type QuestionType } from "@/lib/domain/scoring";
import { questionCriteria, taskRefsFromGuide, type FileExtraction, type TaskMapping } from "@/lib/domain/question-evaluation";
import { evaluationInputHash, reusableResult } from "@/lib/domain/evaluation-hash";
import { extractSubmittedFile } from "@/services/evaluation/extract";
import { evaluateQuestionSubmission } from "@/services/evaluation/question-evaluator";
import { acquireLocalLock } from "@/services/evaluation/run-lock";

const BUCKET = "assessment-attachments";

const ids = z.object({ applicationId: z.string().uuid(), submissionId: z.string().uuid(), questionId: z.string().uuid() });

export type AiQuestionEvaluation = {
  id: string;
  status: "completed" | "no_submission" | "extraction_failed";
  score: number | null;
  max_score: number;
  created_at: string;
  /** True when the input was unchanged and the stored result was returned without calling the AI. */
  reused: boolean;
};

/** Is this a "function / table does not exist" answer (database without proposal 0034)? */
const missing = (e: { code?: string } | null | undefined) => e?.code === "PGRST202" || e?.code === "PGRST205" || e?.code === "42883" || e?.code === "42P01";

/**
 * AI evaluation of ONE question: its instructions, deliverables and criteria, and ONLY the answer and files the
 * candidate submitted for that question (selected by submission id + question id). The result is stored as an AI
 * suggestion (append-only); it never changes the candidate's score — a reviewer approves, adjusts or rejects it.
 *
 * Duplicate runs are prevented: the input (file bytes, answer, question, criteria, evaluator version) is hashed BEFORE
 * any file is read by AI; when the latest result has the same hash it is returned unless `force` is set (an explicit,
 * confirmed re-evaluation). One run per submission + question at a time (in-process lock, plus a database lock and
 * persisted run states when proposal 0034 is applied).
 */
export async function evaluateQuestionWithAI(
  applicationId: string,
  submissionId: string,
  questionId: string,
  force = false,
): Promise<ActionResult<AiQuestionEvaluation>> {
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const { locale } = await getI18n();
  const lang = locale === "ar" ? "ar" : "en";
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  if (!ids.safeParse({ applicationId, submissionId, questionId }).success) return { ok: false, error: L("Not found", "غير موجود") };
  const supabase = await createClient();

  const [{ data: sub }, { data: q }, { data: ans }, { data: files }, { data: latestRows }] = await Promise.all([
    supabase
      .from("assessment_submissions")
      .select("id, status, assignment:assessment_assignments(application_id, company_id, assessment_id)")
      .eq("id", submissionId)
      .maybeSingle(),
    supabase
      .from("assessment_questions")
      .select("id, assessment_id, type, prompt_en, prompt_ar, points, position, config, rubric_id, rubric:assessment_rubrics(criteria)")
      .eq("id", questionId)
      .maybeSingle(),
    supabase.from("assessment_answers").select("text_answer").eq("submission_id", submissionId).eq("question_id", questionId).maybeSingle(),
    // Only this question's files: matched by submission id AND question id, never by name or order.
    supabase
      .from("assessment_answer_files")
      .select("id, storage_path, file_name, mime_type, size_bytes, question_id")
      .eq("submission_id", submissionId)
      .eq("question_id", questionId)
      .order("created_at"),
    supabase
      .from("assessment_ai_evaluations")
      .select("id, status, score, max_score, created_at, input_sha256")
      .eq("submission_id", submissionId)
      .eq("question_id", questionId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const a = sub?.assignment;
  if (
    !sub ||
    !q ||
    !a ||
    a.application_id !== applicationId ||
    a.assessment_id !== q.assessment_id ||
    a.company_id !== s.activeMembership.company_id
  )
    return { ok: false, error: L("Not found", "غير موجود") };
  if (sub.status === "in_progress") return { ok: false, error: L("The candidate has not submitted yet", "لم يسلّم المرشح بعد") };
  if (isAutoScored(q.type as QuestionType, q.config as { accepted_answers?: unknown }))
    return { ok: false, error: L("This question is scored automatically", "تُصحَّح هذه الإجابة آليًا") };

  // Is the rubric shared with other questions of this assessment (an assessment-wide rubric)? If the task builder mapped
  // its criteria to tasks, narrow it to this question's criteria (read-only; works for tasks locked after assignment).
  let shared = false;
  let mapping: TaskMapping | null = null;
  if (q.rubric_id) {
    const { data: siblings } = await supabase.from("assessment_questions").select("id, position, rubric_id").eq("assessment_id", q.assessment_id);
    const all = siblings ?? [];
    shared = all.filter((x) => x.rubric_id === q.rubric_id).length > 1;
    const positionsAreTasks = new Set(all.map((x) => x.position)).size === all.length && Math.max(...all.map((x) => x.position)) === all.length - 1;
    if (shared && positionsAreTasks) {
      const { data: g } = await supabase.from("assessment_assessor_guides").select("guide").eq("assessment_id", q.assessment_id).maybeSingle();
      const refs = taskRefsFromGuide(g?.guide);
      if (refs) mapping = { position: q.position, taskRefs: refs };
    }
  }
  const picked = questionCriteria(q.rubric, shared, mapping);
  const answer = (ans?.text_answer ?? "").trim();
  const cfg = (q.config ?? {}) as { deliverables?: { name: string; format?: string | null; description?: string | null }[] };
  const question = {
    id: q.id,
    taskId: q.assessment_id,
    position: q.position,
    type: q.type,
    prompt: q.prompt_en,
    points: q.points,
    deliverables: Array.isArray(cfg.deliverables) ? cfg.deliverables.slice(0, 8) : [],
  };
  const promptAr = lang === "ar" ? q.prompt_ar : null;

  // 1. Download this question's files (bytes only; nothing is read by AI yet) and hash the complete input.
  const downloaded: { f: NonNullable<typeof files>[number]; bytes: Buffer | null }[] = [];
  for (const f of files ?? []) {
    const { data: blob, error } = await supabase.storage.from(BUCKET).download(f.storage_path);
    downloaded.push({ f, bytes: error || !blob ? null : Buffer.from(await blob.arrayBuffer()) });
  }
  const inputSha = evaluationInputHash({
    taskId: q.assessment_id,
    questionId: q.id,
    prompt: q.prompt_en,
    promptAr,
    points: q.points,
    deliverables: question.deliverables,
    rubricSource: picked.source,
    criteria: picked.criteria,
    answer,
    files: downloaded.map(({ f, bytes }) => ({ id: f.id, name: f.file_name, mime: f.mime_type, sha256: bytes ? createHash("sha256").update(bytes).digest("hex") : null })),
    locale: lang,
  });

  // 2. Unchanged input: return the stored result without calling the AI (unless a re-evaluation was confirmed).
  const latest = latestRows?.[0];
  if (!force && latest) {
    const { data: rej, error: rejErr } = await supabase.from("assessment_ai_rejections").select("id").eq("ai_evaluation_id", latest.id).maybeSingle();
    if (reusableResult({ ...latest, rejected: !rejErr && Boolean(rej) }, inputSha))
      return {
        ok: true,
        data: {
          id: latest.id,
          status: latest.status as AiQuestionEvaluation["status"],
          score: latest.score === null ? null : Number(latest.score),
          max_score: Number(latest.max_score),
          created_at: latest.created_at,
          reused: true,
        },
      };
  }

  // 3. One run at a time for this submission + question.
  const release = acquireLocalLock(`${submissionId}:${questionId}`);
  if (!release) return { ok: false, error: L("This question is already being evaluated. Wait for it to finish", "يجري تقييم هذا السؤال الآن. انتظر حتى ينتهي") };
  let runId: string | null = null;
  try {
    const begun = await supabase.rpc("begin_ai_question_run", { p_submission: submissionId, p_question: questionId, p_input_sha256: inputSha, p_forced: force });
    if (begun.error && !missing(begun.error)) {
      if (begun.error.code === "55P03")
        return { ok: false, error: L("This question is already being evaluated. Wait for it to finish", "يجري تقييم هذا السؤال الآن. انتظر حتى ينتهي") };
      return { ok: false, error: localizeError(begun.error, lang) };
    }
    runId = begun.error ? null : (begun.data ?? null);
    const fail = async (code: string, message: string) => {
      if (runId) await supabase.rpc("update_ai_question_run", { p_run: runId, p_status: "failed", p_error_code: code, p_error_message: message.slice(0, 500) });
      return { ok: false as const, error: message };
    };

    // 4. Read the actual contents of every file (state: reading files).
    const extractions: FileExtraction[] = [];
    for (const { f, bytes } of downloaded) {
      if (!bytes) {
        extractions.push({ file_id: f.id, file_name: f.file_name, mime_type: f.mime_type, size_bytes: f.size_bytes, method: "none", status: "failed", chars: 0, note: "the file could not be downloaded from storage", text: "" });
        continue;
      }
      extractions.push(await extractSubmittedFile(f, bytes, s.userId));
    }
    // 5. Evaluate (state: evaluating) — only when there is something readable to evaluate.
    if (runId && (answer || extractions.some((x) => (x.status === "read" || x.status === "partial") && x.text)))
      await supabase.rpc("update_ai_question_run", { p_run: runId, p_status: "evaluating" });
    const outcome = await evaluateQuestionSubmission({
      question,
      promptAr,
      criteria: picked.criteria,
      rubricSource: picked.source,
      rubricMapped: picked.mapped,
      answer,
      extractions,
      locale: lang,
      userId: s.userId,
      inputSha256: inputSha,
    });
    if (!outcome.ok) return await fail(outcome.code, outcome.message);
    const payload = { ...outcome.payload, run_id: runId };
    // Database without proposal 0034: model-stated limitations have no column yet, so keep them visible as points to check.
    if (!runId && payload.limitations?.length)
      payload.concerns = [...(payload.concerns ?? []), ...payload.limitations.map((x) => L(`Limitation stated by the evaluator: ${x}`, `قيد ذكره المُقيِّم: ${x}`))].slice(0, 8);

    // 6. Store the result (completes the run atomically).
    const { data: id, error } = await supabase.rpc("record_ai_question_evaluation", { p_submission: submissionId, p_question: questionId, p_result: payload as never });
    if (error || !id) return await fail("store_failed", localizeError(error, lang));
    runId = null; // completed by record_ai_question_evaluation
    revalidatePath(`/company/applications/${applicationId}`);
    return {
      ok: true,
      data: { id: id as string, status: payload.status, score: payload.score ?? null, max_score: q.points, created_at: new Date().toISOString(), reused: false },
    };
  } catch (e) {
    if (runId) await supabase.rpc("update_ai_question_run", { p_run: runId, p_status: "failed", p_error_code: "internal_error", p_error_message: "the evaluation stopped because of an internal error" });
    throw e;
  } finally {
    release();
  }
}

/** Explicitly reject one AI suggestion (with a reason). The AI result is kept unchanged; the decision is recorded. */
export async function rejectAiSuggestion(applicationId: string, aiEvaluationId: string, reason: string): Promise<ActionResult> {
  await requireCompanyMember(["company_admin", "recruiter"]);
  const { locale } = await getI18n();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  if (!z.string().uuid().safeParse(applicationId).success || !z.string().uuid().safeParse(aiEvaluationId).success) return { ok: false, error: L("Not found", "غير موجود") };
  const why = reason.trim().slice(0, 1000);
  if (why.length < 3) return { ok: false, error: L("Give a reason for rejecting the AI suggestion", "اذكر سبب رفض اقتراح الذكاء الاصطناعي") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_ai_question_evaluation", { p_ai_evaluation: aiEvaluationId, p_reason: why });
  if (missing(error))
    return { ok: false, error: L("Rejecting an AI suggestion needs database update 0034, which is not applied yet", "رفض اقتراح الذكاء الاصطناعي يحتاج تحديث قاعدة البيانات 0034 غير المطبَّق بعد") };
  if (error) {
    if (/already been rejected/i.test(error.message)) return { ok: false, error: L("This AI suggestion has already been rejected", "رُفض هذا الاقتراح من قبل") };
    return { ok: false, error: localizeError(error, locale) };
  }
  revalidatePath(`/company/applications/${applicationId}`);
  return { ok: true, message: L("AI suggestion rejected and recorded", "رُفض اقتراح الذكاء الاصطناعي وسُجّل القرار") };
}

const reviewSchema = z.object({
  points: z.coerce.number().min(0),
  comments: z.string().max(2000).default(""),
  fb_strengths: z.string().max(2000).default(""),
  fb_missing: z.string().max(2000).default(""),
  fb_improvements: z.string().max(2000).default(""),
  ai_evaluation_id: z.union([z.string().uuid(), z.literal("")]).default(""),
});

/** Human-approved score and feedback for ONE question (the AI suggestion it was based on is recorded, never altered). */
export async function reviewQuestion(
  applicationId: string,
  submissionId: string,
  questionId: string,
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireCompanyMember(["company_admin", "recruiter"]);
  const { locale } = await getI18n();
  if (!ids.safeParse({ applicationId, submissionId, questionId }).success) return { ok: false, error: localizeError(null, locale) };
  const v = reviewSchema.safeParse(Object.fromEntries(form.entries()));
  if (!v.success) return { ok: false, error: locale === "ar" ? "تحقّق من الدرجة" : "Check the score" };
  const rubric: Record<string, number> = {};
  for (const [k, val] of form.entries()) if (k.startsWith("rubric_") && String(val) !== "") rubric[k.slice(7)] = Number(val) || 0;
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_assessment_question", {
    p_submission: submissionId,
    p_question: questionId,
    p_points: v.data.points,
    p_rubric_scores: rubric,
    p_comments: v.data.comments.trim() || undefined,
    p_candidate_feedback: {
      strengths: v.data.fb_strengths,
      missing: v.data.fb_missing,
      improvements: v.data.fb_improvements,
    },
    p_ai_evaluation: v.data.ai_evaluation_id || undefined,
  });
  if (error?.code === "PGRST202") {
    // Database without migration 0033: the score is still recorded through the original function.
    const old = await supabase.rpc("evaluate_assessment_answer", {
      p_submission: submissionId,
      p_question: questionId,
      p_points: v.data.points,
      p_rubric_scores: rubric,
      p_comments: v.data.comments.slice(0, 2000),
    });
    if (old.error) return { ok: false, error: localizeError(old.error, locale) };
    revalidatePath(`/company/applications/${applicationId}`);
    return { ok: true, message: locale === "ar" ? "حُفظت الدرجة (بلا ملاحظات للمرشح قبل الترحيل 0033)" : "Score saved (candidate feedback needs migration 0033)" };
  }
  if (error && /was rejected/i.test(error.message))
    return { ok: false, error: locale === "ar" ? "رُفض اقتراح الذكاء الاصطناعي هذا؛ قيّم السؤال بنفسك" : "This AI suggestion was rejected; score the question yourself" };
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/applications/${applicationId}`);
  return { ok: true, message: locale === "ar" ? "حُفظ تقييم السؤال" : "Question review saved" };
}
