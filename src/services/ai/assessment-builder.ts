import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  generateRows,
  toCsv,
  validateDraft,
  type Check,
  type Draft,
} from "@/lib/domain/assessment-quality";
import type { createClient } from "@/lib/supabase/server";
import { embedTexts, embeddingConfig, toPgVector } from "./embeddings";
import { generateJSON } from "./provider";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

// ---------------------------------------------------------------- inputs
export type JobInput = {
  job_id: string;
  title: string;
  seniority: string;
  description: string;
  responsibilities: string[];
  required_skills: string[];
  preferred_skills: string[];
  constraints: string;
  expected_outcomes: string;
  duration_minutes: number;
};

export type CompanyContext = { id: string; name_en: string; name_ar: string; sector_en: string | null; organization_type: string | null };

export function companySectorKey(sector?: string | null): string | null {
  const s = (sector ?? "").toLowerCase();
  if (/digital|telecom|artificial|data|software/.test(s)) return "digital";
  if (/financ|fund|bank/.test(s)) return "financial_services";
  if (/entertain|culture|event/.test(s)) return "culture_entertainment";
  if (/urban|heritage|construction|real estate/.test(s)) return "construction_real_estate";
  if (/petro|manufactur|industrial|chemical/.test(s)) return "manufacturing";
  if (/touris|coastal|hospitality/.test(s)) return "tourism_hospitality";
  if (/trade|retail|regulat/.test(s)) return "wholesale_retail";
  return null;
}

// ---------------------------------------------------------------- retrieval
export type RetrievedRef = {
  id: string;
  role_en: string;
  sector_key: string | null;
  seniority: string | null;
  validation_status: string;
  similarity: number;
  score: number;
  reason: string;
  scenario: string | null;
  instructions: string | null;
  objectives: string[];
  deliverables: { name: string; format?: string | null }[];
  input_assets: unknown;
  time_limit_minutes: number | null;
  skills: string[];
  rubric: { criterion: string; weight?: number | null; expected_evidence?: string | null }[];
};

