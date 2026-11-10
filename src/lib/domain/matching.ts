/**
 * Explainable, evidence-based job matching.
 *
 * Every requirement is classified individually so recruiters see WHY a score exists:
 *  - matched    : candidate has the skill at/above the required level, backed by evidence
 *                 (CV extraction reviewed by the candidate, an assessment, or reviewer verification)
 *  - unverified : candidate claims the skill at/above the level but provides no evidence
 *  - partial    : candidate has the skill below the required level
 *  - missing    : candidate does not list the skill
 *
 * The score is a transparent weighted coverage, never an opaque ranking.
 * It never invents skills: only records present in the candidate profile count.
 */
export type SkillSource = "self" | "cv" | "assessment" | "verified";
export type MatchStatus = "matched" | "partial" | "missing" | "unverified";

export interface JobSkillRequirement {
  skill_id: string;
  name: string;
  importance: "required" | "preferred";
  min_level: number;
}

export interface CandidateSkillRecord {
  skill_id: string;
  level: number;
  source: SkillSource;
  evidence?: string | null;
  years?: number | null;
}

export interface RequirementResult {
  skill_id: string;
  name: string;
  importance: "required" | "preferred";
  status: MatchStatus;
  required_level: number;
  candidate_level: number | null;
  source: SkillSource | null;
  evidence: string | null;
}

export interface MatchResult {
  score: number; // 0..100
  requirements: RequirementResult[];
  counts: Record<MatchStatus, number>;
  experience: { required: number; candidate: number | null; meets: boolean | null };
  method: "rule_based";
}

const STATUS_CREDIT: Record<MatchStatus, number> = { matched: 1, unverified: 0.6, partial: 0.5, missing: 0 };
const IMPORTANCE_WEIGHT = { required: 1, preferred: 0.5 } as const;

export function hasEvidence(skill: CandidateSkillRecord): boolean {
  return skill.source !== "self" || Boolean(skill.evidence && skill.evidence.trim().length > 0);
}

export function classifyRequirement(req: JobSkillRequirement, skill: CandidateSkillRecord | undefined): MatchStatus {
  if (!skill) return "missing";
  if (skill.level < req.min_level) return "partial";
  return hasEvidence(skill) ? "matched" : "unverified";
}

export function computeMatch(
  requirements: readonly JobSkillRequirement[],
  candidateSkills: readonly CandidateSkillRecord[],
  experience: { required: number; candidate: number | null },
): MatchResult {
  const bySkill = new Map(candidateSkills.map((s) => [s.skill_id, s]));
  const counts: Record<MatchStatus, number> = { matched: 0, partial: 0, missing: 0, unverified: 0 };
  let earned = 0;
  let possible = 0;

  const results: RequirementResult[] = requirements.map((req) => {
    const skill = bySkill.get(req.skill_id);
    const status = classifyRequirement(req, skill);
    counts[status] += 1;
    const weight = IMPORTANCE_WEIGHT[req.importance];
    possible += weight;
    earned += weight * STATUS_CREDIT[status];
    return {
      skill_id: req.skill_id,
      name: req.name,
      importance: req.importance,
      status,
      required_level: req.min_level,
      candidate_level: skill?.level ?? null,
      source: skill?.source ?? null,
      evidence: skill?.evidence ?? null,
    };
  });

  // Experience contributes up to 15% of the score, only when the job sets a minimum.
  let score = possible > 0 ? (earned / possible) * 100 : 0;
  const meets = experience.candidate === null ? null : experience.candidate >= experience.required;
  if (experience.required > 0) {
    const expRatio =
      experience.candidate === null ? 0 : Math.min(1, experience.candidate / Math.max(1, experience.required));
    score = possible > 0 ? score * 0.85 + expRatio * 15 : expRatio * 100;
  }

  return {
    score: Math.round(score),
    requirements: results,
    counts,
    experience: { required: experience.required, candidate: experience.candidate, meets },
    method: "rule_based",
  };
}
