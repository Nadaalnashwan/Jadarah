import "server-only";
import { isAutoScored, type QuestionType } from "@/lib/domain/scoring";
import { evaluationConfidence, questionCriteria, questionEvaluationState, type Confidence, type ConfidenceReason } from "@/lib/domain/question-evaluation";
import type { AiEvaluationView, QuestionReviewView } from "./question-review";

type Q = {
  id: string;
  type: string;
  prompt_en: string;
  prompt_ar: string;
  points: number;
  position: number;
  config: unknown;
  rubric_id: string | null;
  rubric: { criteria: unknown } | null;
  assessment_options: { id: string; label_en: string; label_ar: string; is_correct: boolean }[];
};
type Answer = { question_id: string; text_answer: string | null; selected_option_ids: string[]; points_awarded: number | null };
type BaseEval = { question_id: string | null; points: number; comments: string | null };
export type EvalExtra = {
  submission_id: string;
  question_id: string | null;
  rubric_scores: unknown;
  candidate_feedback: unknown;
  source: string;
  ai_evaluation_id: string | null;
  created_at: string;
  updated_at: string | null;
  evaluator: { full_name: string | null } | null;
};
export type FileRow = { id: string; submission_id: string; question_id: string | null; file_name: string; size_bytes: number; mime_type: string };
export type HistoryRow = {
  submission_id: string;
  question_id: string | null;
  action: string;
  points: number | null;
  previous_points: number | null;
  source: string | null;
  comments?: string | null;
  ai_evaluation_id?: string | null;
  changed_at: string;
};
/** Proposal 0034: one AI evaluation attempt (newest first). */
export type RunRow = {
  submission_id: string;
  question_id: string;
  status: string;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  updated_at: string;
  forced: boolean;
};
/** Proposal 0034: an explicit rejection of one AI result. */
export type RejectionRow = {
  ai_evaluation_id: string;
  submission_id: string;
  question_id: string;
  reason: string;
  created_at: string;
  rejected_by_profile: { full_name: string | null } | null;
};

const LIMITATION_PREFIXES = ["Limitation stated by the evaluator: ", "قيد ذكره المُقيِّم: "];

/**
 * Per-question review data for one submission. Every answer, file, AI evaluation and human review is matched to its
 * question by question id (never by position, order or file name).
 */
