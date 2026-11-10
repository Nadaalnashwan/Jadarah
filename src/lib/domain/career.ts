/** Career intelligence: skill-gap analysis and development progress. Deterministic and explainable. */
export interface CandidateSkillLite {
  slug: string;
  level: number;
  source: "self" | "cv" | "assessment" | "verified";
}

export interface GapAnalysis {
  strong: string[]; // level >= 4
  developing: string[]; // level 2-3 (partially developed)
  missing: string[];
  coverage: number; // 0..1 share of required skills present at level >= 3
}

export function analyzeSkillGap(required: readonly string[], skills: readonly CandidateSkillLite[]): GapAnalysis {
  const map = new Map(skills.map((s) => [s.slug, s]));
  const strong: string[] = [];
  const developing: string[] = [];
  const missing: string[] = [];
  for (const slug of required) {
    const s = map.get(slug);
    if (!s) missing.push(slug);
    else if (s.level >= 4) strong.push(slug);
    else developing.push(slug);
  }
  const covered = required.filter((slug) => (map.get(slug)?.level ?? 0) >= 3).length;
  return { strong, developing, missing, coverage: required.length ? round2(covered / required.length) : 0 };
}

export interface PlanItemLite {
  status: "not_started" | "in_progress" | "completed";
  estimated_hours?: number | null;
}

/** Progress weighted by estimated hours when available; in-progress items count half. */
export function planProgress(items: readonly PlanItemLite[]): number {
  if (items.length === 0) return 0;
  let total = 0;
  let done = 0;
  for (const item of items) {
    const w = item.estimated_hours && item.estimated_hours > 0 ? item.estimated_hours : 1;
    total += w;
    if (item.status === "completed") done += w;
    else if (item.status === "in_progress") done += w * 0.5;
  }
  return Math.round((done / total) * 100);
}

export interface ProfileCompletionInput {
  full_name?: string | null;
  headline?: string | null;
  summary?: string | null;
  city?: string | null;
  education: number;
  experience: number;
  skills: number;
  projects: number;
  certifications: number;
  languages: number;
  cvs: number;
}

const COMPLETION_WEIGHTS: Array<[keyof ProfileCompletionInput, number]> = [
  ["full_name", 8],
  ["headline", 10],
  ["summary", 12],
  ["city", 5],
  ["education", 12],
  ["experience", 13],
  ["skills", 15],
  ["projects", 8],
  ["certifications", 5],
  ["languages", 4],
  ["cvs", 8],
];

export function profileCompletion(p: ProfileCompletionInput): number {
  let score = 0;
  for (const [key, weight] of COMPLETION_WEIGHTS) {
    const v = p[key];
    const present = typeof v === "number" ? v > 0 : Boolean(v && String(v).trim());
    if (present) score += weight;
  }
  return score;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
