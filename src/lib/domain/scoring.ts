/**
 * Objective assessment scoring. Mirror of public.submit_assessment().
 * Subjective question types always require rubric-based human review.
 */
export type QuestionType =
  | "multiple_choice"
  | "multiple_select"
  | "true_false"
  | "short_answer"
  | "long_answer"
  | "coding"
  | "sql"
  | "case_study"
  | "file_upload";

export const OBJECTIVE_TYPES: readonly QuestionType[] = ["multiple_choice", "multiple_select", "true_false"];

export function isAutoScored(type: QuestionType, config?: { accepted_answers?: unknown } | null): boolean {
  if (OBJECTIVE_TYPES.includes(type)) return true;
  return type === "short_answer" && Array.isArray(config?.accepted_answers);
}

export function requiresHumanReview(type: QuestionType, config?: { accepted_answers?: unknown } | null): boolean {
  return !isAutoScored(type, config);
}

export function scoreChoice(
  type: "multiple_choice" | "true_false" | "multiple_select",
  selected: readonly string[],
  correct: readonly string[],
  points: number,
): number {
  const correctSet = new Set(correct);
  const unique = Array.from(new Set(selected));
  const hits = unique.filter((s) => correctSet.has(s)).length;
  const wrong = unique.length - hits;
  if (type === "multiple_select") {
    if (correctSet.size === 0) return 0;
    return round2(Math.max(0, (hits - wrong) / correctSet.size) * points);
  }
  return hits === 1 && wrong === 0 && unique.length === 1 ? points : 0;
}

export function scoreShortAnswer(answer: string | null | undefined, accepted: readonly string[], points: number): number {
  const normalized = (answer ?? "").trim().toLowerCase();
  return accepted.some((a) => a.trim().toLowerCase() === normalized) && normalized !== "" ? points : 0;
}

export function percentage(score: number, max: number): number | null {
  if (max <= 0) return null;
  return round2((score / max) * 100);
}

export function passed(pct: number | null, passingScore: number): boolean | null {
  return pct === null ? null : pct >= passingScore;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