export function buildQuestionViews(
  locale: "ar" | "en",
  submissionId: string,
  questions: Q[],
  answers: Answer[],
  baseEvals: BaseEval[],
  extras: EvalExtra[],
  files: FileRow[],
  aiRows: (AiEvaluationView & { submission_id: string; question_id: string })[],
  history: HistoryRow[],
  /** The builder's criterion → task mapping for this assessment (assessor guide), when present. */
  taskRefs: Record<string, number[]> | null = null,
  reliability: { runs: RunRow[]; rejections: RejectionRow[] } = { runs: [], rejections: [] },
  now = Date.now(),
): QuestionReviewView[] {
  const sorted = [...questions].sort((a, b) => a.position - b.position);
  const positionsAreTasks = sorted.every((q, i) => q.position === i);
  const rubricUse = new Map<string, number>();
  for (const q of sorted) if (q.rubric_id) rubricUse.set(q.rubric_id, (rubricUse.get(q.rubric_id) ?? 0) + 1);
  return sorted.map((q, i) => {
    const prompt = locale === "ar" ? q.prompt_ar : q.prompt_en;
    const ans = answers.find((a) => a.question_id === q.id);
    const base = baseEvals.find((e) => e.question_id === q.id);
    const extra = extras.find((e) => e.submission_id === submissionId && e.question_id === q.id);
    const mine = aiRows.filter((r) => r.submission_id === submissionId && r.question_id === q.id); // newest first
    const picked = questionCriteria(
      q.rubric,
      q.rubric_id ? (rubricUse.get(q.rubric_id) ?? 0) > 1 : false,
      taskRefs && positionsAreTasks ? { position: q.position, taskRefs } : null,
    );
    const cfg = (q.config ?? {}) as { deliverables?: QuestionReviewView["deliverables"]; accepted_answers?: unknown };
    const latest = mine[0] ?? null;
    const run = reliability.runs.find((r) => r.submission_id === submissionId && r.question_id === q.id) ?? null; // newest first
    const rejection = latest ? reliability.rejections.find((r) => r.ai_evaluation_id === latest.id) ?? null : null;
    // Model-stated limitations: their own column (0034), or folded into "points to check" on databases without it.
    const limitations = latest
      ? Array.isArray(latest.limitations) && latest.limitations.length
        ? latest.limitations
        : latest.concerns.flatMap((c) => LIMITATION_PREFIXES.filter((p) => c.startsWith(p)).map((p) => c.slice(p.length)))
      : [];
    const autoScored = isAutoScored(q.type as QuestionType, (q.config ?? {}) as { accepted_answers?: unknown });
    // Confidence: as stored with the result (0034) or derived the same way from what was stored.
    const confidence: { level: Confidence; reasons: ConfidenceReason[] } | null = latest
      ? latest.confidence && Array.isArray(latest.confidence_reasons) && latest.confidence_reasons.length
        ? { level: latest.confidence, reasons: latest.confidence_reasons }
        : evaluationConfidence({
            status: latest.status,
            rubric_source: latest.rubric_source,
            rubricMapped: picked.mapped,
            files: latest.files,
            criteria: latest.criteria,
            limitations,
            answerChars: (ans?.text_answer ?? "").trim().length,
          })
      : null;
    const selected = (ans?.selected_option_ids ?? [])
      .map((id) => q.assessment_options.find((o) => o.id === id))
      .filter((o): o is Q["assessment_options"][number] => Boolean(o))
      .map((o) => ({ label: locale === "ar" ? o.label_ar : o.label_en, correct: o.is_correct }));
    return {
      id: q.id,
      n: i + 1,
      type: q.type,
      title: prompt.split("\n")[0].slice(0, 90),
      prompt,
      points: q.points,
      autoScored,
      deliverables: Array.isArray(cfg.deliverables) ? cfg.deliverables.slice(0, 8) : [],
      rubricSource: picked.source,
      rubricMapped: picked.mapped ?? false,
      criteria: picked.criteria,
      answerText: ans?.text_answer ?? null,
      selected,
      autoPoints: ans?.points_awarded ?? null,
      files: files
        .filter((f) => f.submission_id === submissionId && f.question_id === q.id)
        .map(({ id, file_name, size_bytes, mime_type }) => ({ id, file_name, size_bytes, mime_type })),
      ai: latest,
      aiRuns: mine.length,
      state: questionEvaluationState({ autoScored, reviewed: Boolean(base), ai: latest, run, now }),
      lastRun: run ? { status: run.status, error_code: run.error_code, error_message: run.error_message, at: run.updated_at } : null,
      confidence,
      limitations,
      rejection: rejection ? { reason: rejection.reason, at: rejection.created_at, by: rejection.rejected_by_profile?.full_name ?? null } : null,
      review: base
        ? {
            points: Number(base.points),
            rubric_scores: (extra?.rubric_scores ?? {}) as Record<string, number>,
            comments: base.comments,
            candidate_feedback: (extra?.candidate_feedback ?? null) as { strengths?: string; missing?: string; improvements?: string } | null,
            source: ((extra?.source as "human" | "ai_accepted" | "ai_adjusted" | "ai_rejected") ?? "human"),
            ai_evaluation_id: extra?.ai_evaluation_id ?? null,
            at: extra?.updated_at ?? extra?.created_at ?? "",
            by: extra?.evaluator?.full_name ?? null,
          }
        : null,
      history: history
        .filter((h) => h.submission_id === submissionId && h.question_id === q.id)
        .map((h) => ({
          action: h.action,
          points: h.points,
          previous_points: h.previous_points,
          source: h.source,
          at: h.changed_at,
          // The reason is recorded with an explicit rejection (company-only history; never shown to the candidate).
          note: h.action === "ai_rejected" ? (h.comments ?? null) : null,
        })),
    };
  });
}
