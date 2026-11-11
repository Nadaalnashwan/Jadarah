/**
 * Assessment Reference Library import (idempotent; untrusted package data is parsed, never executed).
 *   npx tsx scripts/import/import-references.ts "<extracted package dir>" [--only <ref_key>] [--skip-upload]
 *
 * 1. Groups candidate/assessor folders into reference packages (stable ref_key).
 * 2. Extracts text: PDFs (text layer; image-only PDFs → Gemini document vision, cached), MD/TXT,
 *    CSV/XLSX structure summaries (sheets, columns, row counts, samples), rubric workbooks.
 * 3. Normalizes each package into a structured reference with Gemini (schema-validated). Missing
 *    information is reported, never invented. Legacy MIDAN branding is removed from normalized text.
 * 4. Stores originals privately (bucket reference-library, Super Admin only) for provenance.
 * 5. Upserts reference_assessments (+ confidential reference_assessment_assessor), validation status,
 *    embeddings (gemini-embedding-2 @768) and the 7 sector skills dictionaries.
 * Service-role key (scripts only). Prints no secrets or confidential content.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import type { Database } from "../../src/types/database";
import { contentHash, embedTexts, embeddingConfig, toPgVector } from "../../src/services/ai/embeddings-core";
import { readXlsx } from "./xlsx";

config({ path: ".env.local", quiet: true });
const root = process.argv[2];
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const skipUpload = process.argv.includes("--skip-upload");
const CACHE = join(root, "..", "extract-cache");
mkdirSync(CACHE, { recursive: true });

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const debrand = (s: string) =>
  s
    .replace(/\b(AL)?MIDAN\b/gi, "")
    .replace(/الميدان|ميدان/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

/** Stable package key from a folder name (strip legacy prefixes, copies and versions). */
function refKey(folder: string) {
  // Assessor-only guides (Midan_*_Assessor_Guide_*) are separate packages from same-named role packages.
  const guide = /^Midan_.*_Assessor_Guide_/i.test(folder) ? "_guide" : "";
  return folder
    .replace(/\(\d+\)/g, "")
    .replace(/^MIDAN_Group3_/i, "")
    .replace(/^Midan_/i, "")
    .replace(/_Assessment_Package_v[\d.]+/i, "")
    .replace(/_Assessor_Guide_(Green|Revised)$/i, "")
    .replace(/_Assessment_Simple$/i, "")
    .replace(/^\d+_/, "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase() + guide;
}

const SECTOR: Record<string, string> = {
  event_coordinator: "culture_entertainment",
  event_marketing_specialist: "culture_entertainment",
  content_producer: "culture_entertainment",
  reservations_agent: "tourism_hospitality",
  tour_coordinator: "tourism_hospitality",
  guest_experience_specialist: "tourism_hospitality",
  data_analyst: "digital",
  ml_engineer: "digital",
  swe: "digital",
  swe_assessment_simple: "digital", // stable key of the "SWE_Assessment_Simple (1)" folder
  ui_ux_designer: "digital",
  civil_engineer: "construction_real_estate",
  project_planner: "construction_real_estate",
  real_estate_analyst: "construction_real_estate",
  production_engineer: "manufacturing",
  quality_engineer: "manufacturing",
  maintenance_engineer: "manufacturing",
  accountant: "financial_services",
  credit_analyst: "financial_services",
  financial_analyst: "financial_services",
  consumer_protection: "wholesale_retail",
  trade_compliance: "wholesale_retail",
};

// ---------------------------------------------------------------- extraction
async function geminiCall(body: unknown, model: string, timeoutMs = 120_000) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`gemini_http_${res.status}`);
  const j = await res.json();
  const out = (j?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  // An empty 200 response happens intermittently — treat it as a failure so it is retried.
  if (!out.trim()) throw new Error("gemini_empty");
  return out;
}
async function gemini(body: unknown) {
  const models = [process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash", process.env.GEMINI_MODEL || "gemini-3.8-flash"];
  let last: unknown;
  for (const m of models)
    for (let i = 0; i < 2; i++)
      try {
        return { text: await geminiCall(body, m), model: m };
      } catch (e) {
        last = e;
        const rate = e instanceof Error && /429/.test(e.message);
        await new Promise((r) => setTimeout(r, rate ? 35_000 : 3_000));
      }
  throw last;
}

async function pdfText(file: string): Promise<{ text: string; method: "text" | "vision" }> {
  const buf = readFileSync(file);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  const t = (Array.isArray(text) ? text.join("\n") : text).trim();
  // Some PDFs carry Arabic as presentation forms in visual (reversed) order — unreadable as text.
  const presentation = (t.match(/[\uFB50-\uFDFF\uFE70-\uFEFF]/g) ?? []).length;
  const garbled = presentation > t.replace(/\s+/g, "").length * 0.05;
  if (t.replace(/\s+/g, "").length > 200 && !garbled) return { text: t, method: "text" };
  // Image-only (scanned) PDF → document vision transcription, cached by content hash.
  const cache = join(CACHE, `${sha(buf)}.vision.txt`);
  if (existsSync(cache)) return { text: readFileSync(cache, "utf8"), method: "vision" };
  const { text: out } = await gemini({
    contents: [
      {
        role: "user",
        parts: [
          { text: "Transcribe this document faithfully in its original language(s). Preserve headings, numbered lists and tables (as Markdown). Do not summarise, translate or add anything." },
          { inline_data: { mime_type: "application/pdf", data: buf.toString("base64") } },
        ],
      },
    ],
    generationConfig: { temperature: 0, thinkingConfig: { thinkingLevel: "low" } },
  });
  if (out.replace(/\s+/g, "").length < 200) throw new Error(`vision extraction too short for ${basename(file)}`);
  writeFileSync(cache, out);
  return { text: out, method: "vision" };
}

async function describeData(file: string) {
  if (file.endsWith(".csv")) {
    const lines = readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
    return { file: basename(file), kind: "csv", columns: lines[0]?.split(","), rows: lines.length - 1, sample: lines.slice(1, 4) };
  }
  const sheets = await readXlsx(file);
  return {
    file: basename(file),
    kind: "xlsx",
    sheets: sheets.map((s) => ({ name: s.name, columns: s.rows[0], rows: Math.max(0, s.rows.length - 1), sample: s.rows.slice(1, 4) })),
  };
}

// ---------------------------------------------------------------- normalization
const crit = z.object({
  criterion: z.string(),
  description: z.string().nullable().optional(),
  weight: z.number().nullable().optional(),
  expected_evidence: z.string().nullable().optional(),
});
const normSchema = z.object({
  role_en: z.string(),
  role_ar: z.string().nullable().optional(),
  seniority: z.string().nullable().optional(),
  skills: z.array(z.string()).default([]),
  scenario: z.string().nullable().optional(),
  objectives: z.array(z.string()).default([]),
  instructions: z.string().nullable().optional(),
  deliverables: z.array(z.object({ name: z.string(), format: z.string().nullable().optional(), description: z.string().nullable().optional() })).default([]),
  time_limit_minutes: z.number().nullable().optional(),
  tools: z.array(z.string()).default([]),
  rubric: z.array(crit).default([]),
  assessor_guidance: z.string().nullable().optional(),
  answer_expectations: z.string().nullable().optional(),
  missing: z.array(z.string()).default([]),
});
type Norm = z.infer<typeof normSchema>;

async function groqJson(system: string, user: string, schema: unknown): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      reasoning_effort: "medium",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name: "reference", schema, strict: false } },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`groq_http_${res.status}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

async function normalize(key: string, candidateText: string, assessorText: string, data: unknown[]): Promise<{ norm: Norm; model: string }> {
  const cachePath = join(CACHE, `${key}.${sha(Buffer.from(candidateText + assessorText + JSON.stringify(data))).slice(0, 16)}.norm.json`);
  if (existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, "utf8"));
  const schema = z.toJSONSchema(normSchema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete schema.$schema;
  const system = `You normalise a practical hiring-assessment package into structured data for a reference library.
