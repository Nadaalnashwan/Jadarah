export type RuleParsedCv = {
  full_name: null;
  email: string | null;
  phone: string | null;
  headline: null;
  summary: null;
  education: never[];
  experience: never[];
  skills: { name: string; evidence: string | null; kind: "explicit" }[];
  certifications: never[];
  projects: never[];
  languages: never[];
  method: "rule_based";
  provider: "rule_based";
};

/**
 * Pure (no AI, no server dependencies) — used by the app and by the offline evaluation (scripts/eval).
 * Deterministic fallback when no AI provider is configured: matches the platform skill taxonomy
 * (names + aliases) against the CV text and extracts contact details with regexes.
 * Results are labelled rule-based and must be reviewed by the candidate.
 */
export function parseCvRules(
  text: string,
  taxonomy: { name_en: string; aliases: string[]; slug: string }[],
): RuleParsedCv {
  const flat = text.replace(/\s+/g, " ");
  const lower = ` ${flat.toLowerCase()} `;
  const skills = taxonomy
    .map((s) => {
      // First matching term (name or alias) as a whole token; its position gives the evidence quote.
      let at = -1;
      let len = 0;
      for (const n of [s.name_en, ...s.aliases]) {
        if (n.length < 2) continue;
        const m = new RegExp(`[^a-z0-9+#]${escapeRe(n.toLowerCase())}[^a-z0-9+#]`).exec(lower);
        if (m && (at < 0 || m.index < at)) {
          at = m.index; // index in `lower` of the boundary char == index of the term in `flat`
          len = n.length;
        }
      }
      if (at < 0) return null;
      const evidence = flat.slice(Math.max(0, at - 40), at + len + 40).trim();
      return { name: s.name_en, evidence, kind: "explicit" as const };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
  const phone = text.match(/(\+?966|0)5\d{8}/)?.[0] ?? null;
  return {
    full_name: null,
    email,
    phone,
    headline: null,
    summary: null,
    education: [],
    experience: [],
    skills,
    certifications: [],
    projects: [],
    languages: [],
    method: "rule_based",
    provider: "rule_based",
  };
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
