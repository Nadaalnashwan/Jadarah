/**
 * Practical assessment generation — deterministic synthetic data + quality validation (pure, unit-tested).
 * The AI proposes structure; these functions make the data reproducible and verify the draft before
 * a human reviewer sees it. Nothing here publishes anything.
 */

// ---------------------------------------------------------------- synthetic datasets
export type ColumnSpec = {
  name: string;
  type: "id" | "category" | "int" | "float" | "date" | "text";
  description?: string;
  prefix?: string;
  values?: string[];
  weights?: number[];
  min?: number;
  max?: number;
  decimals?: number;
  start?: string; // YYYY-MM-DD
  step_days?: number;
};
export type EffectSpec = { when_column: string; equals: string; target_column: string; multiply?: number; add?: number };
export type DatasetSpec = { file_name: string; purpose: string; rows: number; columns: ColumnSpec[]; effects?: EffectSpec[] };

function seedFrom(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic rows for a dataset spec (same spec + seed → same file). */
export function generateRows(spec: DatasetSpec, seed = "jadarah"): Record<string, string | number>[] {
  const rnd = mulberry32(seedFrom(`${seed}:${spec.file_name}`));
  const n = Math.max(1, Math.min(500, Math.round(spec.rows)));
  const rows: Record<string, string | number>[] = [];
  for (let i = 0; i < n; i++) {
    const row: Record<string, string | number> = {};
    for (const c of spec.columns) {
      switch (c.type) {
        case "id":
          row[c.name] = `${c.prefix ?? "R"}-${String(i + 1).padStart(4, "0")}`;
          break;
        case "category":
        case "text": {
          const vals = c.values?.length ? c.values : ["A", "B", "C"];
          const w = c.weights?.length === vals.length ? c.weights : vals.map(() => 1);
          const total = w.reduce((a, b) => a + b, 0);
          let r = rnd() * total;
          let k = 0;
          while (k < vals.length - 1 && (r -= w[k]) > 0) k++;
          row[c.name] = vals[k];
          break;
        }
        case "int":
          row[c.name] = Math.round((c.min ?? 0) + rnd() * ((c.max ?? 100) - (c.min ?? 0)));
          break;
        case "float": {
          const d = c.decimals ?? 2;
          row[c.name] = Number(((c.min ?? 0) + rnd() * ((c.max ?? 1) - (c.min ?? 0))).toFixed(d));
          break;
        }
        case "date": {
          const start = Date.parse(`${c.start ?? "2026-01-01"}T00:00:00Z`);
          row[c.name] = new Date(start + i * (c.step_days ?? 1) * 86400000).toISOString().slice(0, 10);
          break;
        }
      }
    }
    for (const e of spec.effects ?? []) {
      if (String(row[e.when_column]) === e.equals && typeof row[e.target_column] === "number") {
        const col = spec.columns.find((c) => c.name === e.target_column);
        const v = (row[e.target_column] as number) * (e.multiply ?? 1) + (e.add ?? 0);
        row[e.target_column] = col?.type === "int" ? Math.round(v) : Number(v.toFixed(col?.decimals ?? 2));
      }
    }
    rows.push(row);
  }
  return rows;
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(spec: DatasetSpec, rows: Record<string, string | number>[]) {
  const cols = spec.columns.map((c) => c.name);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c] ?? "")).join(","))].join("\n") + "\n";
}

/** Structural validation of a generated dataset against its spec. */
export function validateDataset(spec: DatasetSpec, rows: Record<string, string | number>[]): string[] {
  const issues: string[] = [];
  const names = spec.columns.map((c) => c.name);
  if (!/^[\w.-]+\.csv$/.test(spec.file_name)) issues.push(`${spec.file_name}: file name must be a simple .csv name`);
  if (new Set(names).size !== names.length) issues.push(`${spec.file_name}: duplicate column names`);
  if (spec.columns.length < 2) issues.push(`${spec.file_name}: needs at least 2 columns`);
  if (rows.length < 10) issues.push(`${spec.file_name}: too few rows (${rows.length})`);
  for (const c of spec.columns) {
    if ((c.type === "int" || c.type === "float") && rows.some((r) => typeof r[c.name] !== "number" || Number.isNaN(r[c.name])))
      issues.push(`${spec.file_name}.${c.name}: non-numeric values`);
    if ((c.type === "int" || c.type === "float") && c.min !== undefined && c.max !== undefined && c.min > c.max)
      issues.push(`${spec.file_name}.${c.name}: min > max`);
  }
  for (const e of spec.effects ?? []) {
    if (!names.includes(e.when_column) || !names.includes(e.target_column)) issues.push(`${spec.file_name}: effect refers to unknown column`);
    else if (!rows.some((r) => String(r[e.when_column]) === e.equals)) issues.push(`${spec.file_name}: effect condition "${e.equals}" never occurs`);
  }
  return issues;
}

