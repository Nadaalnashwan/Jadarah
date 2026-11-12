import "server-only";
import { z } from "zod";
import {
  evaluationConfidence,
  evaluationPrompt,
  evaluationSystemPrompt,
  finaliseScores,
  normaliseDerivedCriteria,
  rekeyDerivedScores,
  submissionBlock,
  type Criterion,
  type EvaluationQuestion,
  type FileExtraction,
  type RubricSource,
} from "@/lib/domain/question-evaluation";
import { EVALUATOR_VERSION } from "@/lib/domain/evaluation-hash";
import { AIUnavailableError, generateJSON } from "@/services/ai/provider";

/**
 * The evaluation of ONE question from what was actually read from its submission. Shared by the employer's server
 * action and the offline verification harness (scripts/verify/evaluate-fixtures.ts), so both run exactly the same
 * prompt, schema and scoring. Nothing here touches the database.
 */

export const evaluationOutputSchema = z.object({
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
  limitations: z.array(z.string().max(300)).max(6).default([]),
});

export type EvaluationPayload = {
  status: "completed" | "no_submission" | "extraction_failed";
  score: number | null;
  concerns?: string[];
  limitations?: string[];
  [key: string]: unknown;
};

export type EvaluationOutcome =
  | { ok: true; payload: EvaluationPayload; aiCalled: boolean }
  | { ok: false; code: string; message: string };

export async function evaluateQuestionSubmission(input: {
  question: EvaluationQuestion;
  /** Arabic instructions, appended for reference when the reviewer works in Arabic. */
  promptAr?: string | null;
  criteria: Criterion[];
  rubricSource: RubricSource;
  rubricMapped?: boolean;
  answer: string;
  extractions: FileExtraction[];
  locale: "ar" | "en";
  userId: string;
  inputSha256: string;
}): Promise<EvaluationOutcome> {
  const { question: q, extractions, answer, locale } = input;
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const readable = extractions.filter((x) => (x.status === "read" || x.status === "partial") && x.text);
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
  const base = {
    rubric_source: input.rubricSource,
    files: fileReport,
    answer_present: answer.length > 0,
    input_sha256: input.inputSha256,
    evaluator_version: EVALUATOR_VERSION,
    task_id: q.taskId,
    question_id: q.id,
  };
  const withConfidence = (p: EvaluationPayload): EvaluationPayload => {
    const c = evaluationConfidence({
      status: p.status,
      rubric_source: input.rubricSource,
      rubricMapped: input.rubricMapped,
      files: fileReport,
      criteria: (p.criteria as { applicable?: boolean; score: number; evidence_verified: boolean }[] | undefined) ?? [],
      limitations: (p.limitations as string[] | undefined) ?? [],
      answerChars: answer.length,
    });
    return { ...p, confidence: c.level, confidence_reasons: c.reasons };
  };

  if (!answer && !extractions.length)
    return {
      ok: true,
      aiCalled: false,
      payload: withConfidence({
        ...base,
        status: "no_submission",
        score: 0,
        criteria: input.criteria.map((c) => ({ ...c, applicable: true, score: 0, evidence: null, evidence_verified: false, rationale: L("Nothing was submitted", "لم يُسلَّم شيء") })),
        explanation: L(
          "Nothing was submitted for this question: no written answer and no files. Suggested score 0, to be confirmed by the reviewer",
          "لم يُسلَّم شيء لهذا السؤال: لا إجابة مكتوبة ولا ملفات. الدرجة المقترحة 0 بانتظار تأكيد المراجِع",
        ),
      }),
    };
  if (!answer && !readable.length)
    // Nothing readable: never scored, never sent to the evaluator as if it had content.
    return {
      ok: true,
      aiCalled: false,
      payload: withConfidence({
        ...base,
        status: "extraction_failed",
        score: null,
        explanation: L(
          `None of the submitted files could be read automatically (${extractions.map((x) => `${x.file_name}: ${x.note ?? x.status}`).join("; ")}). Not evaluated: open the files and score manually`,
          `تعذّرت قراءة الملفات المسلَّمة آليًا (${extractions.map((x) => `${x.file_name}: ${x.note ?? x.status}`).join("؛ ")}). لم يُقيَّم: افتح الملفات وقيّم يدويًا`,
        ),
      }),
    };

  const derive = input.rubricSource === "ai_derived";
  const sub = submissionBlock(answer, extractions);
  let out: z.infer<typeof evaluationOutputSchema>;
  let provider: string;
  let model: string;
  try {
    const r = await generateJSON(
      {
        operation: "assessment_evaluation",
        userId: input.userId,
        system: evaluationSystemPrompt(locale, derive),
        prompt:
          evaluationPrompt(q, input.criteria, input.rubricSource, sub.text) +
          (locale === "ar" && input.promptAr && input.promptAr !== q.prompt ? `\n\n(Arabic version of the instructions for reference)\n${input.promptAr.slice(0, 3000)}` : ""),
        timeoutMs: 60_000,
      },
      evaluationOutputSchema,
    );
    out = r.data;
    provider = r.provider;
    model = r.model;
  } catch (e) {
    if (e instanceof AIUnavailableError)
      return {
        ok: false,
        code: e.message === "not_configured" ? "not_configured" : (e.message.match(/^[a-z0-9_]{1,60}$/)?.[0] ?? "ai_unavailable"),
        message:
          e.message === "not_configured"
            ? L("No AI provider is configured", "لم يُضبط مزوّد ذكاء اصطناعي")
            : e.message === "rate_limited"
              ? L("Too many AI requests in the last minute. Wait a moment and try again", "طلبات كثيرة خلال الدقيقة الأخيرة. انتظر قليلًا ثم أعد المحاولة")
              : L("AI could not evaluate this answer now. Score manually or try again", "تعذّر التقييم الآلي الآن. قيّم يدويًا أو أعد المحاولة"),
      };
    throw e;
  }
  let criteria: Criterion[] = input.criteria;
  if (derive) {
    const derived = normaliseDerivedCriteria(out.derived_criteria, q.points);
    criteria = derived;
    if (!criteria.length)
      return { ok: false, code: "criteria_not_derived", message: L("AI could not derive criteria for this question. Score manually", "تعذّر اشتقاق معايير لهذا السؤال. قيّم يدويًا") };
    out.criteria = rekeyDerivedScores(out.criteria, derived);
  }
  // The submitted text this question's evidence must come from (answer + this question's readable files only).
  const submittedText = [answer, ...readable.map((x) => x.text)].join("\n");
  const fin = finaliseScores(criteria, out.criteria, out.requirements, q.points, submittedText, input.rubricSource);
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
  return {
    ok: true,
    aiCalled: true,
    payload: withConfidence({
      ...base,
      status: "completed",
      score: fin.score,
      criteria: fin.criteria,
      requirements: fin.requirements,
      strengths: out.strengths,
      issues: out.issues,
      improvements: out.improvements,
      concerns: concerns.slice(0, 8),
      limitations: out.limitations.filter((x) => x.trim()).slice(0, 6),
      explanation: out.explanation,
      provider,
      model,
    }),
  };
}
