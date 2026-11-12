"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompanyMember } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { isAutoScored, type QuestionType } from "@/lib/domain/scoring";
import {
  evaluationPrompt,
  evaluationSystemPrompt,
  finaliseScores,
  normaliseDerivedCriteria,
  questionCriteria,
  rekeyDerivedScores,
  submissionBlock,
  taskRefsFromGuide,
  type Criterion,
  type TaskMapping,
  type FileExtraction,
} from "@/lib/domain/question-evaluation";
import { extractSubmittedFile } from "@/services/evaluation/extract";
import { AIUnavailableError, generateJSON } from "@/services/ai/provider";

const BUCKET = "assessment-attachments";

const outputSchema = z.object({
  derived_criteria: z
    .array(z.object({ key: z.string().max(60), name: z.string().max(160), max_points: z.number(), description: z.string().max(400).nullable().optional() }))
    .max(6)
    .default([]),
  criteria: z
    .array(
      z.object({
        key: z.string().max(60),
        applies: z.boolean().nullable().optional(),
        score: z.number(),
        evidence: z.string().max(400).nullable().optional(),
        rationale: z.string().max(700),
      }),
    )
    .max(12),
  requirements: z
    .array(
      z.object({
        requirement: z.string().max(400),
        status: z.enum(["fulfilled", "partial", "missing"]),
        evidence: z.string().max(400).nullable().optional(),
        note: z.string().max(400).nullable().optional(),
      }),
    )
    .max(15),
  strengths: z.array(z.string().max(400)).max(6),
  issues: z.array(z.string().max(400)).max(8),
  improvements: z.array(z.string().max(400)).max(6),
  explanation: z.string().max(1200),
  concerns: z.array(z.string().max(300)).max(5).default([]),
});

const ids = z.object({ applicationId: z.string().uuid(), submissionId: z.string().uuid(), questionId: z.string().uuid() });

export type AiQuestionEvaluation = {
  id: string;
  status: "completed" | "no_submission" | "extraction_failed";
  score: number | null;
  max_score: number;
  created_at: string;
};

/**
 * AI evaluation of ONE question: its instructions, deliverables and criteria, and ONLY the answer and files the
 * candidate submitted for that question (selected by submission id + question id). The result is stored as an AI
 * suggestion (append-only); it never changes the candidate's score — a reviewer approves or adjusts it.
 */
