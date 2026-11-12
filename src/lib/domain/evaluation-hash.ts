import { createHash } from "node:crypto";
import type { Criterion, RubricSource } from "./question-evaluation";

/**
 * Version of the evaluator (prompt, output schema, scoring rules). Part of the input hash, so a result produced by an
 * older evaluator is never reused as if it were current.
 */
export const EVALUATOR_VERSION = "2026-11-12.p0";

export interface EvaluationInput {
  taskId: string;
  questionId: string;
  /** The instructions the evaluator is given (English) and, when used, the Arabic version. */
  prompt: string;
  promptAr?: string | null;
  points: number;
  deliverables: unknown[];
  rubricSource: RubricSource;
  criteria: Criterion[];
  answer: string;
  /** Every file submitted for this question, in a stable order; sha256 is null when the file could not be downloaded. */
  files: { id: string; name: string; mime: string; sha256: string | null }[];
  /** Output language of the explanations (an evaluation in another language is a different result). */
  locale: "ar" | "en";
}

/**
 * Hash of everything that determines an evaluation: file bytes, the written answer, the question, the criteria and the
 * evaluator version. Computed BEFORE any file is read by AI, so an unchanged submission costs no AI call.
 */
export function evaluationInputHash(i: EvaluationInput): string {
  const canonical = {
    v: EVALUATOR_VERSION,
    task: i.taskId,
    question: i.questionId,
    prompt: i.prompt,
    prompt_ar: i.promptAr ?? null,
    points: i.points,
    deliverables: i.deliverables,
    rubric_source: i.rubricSource,
    criteria: i.criteria.map((c) => ({ key: c.key, name: c.name, max: c.max_points, d: c.description ?? null })),
    answer: i.answer,
    files: [...i.files].sort((a, b) => a.id.localeCompare(b.id)).map((f) => [f.id, f.name, f.mime, f.sha256]),
    locale: i.locale,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/**
 * May the latest stored AI result be returned instead of calling the AI again? Only when its input is identical, it was
 * a real result (completed / nothing submitted) and the reviewer has not rejected it. An "unreadable files" result is
 * never reused: reading may succeed on a new attempt (e.g. the transcription provider was unavailable).
 */
export function reusableResult(
  latest: { status: string; input_sha256: string | null; rejected?: boolean } | null | undefined,
  inputSha256: string,
): boolean {
  return Boolean(
    latest && latest.input_sha256 === inputSha256 && !latest.rejected && (latest.status === "completed" || latest.status === "no_submission"),
  );
}