const toks = (s: string) => new Set(s.toLowerCase().split(/[^\p{L}\p{N}+#]+/u).filter((w) => w.length > 2));

/**
 * Semantic retrieval + relevance re-ranking (embedding similarity is not enough): skill overlap and
 * sector fit are scored explicitly; unrelated sectors are kept only when the role is a close match.
 */
/** Retrieval outcome for monitoring: "failed" = embeddings unavailable; "none" = no candidate references matched. */
export type RetrievalMeta = { retrieval?: "ok" | "none" | "failed" };

export async function retrieveReferences(supabase: ServerSupabase, job: JobInput, company: CompanyContext, meta: RetrievalMeta = {}) {
  const cfg = embeddingConfig();
  const query = [`Role: ${job.title}`, `Seniority: ${job.seniority}`, `Sector: ${company.sector_en ?? ""}`, `Skills: ${[...job.required_skills, ...job.preferred_skills].join(", ")}`, job.description].join("\n");
  // Retrieval is an enhancement: if embeddings are unavailable (quota, overload, network), generation
  // still runs without reference examples instead of failing before any generation model is tried.
  let vec: number[];
  try {
    [vec] = await embedTexts([query], "SEMANTIC_SIMILARITY");
  } catch (e) {
    console.warn(`[ai] builder retrieval skipped: ${e instanceof Error ? e.message.slice(0, 80) : "embedding_failed"}`);
    meta.retrieval = "failed";
    return [];
  }
  meta.retrieval = "ok";
  const { data: matches } = await supabase.rpc("match_reference_assessments", { p_embedding: toPgVector(vec), p_model: cfg.model, p_limit: 10 });
  const ids = (matches ?? []).map((m) => m.reference_id);
  if (!ids.length) {
    meta.retrieval = "none";
    return [];
  }
  const [{ data: refs }, { data: rubrics }] = await Promise.all([
    supabase.from("reference_assessments").select("*").in("id", ids),
    supabase.rpc("reference_rubrics_for_builder", { p_ids: ids }),
  ]);
  const rubricBy = new Map((rubrics ?? []).map((r) => [r.reference_id, r.rubric as RetrievedRef["rubric"]]));
  const sector = companySectorKey(company.sector_en);
  const jobTokens = toks([job.title, ...job.required_skills, ...job.preferred_skills].join(" "));
  const scored = (refs ?? []).map((r) => {
    const sim = (matches ?? []).find((m) => m.reference_id === r.id)?.similarity ?? 0;
    const refTokens = toks([r.role_en, ...(r.skills ?? [])].join(" "));
    const overlap = [...jobTokens].filter((t) => refTokens.has(t)).length / Math.max(1, Math.min(jobTokens.size, 8));
    const sectorFit = sector && r.sector_key === sector ? 1 : 0;
    const roleFit = toks(r.role_en).size && [...toks(r.role_en)].every((t) => toks(job.title).has(t)) ? 1 : 0;
    const status = r.validation_status === "validated" ? 1 : r.validation_status === "needs_review" ? 0.6 : 0.3;
    const score = 0.5 * sim + 0.2 * Math.min(1, overlap) + 0.15 * sectorFit + 0.15 * roleFit;
    // Plain-language reasons (scores are stored separately for audit, not shown).
    const reasons = [
      roleFit ? "same role" : null,
      sectorFit ? "same sector" : null,
      overlap > 0 ? "shared skills" : null,
      !roleFit && !sectorFit && overlap === 0 ? "similar task structure" : null,
    ].filter(Boolean);
    return {
      id: r.id,
      role_en: r.role_en,
      sector_key: r.sector_key,
      seniority: r.seniority,
      validation_status: r.validation_status,
      similarity: sim,
      score: score * status,
      reason: reasons.join(" · "),
      scenario: r.scenario,
      instructions: r.instructions,
      objectives: r.objectives ?? [],
      deliverables: (r.deliverables as RetrievedRef["deliverables"]) ?? [],
      input_assets: r.input_assets,
      time_limit_minutes: r.time_limit_minutes,
      skills: r.skills ?? [],
      rubric: rubricBy.get(r.id) ?? [],
    } satisfies RetrievedRef;
  });
  // Keep relevant ones: same role/sector or clearly similar; at most 3.
  return scored
    .filter((r) => r.score >= 0.38 || r.reason.includes("same role"))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// ---------------------------------------------------------------- generation
const column = z.object({
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,40}$/),
  type: z.enum(["id", "category", "int", "float", "date", "text"]),
  description: z.string().max(200).optional(),
  prefix: z.string().max(6).optional(),
  values: z.array(z.string().max(60)).max(20).optional(),
  weights: z.array(z.number()).max(20).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  decimals: z.number().int().min(0).max(4).optional(),
  start: z.string().optional(),
  step_days: z.number().optional(),
});
const draftSchema = z.object({
  title_en: z.string().max(140),
  title_ar: z.string().max(140),
  scenario_en: z.string().max(2500),
  scenario_ar: z.string().max(2500),
  duration_minutes: z.number().int().min(30).max(480),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  skills_assessed: z.array(z.string()).max(12),
  tasks: z
    .array(
      z.object({
        kind: z.enum(["analysis", "coding", "sql", "design", "plan", "report", "model"]),
        title_en: z.string().max(140),
        title_ar: z.string().max(140),
        objective: z.string().max(400),
        instructions_en: z.string().max(2500),
        instructions_ar: z.string().max(2500),
        inputs: z.array(z.string()).max(4),
        expected_output: z.string().max(500),
        deliverables: z.array(z.object({ name: z.string().max(120), format: z.string().max(40), description: z.string().max(300).optional() })).min(1).max(4),
        constraints: z.array(z.string().max(200)).max(6),
        time_minutes: z.number().int().min(5).max(300),
        skills: z.array(z.string()).max(8),
      }),
    )
    .min(2)
    .max(5),
  datasets: z
    .array(
      z.object({
        file_name: z.string().regex(/^[\w.-]+\.csv$/),
        purpose: z.string().max(300),
        rows: z.number().int().min(10).max(400),
        columns: z.array(column).min(2).max(12),
        effects: z.array(z.object({ when_column: z.string(), equals: z.string(), target_column: z.string(), multiply: z.number().optional(), add: z.number().optional() })).max(5).optional(),
      }),
    )
    .max(3),
  rubric: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
        criterion_en: z.string().max(80),
        criterion_ar: z.string().max(80),
        description: z.string().max(300),
        max_points: z.number().int().min(1).max(10),
        expected_evidence: z.string().max(400),
        levels: z.object({ strong: z.string().max(250), adequate: z.string().max(250), weak: z.string().max(250) }),
        task_refs: z.array(z.number().int().min(0)).min(1),
      }),
    )
    .min(3)
    .max(8),
  assessor_guide: z.object({
    overview: z.string().max(1200),
    scoring_guidance: z.array(z.string().max(400)).max(10),
    red_flags: z.array(z.string().max(250)).max(6),
    reference_logic: z.string().max(600),
  }),
});
export type GeneratedDraft = z.infer<typeof draftSchema>;

