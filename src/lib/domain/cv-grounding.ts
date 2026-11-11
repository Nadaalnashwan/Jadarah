/**
 * Grounding of extracted CV data against the CV's own text, so nothing that is not in the document is presented
 * as if it were. Each item is marked found / not found; evidence quotes that do not occur in the CV are dropped
 * (never shown as a quote), and a "stated" skill whose name and quote are both absent is downgraded to "inferred".
 * When the document has no text layer (e.g. a scanned PDF read by a vision model) grounding is not possible and
 * `checked` is false — the review screen then asks the candidate to check every item.
 */
export type CvGrounding = {
  checked: boolean;
  full_name: boolean;
  headline: boolean;
  experience: boolean[];
  education: boolean[];
  projects: boolean[];
  certifications: boolean[];
  languages: boolean[];
  skills: boolean[];
};

type Extracted = {
  full_name?: string | null;
  headline?: string | null;
  experience: { title: string; company: string }[];
  education: { institution: string; degree: string }[];
  projects: { title: string }[];
  certifications: string[];
  languages: string[];
  skills: { name: string; evidence?: string | null; kind: "explicit" | "inferred" }[];
};

/** Lower-case, strip Arabic diacritics/tatweel, unify alef/yaa/taa marbuta forms, collapse punctuation + spaces. */
export function normalizeForMatch(s: string): string {
  return ` ${s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}+#]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

const LANGUAGE_ALIASES: Record<string, string[]> = {
  arabic: ["arabic", "العربيه", "عربي", "اللغه العربيه"],
  english: ["english", "الانجليزيه", "الانكليزيه", "انجليزي", "اللغه الانجليزيه"],
  french: ["french", "الفرنسيه", "فرنسي"],
  german: ["german", "الالمانيه", "الماني"],
  spanish: ["spanish", "الاسبانيه", "اسباني"],
  urdu: ["urdu", "الاورديه", "اوردو"],
  hindi: ["hindi", "الهنديه", "هندي"],
  chinese: ["chinese", "mandarin", "الصينيه", "صيني"],
  turkish: ["turkish", "التركيه", "تركي"],
};

export function groundCv<T extends Extracted>(parsed: T, sourceText: string): { parsed: T; grounding: CvGrounding } {
  const hay = normalizeForMatch(sourceText);
  const checked = hay.trim().length >= 40;
  const has = (needle: string | null | undefined) => {
    const n = normalizeForMatch(needle ?? "").trim();
    return n.length > 0 && hay.includes(` ${n} `);
  };
  // Quotes may start/end mid-word (fixed-width snippets): a long enough quote only has to occur as a substring.
  const hasQuote = (quote: string | null | undefined) => {
    const n = normalizeForMatch(quote ?? "").trim();
    return n.length >= 12 ? hay.includes(n) : has(quote);
  };
  const ok = (v: boolean) => (checked ? v : false);

  const skills = parsed.skills.map((s) => {
    if (!checked) return { skill: s, found: false };
    const quoteFound = !!s.evidence && hasQuote(s.evidence);
    const nameFound = has(s.name);
    const evidence = quoteFound ? s.evidence : null;
    const kind: "explicit" | "inferred" = s.kind === "explicit" && (quoteFound || nameFound) ? "explicit" : "inferred";
    return { skill: { ...s, evidence, kind }, found: quoteFound || nameFound };
  });

  const langFound = (l: string) => {
    if (has(l)) return true;
    const key = normalizeForMatch(l).trim();
    const group = Object.values(LANGUAGE_ALIASES).find((g) => g.includes(key));
    return !!group && group.some((alias) => has(alias));
  };

  return {
    parsed: { ...parsed, skills: skills.map((x) => x.skill) },
    grounding: {
      checked,
      full_name: ok(has(parsed.full_name)),
      headline: ok(has(parsed.headline)),
      // The employer is the fact that matters: a role is "found" only when its organization appears in the CV.
      experience: parsed.experience.map((e) => ok(has(e.company))),
      education: parsed.education.map((e) => ok(has(e.institution))),
      projects: parsed.projects.map((p) => ok(has(p.title))),
      certifications: parsed.certifications.map((c) => ok(has(c))),
      languages: parsed.languages.map((l) => ok(langFound(l))),
      skills: skills.map((x) => ok(x.found)),
    },
  };
}

/** True when the extraction produced nothing the candidate could review. */
export function isEmptyExtraction(p: Extracted & { summary?: string | null }): boolean {
  return (
    !p.full_name &&
    !p.headline &&
    !p.summary &&
    !p.experience.length &&
    !p.education.length &&
    !p.projects.length &&
    !p.certifications.length &&
    !p.languages.length &&
    !p.skills.length
  );
}