// ---------------------------------------------------------------- draft validation
export type DraftTask = {
  title_en: string;
  instructions_en: string;
  instructions_ar?: string;
  inputs: string[];
  deliverables: { name: string; format: string; description?: string }[];
  time_minutes: number;
  skills: string[];
};
export type DraftCriterion = { key: string; criterion_en: string; max_points: number; expected_evidence: string; task_refs: number[] };
export type Draft = {
  scenario_en: string;
  scenario_ar?: string;
  duration_minutes: number;
  tasks: DraftTask[];
  datasets: DatasetSpec[];
  rubric: DraftCriterion[];
  assessor_guide?: { overview?: string; scoring_guidance?: string[] };
};
export type Check = { check: string; passed: boolean; detail: string };

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
/** Share of the candidate text's word n-grams that also occur in the source text. */
export function ngramOverlap(candidate: string, source: string, n = 8): number {
  const a = words(candidate);
  const b = words(source);
  if (a.length < n || b.length < n) return 0;
  const grams = new Set<string>();
  for (let i = 0; i + n <= b.length; i++) grams.add(b.slice(i, i + n).join(" "));
  let hit = 0;
  let total = 0;
  for (let i = 0; i + n <= a.length; i++) {
    total++;
    if (grams.has(a.slice(i, i + n).join(" "))) hit++;
  }
  return total ? hit / total : 0;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const LEGACY_BRAND = /\b(al)?midan\b|الميدان|ميدان/i;

export function validateDraft(opts: {
  draft: Draft;
  jobSkills: string[];
  referenceTexts: string[];
}): Check[] {
  const { draft: d } = opts;
  const checks: Check[] = [];
  const push = (check: string, passed: boolean, detail: string) => checks.push({ check, passed, detail });
  const datasetNames = new Set(d.datasets.map((x) => x.file_name));

  // job relevance / skill coverage
  const taskSkills = new Set(d.tasks.flatMap((t) => t.skills.map(norm)));
  const required = opts.jobSkills.map(norm).filter(Boolean);
  const covered = required.filter((s) => [...taskSkills].some((t) => t.includes(s) || s.includes(t)));
  const coverage = required.length ? covered.length / required.length : 1;
  push("skill_coverage", coverage >= 0.6, `${covered.length}/${required.length} required skills assessed`);

  // practical tasks with deliverables
  push("task_count", d.tasks.length >= 2 && d.tasks.length <= 6, `${d.tasks.length} tasks`);
  const noDeliv = d.tasks.filter((t) => !t.deliverables.length || t.deliverables.some((x) => !x.name || !x.format));
  push("deliverable_clarity", noDeliv.length === 0, noDeliv.length ? `tasks without clear deliverables: ${noDeliv.map((t) => t.title_en).join(", ")}` : "every task has named deliverables with formats");

  // time feasibility
  const sum = d.tasks.reduce((a, t) => a + (t.time_minutes || 0), 0);
  push("time_feasibility", d.duration_minutes >= 30 && d.duration_minutes <= 480 && sum <= d.duration_minutes * 1.1 && sum >= d.duration_minutes * 0.6, `tasks ${sum} min vs total ${d.duration_minutes} min`);

  // inputs available
  const missingInputs = d.tasks.flatMap((t) => t.inputs.filter((i) => i && !datasetNames.has(i)));
  push("input_availability", missingInputs.length === 0, missingInputs.length ? `missing inputs: ${[...new Set(missingInputs)].join(", ")}` : "all referenced inputs are provided");

  // rubric alignment + scoring consistency
  const uncoveredTasks = d.tasks.map((_, i) => i).filter((i) => !d.rubric.some((c) => c.task_refs.includes(i)));
  const orphanCriteria = d.rubric.filter((c) => !c.task_refs.length || c.task_refs.some((i) => i < 0 || i >= d.tasks.length));
  push("rubric_alignment", uncoveredTasks.length === 0 && orphanCriteria.length === 0 && d.rubric.length >= 3, `${d.rubric.length} criteria; uncovered tasks: ${uncoveredTasks.length}; orphan criteria: ${orphanCriteria.length}`);
  const badPoints = d.rubric.filter((c) => !(c.max_points >= 1 && c.max_points <= 10) || !c.expected_evidence?.trim());
  const keys = d.rubric.map((c) => c.key);
  push("scoring_consistency", badPoints.length === 0 && new Set(keys).size === keys.length, badPoints.length ? `criteria need 1–10 points and expected evidence: ${badPoints.map((c) => c.key).join(", ")}` : "points and evidence defined; keys unique");

  // originality vs references
  const candidateText = [d.scenario_en, ...d.tasks.map((t) => t.instructions_en)].join("\n");
  const maxOverlap = Math.max(0, ...opts.referenceTexts.map((r) => ngramOverlap(candidateText, r)));
  push("originality", maxOverlap < 0.12, `max 8-gram overlap with references ${(maxOverlap * 100).toFixed(1)}%`);

  // assessor leakage: any expected-evidence line or guidance note reproduced in candidate-facing text
  const candidateAll = [candidateText, d.scenario_ar ?? "", ...d.tasks.map((t) => t.instructions_ar ?? "")].join("\n");
  const assessorItems = [...d.rubric.map((c) => c.expected_evidence), ...(d.assessor_guide?.scoring_guidance ?? [])].filter(
    (x) => words(x ?? "").length >= 5,
  );
  const leaked = assessorItems.filter((x) => ngramOverlap(x, candidateAll, 5) >= 0.5);
  push("no_assessor_leakage", leaked.length === 0, leaked.length ? `${leaked.length} assessor item(s) appear in candidate text` : "candidate text contains no assessor material");

  // legacy branding
  const all = JSON.stringify(d);
  push("no_legacy_branding", !LEGACY_BRAND.test(all), LEGACY_BRAND.test(all) ? "legacy brand name found" : "clean");

  // datasets structurally valid
  const dataIssues = d.datasets.flatMap((s) => validateDataset(s, generateRows(s)));
  push("dataset_validity", dataIssues.length === 0, dataIssues.join("; ") || `${d.datasets.length} dataset(s) valid`);
  return checks;
}