function abridge(r: RetrievedRef) {
  return {
    role: r.role_en,
    sector: r.sector_key,
    seniority: r.seniority,
    scenario: (r.scenario ?? r.instructions ?? "").slice(0, 900),
    objectives: r.objectives.slice(0, 5),
    deliverables: r.deliverables.slice(0, 5).map((d) => `${d.name}${d.format ? ` (${d.format})` : ""}`),
    time_limit_minutes: r.time_limit_minutes,
    input_data_structure: JSON.stringify(r.input_assets).slice(0, 600),
    rubric_structure: r.rubric.slice(0, 8).map((c) => ({ criterion: c.criterion, weight: c.weight ?? null })),
  };
}

const SYSTEM = (company: CompanyContext) => `You design NEW practical, job-specific hiring assessments for JADARAH.
Organization context (identity only): ${company.name_en} — ${company.organization_type ?? "organization"} in ${company.sector_en ?? "its sector"}.
Rules:
- Produce realistic WORK SAMPLES with concrete deliverables (working code, a validated analysis, a model, a schedule, a financial model, an operational plan, a structured recommendation) — never generic interview questions.
- Learn structure, rigor and scoring style from the REFERENCE EXAMPLES, but NEVER reuse their scenario, wording, fictional names or data. Write everything fresh.
- The scenario is a SIMULATION inspired by the organization's sector. Never state or imply real internal policies, systems, customers, transactions or confidential facts of the organization. Use synthetic data only.
- Tasks must be feasible in the time limit; task times should add up to about the total duration.
- Every dataset a task needs must be specified in "datasets" (synthetic column generators + planted patterns via "effects" so the data actually supports the task). Task "inputs" must use exact dataset file names. Keep personal data out.
- The rubric must be measurable, aligned to the tasks (task_refs are 0-based task indexes) and cover every task.
- Assessor guidance stays in rubric/assessor_guide; candidate-facing text (scenario, instructions) must not reveal expected answers.
- Bilingual: English and Modern Standard Arabic. No author or platform brand names other than JADARAH.`;

export async function generateAssessmentDraft(opts: {
  userId: string;
  company: CompanyContext;
  job: JobInput;
  references: RetrievedRef[];
  repairOf?: { draft: GeneratedDraft; issues: string[] };
  focusSection?: "scenario" | "tasks" | "rubric" | "data";
}) {
  const { job, references } = opts;
  const prompt = [
    `JOB: ${JSON.stringify({
      title: job.title,
      seniority: job.seniority,
      description: job.description.slice(0, 1500),
      responsibilities: job.responsibilities.slice(0, 8),
      required_skills: job.required_skills,
      preferred_skills: job.preferred_skills,
      constraints: job.constraints.slice(0, 800),
      expected_outcomes: job.expected_outcomes.slice(0, 800),
      total_duration_minutes: job.duration_minutes,
    })}`,
    `REFERENCE EXAMPLES (structure only — do not copy): ${JSON.stringify(references.map(abridge))}`,
    opts.repairOf
      ? `CURRENT DRAFT: ${JSON.stringify(opts.repairOf.draft)}\nFIX THESE ISSUES${opts.focusSection ? ` (regenerate the ${opts.focusSection} section; keep the rest consistent)` : ""}: ${opts.repairOf.issues.join(" | ")}`
      : "Return a complete new assessment.",
  ].join("\n\n");
  return generateJSON(
    { operation: "assessment_builder", userId: opts.userId, system: SYSTEM(opts.company), prompt, timeoutMs: 90_000 },
    draftSchema,
  );
}

