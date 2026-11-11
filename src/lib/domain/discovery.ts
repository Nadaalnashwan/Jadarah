/**
 * Career discovery: recommends job families from the platform's own taxonomy (job categories) using the
 * candidate's real skills and interests against the skills that published jobs in each category ask for.
 * Pure and explainable — every recommendation lists the matching and missing skills that produced it.
 * This is guidance, never a hiring signal.
 */
export type DiscoverySkill = { id: string; name: string; source: string };
export type CategoryDemand = {
  slug: string;
  name: string;
  jobs: { id: string; title: string }[];
  /** skill id → { name, how many published jobs in the category require it } */
  skills: Map<string, { name: string; count: number; required: number }>;
};
export type Recommendation = {
  slug: string;
  name: string;
  score: number; // 0..1, ranking only (not shown as a hiring score)
  matched: { name: string; source: string }[];
  missing: string[];
  jobs: { id: string; title: string }[];
  interest: boolean;
};

const norm = (s: string) => s.trim().toLowerCase();

export function recommendCareers(
  skills: DiscoverySkill[],
  interests: string[],
  categories: CategoryDemand[],
  limit = 4,
): Recommendation[] {
  const have = new Map(skills.map((s) => [s.id, s]));
  const wanted = interests.map(norm).filter(Boolean);
  return categories
    .map((c) => {
      const demand = [...c.skills.entries()].sort((a, b) => b[1].count - a[1].count || b[1].required - a[1].required);
      const total = demand.reduce((n, [, d]) => n + d.count, 0);
      const covered = demand.filter(([id]) => have.has(id)).reduce((n, [, d]) => n + d.count, 0);
      const interest = wanted.some((w) => norm(c.name).includes(w) || w.includes(norm(c.slug)) || norm(c.slug).includes(w));
      const overlap = total ? covered / total : 0;
      return {
        slug: c.slug,
        name: c.name,
        score: Math.min(1, overlap + (interest ? 0.25 : 0)),
        matched: demand.filter(([id]) => have.has(id)).map(([id]) => ({ name: c.skills.get(id)!.name, source: have.get(id)!.source })),
        missing: demand.filter(([id]) => !have.has(id)).slice(0, 5).map(([, d]) => d.name),
        jobs: c.jobs.slice(0, 3),
        interest,
      };
    })
    .filter((r) => r.matched.length > 0 || r.interest)
    .sort((a, b) => b.score - a.score || b.matched.length - a.matched.length)
    .slice(0, limit);
}

export type Criterion = { key: string; en: string; ar: string; keywords: string[] };

/**
 * Transparent rule-based feedback for an exploratory task: which key points the response addresses.
 * Used when no AI provider is available, and always shown alongside AI feedback as the checklist.
 */
export function coverageFeedback(response: string, criteria: Criterion[]) {
  const text = ` ${response.toLowerCase().replace(/\s+/g, " ")} `;
  const covered = criteria.filter((c) => c.keywords.some((k) => text.includes(k.toLowerCase())));
  const missed = criteria.filter((c) => !covered.includes(c));
  return { covered: covered.map((c) => c.key), missed: missed.map((c) => c.key), words: response.trim().split(/\s+/).filter(Boolean).length };
}
