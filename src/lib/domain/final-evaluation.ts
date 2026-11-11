/**
 * Final Candidate Evaluation — transparent, deterministic scoring (pure; unit-tested).
 * Every component states its source. Missing evidence is reported as missing — never imputed.
 * The AI-assisted recommendation is produced separately and never feeds these numbers.
 */
export interface RubricCriterion {
  key: string;
  name_en: string;
  name_ar: string;
  /** Relative weight inside the interview score (default 1). */
  weight: number;
}

/** Default structured interview rubric (company-editable). Ratings are 1–5. */
export const DEFAULT_INTERVIEW_RUBRIC: RubricCriterion[] = [
  { key: "technical", name_en: "Technical knowledge", name_ar: "المعرفة التقنية", weight: 1.5 },
  { key: "problem_solving", name_en: "Problem-solving", name_ar: "حل المشكلات", weight: 1.25 },
  { key: "communication", name_en: "Communication", name_ar: "التواصل", weight: 1 },
  { key: "critical_thinking", name_en: "Critical thinking", name_ar: "التفكير النقدي", weight: 1 },
  { key: "job_competencies", name_en: "Job-specific competencies", name_ar: "الكفاءات الخاصة بالوظيفة", weight: 1.25 },
  { key: "professional_behavior", name_en: "Professional behavior", name_ar: "السلوك المهني", weight: 0.75 },
  { key: "relevant_experience", name_en: "Relevant experience", name_ar: "الخبرة ذات الصلة", weight: 1 },
];

/** Labels for rating keys used by earlier versions of the interview form. */
export const LEGACY_CRITERIA: Record<string, { name_en: string; name_ar: string }> = {
  culture: { name_en: "Collaboration", name_ar: "التعاون" },
};

export type Recommendation = "strong_yes" | "yes" | "neutral" | "no" | "strong_no";

export interface InterviewEvaluationInput {
  interviewer: string;
  ratings: Record<string, number>;
  recommendation: Recommendation;
}

export interface CriterionSummary {
  key: string;
  name_en: string;
  name_ar: string;
  weight: number;
  average: number | null; // 1..5
  ratings: number; // how many interviewers rated it
}

export function summariseInterviews(evals: InterviewEvaluationInput[], rubric: RubricCriterion[]) {
  const known = new Map(rubric.map((c) => [c.key, c]));
  const keys = [...new Set([...rubric.map((c) => c.key), ...evals.flatMap((e) => Object.keys(e.ratings ?? {}))])];
  const criteria: CriterionSummary[] = keys.map((key) => {
    const vals = evals.map((e) => e.ratings?.[key]).filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5);
    const def = known.get(key);
    const legacy = LEGACY_CRITERIA[key];
    return {
      key,
      name_en: def?.name_en ?? legacy?.name_en ?? key,
      name_ar: def?.name_ar ?? legacy?.name_ar ?? key,
      weight: def?.weight ?? 1,
      average: vals.length ? round(vals.reduce((a, b) => a + b, 0) / vals.length, 2) : null,
      ratings: vals.length,
    };
  });
  const rated = criteria.filter((c) => c.average !== null);
  const wsum = rated.reduce((a, c) => a + c.weight, 0);
  const weightedAvg = wsum ? rated.reduce((a, c) => a + c.weight * c.average!, 0) / wsum : null;
  const tally: Record<Recommendation, number> = { strong_yes: 0, yes: 0, neutral: 0, no: 0, strong_no: 0 };
  for (const e of evals) tally[e.recommendation] += 1;
  return {
    criteria,
    interviewers: evals.length,
    /** 1–5 weighted average, or null with no ratings. */
    average: weightedAvg === null ? null : round(weightedAvg, 2),
    /** Mapped linearly to 0–100 (1 → 0, 5 → 100). */
    score: weightedAvg === null ? null : Math.round(((weightedAvg - 1) / 4) * 100),
    recommendations: tally,
    /** Interviewers disagree when recommendations span both a yes and a no. */
    disagreement: tally.strong_yes + tally.yes > 0 && tally.no + tally.strong_no > 0,
  };
}

export type ComponentKey = "match" | "assessment" | "interview";
export const COMPONENT_WEIGHTS: Record<ComponentKey, number> = { match: 0.3, assessment: 0.35, interview: 0.35 };

export interface OverallComponent {
  key: ComponentKey;
  value: number | null; // 0..100
  weight: number; // nominal
  effectiveWeight: number; // after re-normalising over available evidence
  source: "cv_and_profile" | "practical_assessment" | "interviewer_judgment";
}

/**
 * Weighted overall score over the evidence that EXISTS. Components without data are listed with
 * value=null and effectiveWeight=0 (not imputed). Returns score=null when nothing is available.
 */
export function overallScore(input: { match: number | null; assessment: number | null; interview: number | null }) {
  const source: Record<ComponentKey, OverallComponent["source"]> = {
    match: "cv_and_profile",
    assessment: "practical_assessment",
    interview: "interviewer_judgment",
  };
  const keys: ComponentKey[] = ["match", "assessment", "interview"];
  const present = keys.filter((k) => typeof input[k] === "number");
  const wsum = present.reduce((a, k) => a + COMPONENT_WEIGHTS[k], 0);
  const components: OverallComponent[] = keys.map((k) => ({
    key: k,
    value: input[k] === null || input[k] === undefined ? null : clamp(input[k]!),
    weight: COMPONENT_WEIGHTS[k],
    effectiveWeight: present.includes(k) && wsum ? round(COMPONENT_WEIGHTS[k] / wsum, 3) : 0,
    source: source[k],
  }));
  const score = wsum ? Math.round(components.reduce((a, c) => a + (c.value ?? 0) * c.effectiveWeight, 0)) : null;
  return { score, components, coverage: present.length / keys.length };
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}
function round(n: number, d: number) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