export function toQualityDraft(d: GeneratedDraft): Draft {
  return {
    scenario_en: d.scenario_en,
    scenario_ar: d.scenario_ar,
    duration_minutes: d.duration_minutes,
    tasks: d.tasks.map((t) => ({ title_en: t.title_en, instructions_en: t.instructions_en, instructions_ar: t.instructions_ar, inputs: t.inputs, deliverables: t.deliverables, time_minutes: t.time_minutes, skills: t.skills })),
    datasets: d.datasets,
    rubric: d.rubric.map((c) => ({ key: c.key, criterion_en: c.criterion_en, max_points: c.max_points, expected_evidence: c.expected_evidence, task_refs: c.task_refs })),
    assessor_guide: { overview: d.assessor_guide.overview, scoring_guidance: d.assessor_guide.scoring_guidance },
  };
}

export function runValidation(d: GeneratedDraft, job: JobInput, references: RetrievedRef[]): Check[] {
  return validateDraft({
    draft: toQualityDraft(d),
    jobSkills: job.required_skills,
    referenceTexts: references.map((r) => [r.scenario, r.instructions, ...r.objectives].filter(Boolean).join("\n")),
  });
}

/** Generate, validate and (once) repair. Returns the best draft and its checks. */
export async function buildAssessment(opts: { userId: string; company: CompanyContext; job: JobInput; references: RetrievedRef[] }) {
  let res = await generateAssessmentDraft(opts);
  let checks = runValidation(res.data, opts.job, opts.references);
  const failed = checks.filter((c) => !c.passed);
  const repair = { attempted: false, accepted: false, initial_failed: failed.length };
  if (failed.length) {
    repair.attempted = true;
    const repaired = await generateAssessmentDraft({ ...opts, repairOf: { draft: res.data, issues: failed.map((c) => `${c.check}: ${c.detail}`) } }).catch(() => null);
    if (repaired) {
      const rc = runValidation(repaired.data, opts.job, opts.references);
      if (rc.filter((c) => !c.passed).length <= failed.length) {
        res = repaired;
        checks = rc;
        repair.accepted = true;
      }
    }
  }
  return { draft: res.data, checks, provider: res.provider, model: res.model, repair };
}

// ---------------------------------------------------------------- persistence
const QTYPE: Record<GeneratedDraft["tasks"][number]["kind"], "coding" | "sql" | "case_study"> = {
  coding: "coding",
  sql: "sql",
  analysis: "case_study",
  design: "case_study",
  plan: "case_study",
  report: "case_study",
  model: "case_study",
};