export async function evaluateQuestionWithAI(
  applicationId: string,
  submissionId: string,
  questionId: string,
): Promise<ActionResult<AiQuestionEvaluation>> {
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const { locale } = await getI18n();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  if (!ids.safeParse({ applicationId, submissionId, questionId }).success) return { ok: false, error: L("Not found", "غير موجود") };
  const supabase = await createClient();

  const [{ data: sub }, { data: q }, { data: ans }, { data: files }] = await Promise.all([
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

  // Read every submitted file for this question (actual contents, not names).
  const extractions: FileExtraction[] = [];
  const digests: string[] = [];
  for (const f of files ?? []) {
    const { data: blob, error } = await supabase.storage.from(BUCKET).download(f.storage_path);
    if (error || !blob) {
      extractions.push({ file_id: f.id, file_name: f.file_name, mime_type: f.mime_type, size_bytes: f.size_bytes, method: "none", status: "failed", chars: 0, note: "the file could not be downloaded from storage", text: "" });
      continue;
    }
    const bytes = Buffer.from(await blob.arrayBuffer());
    digests.push(createHash("sha256").update(bytes).digest("hex"));
    extractions.push(await extractSubmittedFile(f, bytes, s.userId));
  }

  const answer = (ans?.text_answer ?? "").trim();
  const prompt = locale === "ar" ? q.prompt_ar : q.prompt_en;
  const cfg = (q.config ?? {}) as { deliverables?: { name: string; format?: string | null; description?: string | null }[] };
  const question = { id: q.id, position: q.position, type: q.type, prompt: q.prompt_en, points: q.points, deliverables: Array.isArray(cfg.deliverables) ? cfg.deliverables.slice(0, 8) : [] };
  // Stored report of what was read (the extracted text itself is not stored).
  const fileReport = extractions.map((x) => ({
    file_id: x.file_id,
    file_name: x.file_name,
    mime_type: x.mime_type,
    size_bytes: x.size_bytes,
    method: x.method,
    status: x.status,
    chars: x.chars,
    note: x.note,
    entries: x.entries?.slice(0, 200),
  }));
  const inputSha = createHash("sha256")
    .update(JSON.stringify({ q: q.id, prompt: q.prompt_en, criteria: picked.criteria, answer, files: digests }))
    .digest("hex");
  const readable = extractions.filter((x) => (x.status === "read" || x.status === "partial") && x.text);

  const base = { rubric_source: picked.source, files: fileReport, answer_present: answer.length > 0, input_sha256: inputSha };
  let payload: Record<string, unknown>;
  if (!answer && !extractions.length) {
    payload = {
      ...base,
      status: "no_submission",
      score: 0,
      criteria: picked.criteria.map((c) => ({ ...c, applicable: true, score: 0, evidence: null, evidence_verified: false, rationale: L("Nothing was submitted", "لم يُسلَّم شيء") })),
      explanation: L(
        "Nothing was submitted for this question: no written answer and no files. Suggested score 0, to be confirmed by the reviewer",
        "لم يُسلَّم شيء لهذا السؤال: لا إجابة مكتوبة ولا ملفات. الدرجة المقترحة 0 بانتظار تأكيد المراجِع",
      ),
    };
  } else if (!answer && !readable.length) {
    payload = {
      ...base,
      status: "extraction_failed",
      score: null,
      explanation: L(
        `None of the submitted files could be read automatically (${extractions.map((x) => `${x.file_name}: ${x.note ?? x.status}`).join("; ")}). Not evaluated: open the files and score manually`,
        `تعذّرت قراءة الملفات المسلَّمة آليًا (${extractions.map((x) => `${x.file_name}: ${x.note ?? x.status}`).join("؛ ")}). لم يُقيَّم: افتح الملفات وقيّم يدويًا`,
      ),
    };
  } else {
    const derive = picked.source === "ai_derived";
    const sub = submissionBlock(answer, extractions);
    let out: z.infer<typeof outputSchema>;
    let provider: string;
    let model: string;
    try {
      const r = await generateJSON(
        {
          operation: "assessment_evaluation",
          userId: s.userId,
          system: evaluationSystemPrompt(locale === "ar" ? "ar" : "en", derive),
          prompt: evaluationPrompt(question, picked.criteria, picked.source, sub.text) +
            (locale === "ar" && prompt !== q.prompt_en ? `\n\n(Arabic version of the instructions for reference)\n${prompt.slice(0, 3000)}` : ""),
          timeoutMs: 60_000,
        },
        outputSchema,
      );
      out = r.data;
      provider = r.provider;
      model = r.model;
    } catch (e) {
      if (e instanceof AIUnavailableError)
        return {
          ok: false,
          error:
            e.message === "not_configured"
              ? L("No AI provider is configured", "لم يُضبط مزوّد ذكاء اصطناعي")
              : L("AI could not evaluate this answer now. Score manually or try again", "تعذّر التقييم الآلي الآن. قيّم يدويًا أو أعد المحاولة"),
        };
      throw e;
    }
    let criteria: Criterion[] = picked.criteria;
    if (derive) {
      const derived = normaliseDerivedCriteria(out.derived_criteria, q.points);
      criteria = derived;
      if (!criteria.length) return { ok: false, error: L("AI could not derive criteria for this question. Score manually", "تعذّر اشتقاق معايير لهذا السؤال. قيّم يدويًا") };
      out.criteria = rekeyDerivedScores(out.criteria, derived);
    }
    // The submitted text this question's evidence must come from (answer + this question's readable files only).
    const submittedText = [answer, ...readable.map((x) => x.text)].join("\n");
    const fin = finaliseScores(criteria, out.criteria, out.requirements, q.points, submittedText, picked.source);
    const concerns = [...out.concerns];
    if (fin.unverified)
      concerns.push(
        L(
          `${fin.unverified} criterion score(s) are not backed by a quote found in the submission; check them`,
          `${fin.unverified} من درجات المعايير لا يدعمها اقتباس موجود في التسليم؛ تحقّق منها`,
        ),
      );
    if (sub.truncated) concerns.push(L("Part of the submission was too long and was cut before evaluation", "جزء من التسليم طويل جدًا واقتُطع قبل التقييم"));
    const unreadable = extractions.filter((x) => x.status === "failed" || x.status === "unsupported");
    if (unreadable.length)
      concerns.push(
        L(
          `Not read automatically: ${unreadable.map((x) => x.file_name).join(", ")}. Review these files manually`,
          `لم تُقرأ آليًا: ${unreadable.map((x) => x.file_name).join("، ")}. راجع هذه الملفات يدويًا`,
        ),
      );
    payload = {
      ...base,
      status: "completed",
      score: fin.score,
      criteria: fin.criteria,
      requirements: fin.requirements,
      strengths: out.strengths,
      issues: out.issues,
      improvements: out.improvements,
      concerns: concerns.slice(0, 8),
      explanation: out.explanation,
      provider,
      model,
    };
  }

  const { data: id, error } = await supabase.rpc("record_ai_question_evaluation", {
    p_submission: submissionId,
    p_question: questionId,
    p_result: payload as never,
  });
  if (error || !id) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/applications/${applicationId}`);
  return {
    ok: true,
    data: {
      id: id as string,
      status: payload.status as AiQuestionEvaluation["status"],
      score: (payload.score as number | null) ?? null,
      max_score: q.points,
      created_at: new Date().toISOString(),
    },
  };
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
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath(`/company/applications/${applicationId}`);
  return { ok: true, message: locale === "ar" ? "حُفظ تقييم السؤال" : "Question review saved" };
}
