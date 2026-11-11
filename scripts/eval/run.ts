/**
 * Offline evaluation (no AI calls, no database). Run: npm run eval:offline
 *
 * Measures the deterministic, rule-based CV skill extraction (the fallback used when no AI provider is configured)
 * against a small hand-labelled synthetic benchmark, and writes the results the Super Admin Evaluation tab shows.
 * AI-based extraction and semantic matching are NOT evaluated here: they need live provider calls and a larger
 * labelled benchmark, so the dashboard reports them as "Not evaluated".
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCvRules } from "../../src/lib/domain/cv-rules";
import { parsedCvSchemaShape } from "../../src/services/ai/cv-schema";

const here = dirname(fileURLToPath(import.meta.url));
const taxonomy = JSON.parse(readFileSync(join(here, "fixtures/skills.json"), "utf8")) as {
  slug: string;
  name_en: string;
  aliases: string[];
}[];
const bench = JSON.parse(readFileSync(join(here, "fixtures/cv-skills.json"), "utf8")) as {
  name: string;
  description: string;
  labelled_by: string;
  cases: { id: string; text: string; expected: string[] }[];
};

const known = new Set(taxonomy.map((t) => t.name_en));
for (const c of bench.cases)
  for (const e of c.expected)
    if (!known.has(e)) throw new Error(`${c.id}: label "${e}" is not in the taxonomy`);

let tp = 0;
let fp = 0;
let fn = 0;
let evidenceTotal = 0;
let evidenceValid = 0;
let schemaValid = 0;
let negationCases = 0;
let negationFalsePositives = 0;
const perCase: { id: string; tp: number; fp: string[]; fn: string[] }[] = [];
const flat = (s: string) => s.replace(/\s+/g, " ");

for (const c of bench.cases) {
  const out = parseCvRules(c.text, taxonomy);
  if (parsedCvSchemaShape.safeParse(out).success) schemaValid += 1;
  const got = new Set(out.skills.map((s) => s.name));
  const exp = new Set(c.expected);
  const caseFp = [...got].filter((g) => !exp.has(g));
  const caseFn = [...exp].filter((e) => !got.has(e));
  tp += [...got].filter((g) => exp.has(g)).length;
  fp += caseFp.length;
  fn += caseFn.length;
  for (const s of out.skills) {
    evidenceTotal += 1;
    if (s.evidence && flat(c.text).includes(s.evidence)) evidenceValid += 1;
  }
  if (/\b(no experience|not familiar|do not|don't|never used)\b/i.test(c.text)) {
    negationCases += 1;
    if (caseFp.length) negationFalsePositives += 1;
  }
  perCase.push({ id: c.id, tp: c.expected.length - caseFn.length, fp: caseFp, fn: caseFn });
}

const precision = tp + fp ? tp / (tp + fp) : null;
const recall = tp + fn ? tp / (tp + fn) : null;
const f1 =
  precision !== null && recall !== null && precision + recall
    ? (2 * precision * recall) / (precision + recall)
    : null;

const results = {
  generated_at: new Date().toISOString(),
  evaluations: [
    {
      key: "cv_skill_extraction_rule_based",
      title_en: "CV skill extraction — rule-based fallback",
      title_ar: "استخراج المهارات من السيرة — الوضع القائم على القواعد",
      model: "rule_based (taxonomy name + alias matching; no AI)",
      dataset: {
        name: bench.name,
        cases: bench.cases.length,
        labelled_skills: tp + fn,
        description: bench.description,
        labelled_by: bench.labelled_by,
      },
      metrics: {
        precision,
        recall,
        f1,
        unsupported_claims: fp,
        evidence_quote_validity: evidenceTotal ? evidenceValid / evidenceTotal : null,
        schema_validity: schemaValid / bench.cases.length,
        negation_cases: negationCases,
        negation_cases_with_false_positive: negationFalsePositives,
      },
      definitions_en: [
        "Precision = correctly extracted skills / all extracted skills (micro-averaged over every case).",
        "Recall = correctly extracted skills / all labelled skills.",
        "Unsupported claims = extracted skills the label set does not contain (false positives).",
        "Evidence validity = extracted quotes that appear verbatim in the CV text.",
        "Schema validity = outputs that parse against the CV extraction schema.",
      ],
      methodology_en:
        "Each synthetic CV excerpt is run through the same rule-based extractor the app uses. Outputs are compared with hand labels by exact taxonomy skill name.",
      limitations_en: [
        "Small synthetic benchmark (20 English excerpts) labelled by one annotator — not representative of real CVs, Arabic CVs or PDF parsing errors.",
        "Rule matching cannot understand negation or context; such cases are included on purpose.",
        "Results describe extraction only; they say nothing about candidate competence.",
      ],
      per_case: perCase,
    },
  ],
};

const outFile = join(here, "../../src/data/evaluation/results.json");
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(results, null, 2)}\n`);
const p = (v: number | null) => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);
console.log(
  `cases=${bench.cases.length} precision=${p(precision)} recall=${p(recall)} f1=${p(f1)} fp=${fp} fn=${fn} evidence=${p(results.evaluations[0].metrics.evidence_quote_validity)} negationFP=${negationFalsePositives}/${negationCases}`,
);
console.log(`wrote ${outFile}`);