function taskPrompt(t: GeneratedDraft["tasks"][number], lang: "en" | "ar") {
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  return [
    lang === "ar" ? t.instructions_ar : t.instructions_en,
    t.inputs.length ? `${L("Input files", "ملفات الإدخال")}: ${t.inputs.join(", ")}` : null,
    `${L("Deliverables", "المخرجات")}:\n${t.deliverables.map((d) => `• ${d.name} (${d.format})${d.description ? ` — ${d.description}` : ""}`).join("\n")}`,
    t.constraints.length ? `${L("Constraints", "القيود")}:\n${t.constraints.map((c) => `• ${c}`).join("\n")}` : null,
    `${L("Suggested time", "الوقت المقترح")}: ${t.time_minutes} ${L("min", "دقيقة")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Write (or rewrite) all derived parts of a DRAFT assessment from a generated draft. */
export async function applyDraft(supabase: ServerSupabase, assessmentId: string, companyId: string, d: GeneratedDraft) {
  const { data: a } = await supabase.from("assessments").select("status").eq("id", assessmentId).single();
  if (a?.status !== "draft") throw new Error("only drafts can be changed");
  await supabase
    .from("assessments")
    .update({ title_en: d.title_en, title_ar: d.title_ar, description_en: d.scenario_en, description_ar: d.scenario_ar, duration_minutes: d.duration_minutes, difficulty: d.difficulty, learning_outcomes_en: d.skills_assessed, ai_generated: true })
    .eq("id", assessmentId);
  // rubric (candidate-safe criteria only; expected evidence lives in the assessor guide)
  const criteria = d.rubric.map((c) => ({ key: c.key, name_en: c.criterion_en, name_ar: c.criterion_ar, description_en: c.description, description_ar: "", max_points: c.max_points }));
  const { data: rub } = await supabase.from("assessment_rubrics").select("id").eq("assessment_id", assessmentId).limit(1).maybeSingle();
  const rubricId = rub
    ? (await supabase.from("assessment_rubrics").update({ criteria }).eq("id", rub.id).select("id").single()).data!.id
    : (await supabase.from("assessment_rubrics").insert({ assessment_id: assessmentId, title_en: "Practical rubric", title_ar: "معايير التقييم العملي", criteria }).select("id").single()).data!.id;
  // tasks → questions
  await supabase.from("assessment_questions").delete().eq("assessment_id", assessmentId);
  const pts = d.tasks.map((_, i) =>
    Math.max(1, Math.round(d.rubric.reduce((s, c) => s + (c.task_refs.includes(i) ? c.max_points / c.task_refs.length : 0), 0))),
  );
  const { error: qErr } = await supabase.from("assessment_questions").insert(
    d.tasks.map((t, i) => ({
      assessment_id: assessmentId,
      type: QTYPE[t.kind],
      prompt_en: `${t.title_en}\n\n${taskPrompt(t, "en")}`,
      prompt_ar: `${t.title_ar}\n\n${taskPrompt(t, "ar")}`,
      points: pts[i],
      position: i,
      rubric_id: rubricId,
      config: { practical: true, kind: t.kind, deliverables: t.deliverables, inputs: t.inputs, time_minutes: t.time_minutes, skills: t.skills, objective: t.objective },
    })),
  );
  if (qErr) throw qErr;
  // assessor-only guide
  await supabase.from("assessment_assessor_guides").upsert({
    assessment_id: assessmentId,
    company_id: companyId,
    guide: { rubric: d.rubric, ...d.assessor_guide, task_expected_outputs: d.tasks.map((t) => ({ task: t.title_en, expected_output: t.expected_output })) },
    updated_at: new Date().toISOString(),
  });
  // candidate datasets (deterministic synthetic CSVs)
  const { data: old } = await supabase.from("assessment_materials").select("id, storage_path").eq("assessment_id", assessmentId).eq("audience", "candidate");
  if (old?.length) {
    await supabase.storage.from("assessment-materials").remove(old.map((o) => o.storage_path));
    await supabase.from("assessment_materials").delete().in("id", old.map((o) => o.id));
  }
  for (const spec of d.datasets) {
    const rows = generateRows(spec, assessmentId);
    const csv = toCsv(spec, rows);
    const path = `${assessmentId}/candidate/${spec.file_name}`;
    const { error: upErr } = await supabase.storage.from("assessment-materials").upload(path, new Blob([csv], { type: "text/csv" }), { contentType: "text/csv" });
    if (upErr) throw upErr;
    await supabase.from("assessment_materials").insert({
      assessment_id: assessmentId,
      company_id: companyId,
      audience: "candidate",
      file_name: spec.file_name,
      storage_path: path,
      mime_type: "text/csv",
      description: spec.purpose,
      rows: rows.length,
      columns: spec.columns.map((c) => c.name),
      sha256: createHash("sha256").update(csv).digest("hex"),
    });
  }
}