Rules: use ONLY the provided material. Never invent requirements, weights, time limits or answers — use null/empty and list each gap in "missing".
Candidate-facing fields (scenario, objectives, instructions, deliverables, time limit, tools, skills) come from CANDIDATE MATERIAL only.
Assessor fields (rubric, assessor_guidance, answer_expectations) come from ASSESSOR MATERIAL only; summarise guidance faithfully and concisely.
Remove any organisation/brand names of the package author (e.g. MIDAN, ALMIDAN, الميدان); keep fictional scenario organisations only if essential, otherwise say "the organisation".
Keep the original language of the content (Arabic stays Arabic). role_en must be English. Weights as numbers (percent or points) exactly as given.`;
  const user = `PACKAGE: ${key}\n\n=== CANDIDATE MATERIAL ===\n${candidateText.slice(0, 30000) || "(none in package)"}\n\n=== INPUT DATA FILES (structure) ===\n${JSON.stringify(data).slice(0, 8000)}\n\n=== ASSESSOR MATERIAL ===\n${assessorText.slice(0, 30000) || "(none in package)"}`;
  let text = "";
  let model = "";
  try {
    model = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash";
    text = await geminiCall(
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0.1, thinkingConfig: { thinkingLevel: "low" } },
      },
      model,
      90_000,
    );
    normSchema.parse(JSON.parse(text));
  } catch {
    try {
      const r = await gemini({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0.1, thinkingConfig: { thinkingLevel: "low" } },
      });
      text = r.text;
      model = r.model;
      normSchema.parse(JSON.parse(text));
    } catch (e) {
      if (user.length > 14_000) throw e; // too large for the Groq request limit
      model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
      text = await groqJson(system, user, schema);
    }
  }
  const norm = normSchema.parse(JSON.parse(text));
  writeFileSync(cachePath, JSON.stringify({ norm, model }));
  return { norm, model };
}

// ---------------------------------------------------------------- main
(async () => {
  const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const files = walk(root).map((f) => relative(root, f));
  const groups = new Map<string, { candidate: string[]; assessor: string[] }>();
  for (const f of files) {
    const [top, folder] = f.split("/");
    if (top !== "01_Candidate_Materials" && top !== "02_Assessor_Confidential") continue;
    const key = refKey(folder);
    const g = groups.get(key) ?? { candidate: [], assessor: [] };
    (top === "01_Candidate_Materials" ? g.candidate : g.assessor).push(f);
    groups.set(key, g);
  }
  console.log(`packages=${groups.size}`);
  const report: string[] = [];
  const toEmbed: { id: string; text: string }[] = [];

  const work = [...groups].sort().filter(([key]) => !only || key === only);
  const processOne = async ([key, g]: [string, { candidate: string[]; assessor: string[] }]) => {
    try {
      const sources: { path: string; sha256: string; audience: string; extraction: string }[] = [];
      let candidateText = "";
      let assessorText = "";
      const data: unknown[] = [];
      for (const [aud, list] of [["candidate", g.candidate], ["assessor", g.assessor]] as const) {
        for (const f of list.sort()) {
          const abs = join(root, f);
          const buf = readFileSync(abs);
          let extraction = "none";
          let text = "";
          if (f.endsWith(".pdf")) {
            const r = await pdfText(abs);
            text = r.text;
            extraction = r.method;
          } else if (/\.(md|txt)$/i.test(f)) {
            text = readFileSync(abs, "utf8");
            extraction = "text";
          } else if (/\.(csv|xlsx)$/i.test(f)) {
            const d = await describeData(abs);
            extraction = "structure";
            if (aud === "candidate") data.push(d);
            else text = `RUBRIC WORKBOOK ${basename(f)}:\n` + JSON.stringify(await readXlsx(abs)).slice(0, 12000);
          }
          if (aud === "candidate") candidateText += `\n--- ${basename(f)} ---\n${text}`;
          else assessorText += `\n--- ${basename(f)} ---\n${text}`;
          sources.push({ path: f, sha256: sha(buf), audience: aud, extraction });
          if (!skipUpload) {
            const storagePath = `${key}/${aud}/${sha(buf).slice(0, 12)}-${basename(f).replace(/[^\w.\-]+/g, "_")}`;
            await db.storage.from("reference-library").upload(storagePath, buf, { upsert: true, contentType: f.endsWith(".pdf") ? "application/pdf" : "application/octet-stream" });
          }
        }
      }
      const { norm, model } = await normalize(key, candidateText, assessorText, data);
      const hasCandidate = g.candidate.length > 0;
      const completeness = hasCandidate && g.assessor.length ? "complete" : hasCandidate ? "candidate_only" : "assessor_only";
      const gaps = [...norm.missing];
      if (!norm.scenario && !norm.instructions) gaps.push("no task scenario/instructions");
      if (!norm.deliverables.length) gaps.push("no deliverables");
      if (!norm.rubric.length) gaps.push("no rubric");
      const validation_status =
        completeness !== "complete" ? "incomplete" : norm.rubric.length && norm.deliverables.length && (norm.scenario || norm.instructions) ? "validated" : "needs_review";
      const row = {
        ref_key: key,
        role_en: debrand(norm.role_en),
        role_ar: norm.role_ar ? debrand(norm.role_ar) : null,
        sector_key: SECTOR[key.replace(/_guide$/, "")] ?? null,
        seniority: norm.seniority ?? null,
        skills: norm.skills.map(debrand),
        scenario: norm.scenario ? debrand(norm.scenario) : null,
        objectives: norm.objectives.map(debrand),
        instructions: norm.instructions ? debrand(norm.instructions) : null,
        deliverables: norm.deliverables.map((d) => ({ ...d, name: debrand(d.name), description: d.description ? debrand(d.description) : null })),
        input_assets: data as never,
        time_limit_minutes: norm.time_limit_minutes ?? null,
        tools: norm.tools,
        completeness,
        validation_status,
        validation_notes: gaps.length ? [...new Set(gaps)].join("; ") : null,
        source_files: sources,
        extracted_by: model,
        extracted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data: up, error } = await db.from("reference_assessments").upsert(row, { onConflict: "ref_key" }).select("id").single();
      if (error) throw error;
      const { error: aErr } = await db.from("reference_assessment_assessor").upsert({
        reference_id: up.id,
        rubric: norm.rubric.map((c) => ({ ...c, criterion: debrand(c.criterion), description: c.description ? debrand(c.description) : null })),
        assessor_guidance: norm.assessor_guidance ? debrand(norm.assessor_guidance) : null,
        answer_expectations: norm.answer_expectations ? debrand(norm.answer_expectations) : null,
        source_files: sources.filter((s) => s.audience === "assessor"),
      });
      if (aErr) throw aErr;
      toEmbed.push({
        id: up.id,
        text: [`Role: ${row.role_en}`, `Sector: ${row.sector_key}`, `Skills: ${row.skills.join(", ")}`, `Scenario: ${(row.scenario ?? row.instructions ?? "").slice(0, 1200)}`, `Deliverables: ${row.deliverables.map((d) => d.name).join("; ")}`].join("\n"),
      });
      const vis = sources.filter((s) => s.extraction === "vision").length;
      report.push(`${key.padEnd(28)} ${completeness.padEnd(13)} ${validation_status.padEnd(12)} files=${sources.length} vision=${vis} rubric=${norm.rubric.length} deliverables=${norm.deliverables.length}${row.validation_notes ? ` | ${row.validation_notes.slice(0, 120)}` : ""}`);
    } catch (e) {
      report.push(`${key.padEnd(28)} ERROR ${e instanceof Error ? e.message : String(e)}`);
    }
    console.log(`done ${key}`);
  };
  // Sequential: provider rate limits (Gemini per-minute quota) make parallel runs fail.
  for (const w of work) await processOne(w);

  // Embeddings for retrieval (only changed content).
  const cfg = embeddingConfig();
  const { data: existing } = await db.from("reference_embeddings").select("reference_id, content_hash").eq("model", cfg.model);
  const have = new Map((existing ?? []).map((e) => [e.reference_id, e.content_hash]));
  const todo = toEmbed.map((t) => ({ ...t, hash: contentHash(t.text, cfg) })).filter((t) => have.get(t.id) !== t.hash);
  if (todo.length) {
    const vecs = await embedTexts(todo.map((t) => t.text), "SEMANTIC_SIMILARITY");
    const { error } = await db.from("reference_embeddings").upsert(
      todo.map((t, i) => ({ reference_id: t.id, model: cfg.model, dims: cfg.dims, content_hash: t.hash, embedding: toPgVector(vecs[i]) })),
      { onConflict: "reference_id,model" },
    );
    if (error) throw error;
  }

  // Sector skills dictionaries.
  if (!only) {
    const dir = join(root, "03_Reference_Data/Sector_Skills");
    const SKEY: [RegExp, string][] = [
      [/الرقمي/, "digital"], [/المالية والتأمين/, "financial_services"], [/الثقافة والترفيه/, "culture_entertainment"],
      [/التشييد/, "construction_real_estate"], [/الصناعة التحويلية/, "manufacturing"], [/السياحة والضيافة/, "tourism_hospitality"],
      [/الجملة والتجزئة/, "wholesale_retail"],
    ];
    let total = 0;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".xlsx"))) {
      const sector = SKEY.find(([r]) => r.test(f))?.[1];
      if (!sector) continue;
      const fileSha = sha(readFileSync(join(dir, f)));
      const sheets = await readXlsx(join(dir, f), (n) => /وصف المهارات/.test(n));
      for (const s of sheets) {
        const kind = /العامة/.test(s.name) ? "general" : "technical";
        const hdr = s.rows.findIndex((r) => r.some((c) => /وصف المهار/.test(c)));
        const seen = new Set<string>();
        const rows = s.rows
          .slice(hdr + 1)
          .map((r) => r.filter(Boolean))
          .filter((r) => r.length >= 1 && r[0].length > 1)
          .map((r) => ({ sector_key: sector, kind, name_ar: r[0].slice(0, 300), description_ar: r[1]?.slice(0, 2000) ?? null, source_sha256: fileSha }))
          .filter((r) => (seen.has(r.name_ar) ? false : (seen.add(r.name_ar), true)));
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await db.from("sector_skills").upsert(rows.slice(i, i + 500), { onConflict: "sector_key,kind,name_ar" });
          if (error) throw error;
        }
        total += rows.length;
      }
    }
    report.push(`sector_skills upserted=${total}`);
  }
  console.log(report.join("\n"));
})().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
