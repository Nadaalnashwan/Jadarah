/**
 * Live check of file reading + question-level AI evaluation on the real fixture files, with the configured provider.
 * Runs exactly the code the employer's "Evaluate this question with AI" action runs (extractSubmittedFile +
 * evaluateQuestionSubmission), but writes NOTHING to any database: no project, no demo records, no approval needed.
 *
 *   NODE_USE_ENV_PROXY=1 npx tsx --conditions=react-server scripts/verify/evaluate-fixtures.ts [output dir]
 *
 * Reads keys from the environment / .env.local (never printed). Each scenario reports PASS, FAIL or BLOCKED
 * (BLOCKED = needs a provider that is not configured, e.g. Gemini for OCR; the safety rule is still checked: an
 * unreadable file must never be scored). Exit code 1 if any check FAILs.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { evaluationInputHash } from "../../src/lib/domain/evaluation-hash";
import type { Criterion, FileExtraction, RubricSource } from "../../src/lib/domain/question-evaluation";
import { aiStatus } from "../../src/services/ai/config";
import { extractSubmittedFile } from "../../src/services/evaluation/extract";
import { evaluateQuestionSubmission } from "../../src/services/evaluation/question-evaluator";

const FX = path.join(process.cwd(), "tests/fixtures/evaluation");
// Options: [output dir] [--only <text in scenario name>] [--repeat <n>] (repeat measures run-to-run variation)
const argv = process.argv.slice(2);
const opt = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const OUT = argv[0] && !argv[0].startsWith("--") ? argv[0] : path.join(process.cwd(), "docs/evidence/ai-evaluation");
const ONLY = opt("--only");
const REPEAT = Math.max(1, Math.min(10, Number(opt("--repeat") ?? 1)));
const MIME: Record<string, string> = {
  doc: "application/msword",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  jpg: "image/jpeg",
};

type Scenario = {
  name: string;
  points: number;
  prompt: string;
  criteria: Criterion[] | null; // null = no employer rubric (AI-derived criteria)
  answer?: string;
  files: string[];
  /** Text that must be present in what was read from the files. */
  mustRead?: string[];
  expect: "completed" | "extraction_failed";
  /** For completed results: inclusive score range as a fraction of the points. */
  scoreRange?: [number, number];
  /** Needs AI file transcription (Gemini). */
  needsVision?: boolean;
};

const scenarios: Scenario[] = [
  {
    name: "DOC (legacy Word) — complete answer",
    points: 5,
    prompt: "Write a short inventory report: state how stock turnover changed in Q2 and recommend a reorder point for SKU-118.",
    criteria: [
      { key: "turnover", name: "States the Q2 stock turnover change with figures", max_points: 2 },
      { key: "reorder", name: "Recommends a reorder point for SKU-118", max_points: 3 },
    ],
    files: ["report.doc"],
    mustRead: ["4.2 to 5.1", "340 units"],
    expect: "completed",
    scoreRange: [0.6, 1],
  },
  {
    name: "PPTX — forecast deck that answers the question",
    points: 6,
    prompt:
      "Prepare a short slide deck with the Q3 demand forecast for SKU-118 (units), the safety stock you recommend, the forecasting method and the main supply risk.",
    criteria: [
      { key: "forecast", name: "Q3 forecast for SKU-118 in units", max_points: 2 },
      { key: "safety", name: "Recommended safety stock", max_points: 1.5 },
      { key: "method", name: "Forecasting method explained", max_points: 1.5 },
      { key: "risk", name: "Main supply risk identified", max_points: 1 },
    ],
    files: ["forecast.pptx"],
    mustRead: ["1,240 units", "180 units", "9 to 14 days", "Assumes no promotion in July"],
    expect: "completed",
    scoreRange: [0.6, 1],
  },
  {
    name: "PPTX — same deck, question it does NOT answer (no credit for a file that merely exists)",
    points: 6,
    prompt:
      "Propose a pricing strategy for the new product line: three price points in SAR, a competitor price comparison table and the expected margin for each price point.",
    criteria: [
      { key: "prices", name: "Three price points in SAR", max_points: 2 },
      { key: "competitors", name: "Competitor price comparison", max_points: 2 },
      { key: "margin", name: "Expected margin per price point", max_points: 2 },
    ],
    files: ["forecast.pptx"],
    mustRead: ["1,240 units"],
    expect: "completed",
    scoreRange: [0, 0.2],
  },
  {
    name: "XLSX — budget workbook (cells, formulas, second sheet)",
    points: 6,
    prompt:
      "Prepare the H1 budget for marketing and salaries in SAR with Q1, Q2 and totals per line and overall, and explain the marketing variance between Q1 and Q2.",
    criteria: null,
    files: ["budget.xlsx"],
    mustRead: ["A2=Marketing", "D4=195500", "Riyadh Season campaign"],
    expect: "completed",
    scoreRange: [0.5, 1],
  },
  {
    name: "JPEG — photo of a document (AI transcription)",
    points: 4,
    prompt: "Upload a photo of the approved cost note and state the total cost and who approved it.",
    criteria: [{ key: "total", name: "Total cost stated", max_points: 3 }, { key: "approver", name: "Approver stated", max_points: 1 }],
    files: ["photo.jpg"],
    mustRead: ["18,450"],
    expect: "completed",
    needsVision: true,
  },
  {
    name: "Scanned PDF — no text layer (AI OCR)",
    points: 4,
    prompt: "Attach the scanned cost note and state the total cost and who approved it.",
    criteria: [{ key: "total", name: "Total cost stated", max_points: 3 }, { key: "approver", name: "Approver stated", max_points: 1 }],
    files: ["scanned.pdf"],
    mustRead: ["18,450"],
    expect: "completed",
    needsVision: true,
  },
  {
    name: "Password-protected PDF — must fail explicitly, no score, no AI call",
    points: 4,
    prompt: "Attach your analysis as a PDF.",
    criteria: [{ key: "analysis", name: "Analysis", max_points: 4 }],
    files: ["protected.pdf"],
    expect: "extraction_failed",
  },
  {
    name: "Password-protected XLSX — must fail explicitly, no score",
    points: 4,
    prompt: "Attach your workbook.",
    criteria: [{ key: "workbook", name: "Workbook", max_points: 4 }],
    files: ["protected.xlsx"],
    expect: "extraction_failed",
  },
  {
    name: "Image-only PPTX — no readable text, must not be scored",
    points: 4,
    prompt: "Attach your slides.",
    criteria: [{ key: "slides", name: "Slides", max_points: 4 }],
    files: ["image-only.pptx"],
    expect: "extraction_failed",
  },
];

type Row = { scenario: string; check: string; result: "PASS" | "FAIL" | "BLOCKED"; detail: string };
const rows: Row[] = [];
const record = (scenario: string, check: string, result: Row["result"], detail = "") => {
  rows.push({ scenario, check, result, detail });
  console.log(`${result.padEnd(7)} ${scenario} — ${check}${detail ? `  (${detail.slice(0, 220)})` : ""}`);
};

(async () => {
  const st = aiStatus();
  const vision = st.providers.some((p) => p.name === "gemini" && p.configured);
  console.log(`providers configured: ${st.providers.filter((p) => p.configured).map((p) => `${p.name}:${p.model}`).join(", ") || "none"}`);
  console.log(`evaluation route (deep): ${st.routes.deep ? `${st.routes.deep.provider}:${st.routes.deep.model}` : "none"}; vision (files): ${vision ? "gemini" : "not configured"}\n`);
  mkdirSync(OUT, { recursive: true });
  const report: unknown[] = [];
  const taskId = randomUUID();

  const selected = scenarios.filter((x) => !ONLY || x.name.toLowerCase().includes(ONLY.toLowerCase()));
  for (const sc of selected.flatMap((x) => Array.from({ length: REPEAT }, (_, i) => (REPEAT > 1 ? { ...x, name: `${x.name} [run ${i + 1}]` } : x)))) {
    const questionId = randomUUID();
    const extractions: FileExtraction[] = [];
    const hashes: { id: string; name: string; mime: string; sha256: string }[] = [];
    for (const name of sc.files) {
      const bytes = readFileSync(path.join(FX, name));
      const mime = MIME[name.split(".").pop()!];
      const id = randomUUID();
      hashes.push({ id, name, mime, sha256: createHash("sha256").update(bytes).digest("hex") });
      extractions.push(await extractSubmittedFile({ id, file_name: name, mime_type: mime, size_bytes: bytes.length }, bytes, "harness"));
    }
    const read = extractions.map((x) => x.text).join("\n");
    for (const x of extractions) console.log(`        read ${x.file_name}: ${x.status} via ${x.method}, ${x.chars} chars${x.note ? ` — ${x.note}` : ""}`);
    if (sc.mustRead?.length) {
      const missing = sc.mustRead.filter((t) => !read.includes(t));
      if (sc.needsVision && !vision) record(sc.name, "file contents extracted", "BLOCKED", "needs Gemini (GEMINI_API_KEY) for AI transcription");
      else record(sc.name, "file contents extracted", missing.length ? "FAIL" : "PASS", missing.length ? `missing: ${missing.join(" | ")}` : sc.mustRead.join(" | "));
    }
    const source: RubricSource = sc.criteria ? "employer_question" : "ai_derived";
    const criteria = sc.criteria ?? [];
    const answer = (sc.answer ?? "").trim();
    const inputSha256 = evaluationInputHash({
      taskId, questionId, prompt: sc.prompt, points: sc.points, deliverables: [], rubricSource: source, criteria, answer, files: hashes, locale: "en",
    });
    const started = Date.now();
    const out = await evaluateQuestionSubmission({
      question: { id: questionId, taskId, position: 0, type: "case_study", prompt: sc.prompt, points: sc.points, deliverables: [] },
      criteria, rubricSource: source, answer, extractions, locale: "en", userId: "harness", inputSha256,
    });
    const ms = Date.now() - started;
    if (!out.ok) {
      record(sc.name, "evaluation", "FAIL", `${out.code}: ${out.message}`);
      report.push({ scenario: sc.name, extraction: extractions.map(({ text, ...x }) => ({ ...x, preview: text.slice(0, 300) })), error: out });
      continue;
    }
    const p = out.payload as Record<string, unknown> & { criteria?: { key: string; score: number; max_points: number; evidence_verified: boolean }[] };
    const blockedVision = sc.needsVision && !vision;
    // Safety rule, always checked: an unreadable submission is never scored and never sent to the AI.
    if (p.status === "extraction_failed") {
      const ok = p.score === null && !out.aiCalled;
      if (blockedVision) record(sc.name, "unreadable without transcription → not scored, no AI call", ok ? "PASS" : "FAIL", String(p.explanation).slice(0, 200));
      else record(sc.name, `status ${sc.expect}`, sc.expect === "extraction_failed" && ok ? "PASS" : "FAIL", String(p.explanation).slice(0, 200));
    } else if (blockedVision) {
      record(sc.name, "evaluation", "FAIL", `expected no score without transcription, got status ${p.status}`);
    } else {
      record(sc.name, `status ${sc.expect}`, p.status === sc.expect ? "PASS" : "FAIL", `got ${p.status}`);
      const score = Number(p.score);
      const [lo, hi] = sc.scoreRange ?? [0, 1];
      const inRange = Number.isFinite(score) && score >= lo * sc.points - 1e-9 && score <= hi * sc.points + 1e-9;
      record(sc.name, `score within ${+(lo * sc.points).toFixed(2)}–${+(hi * sc.points).toFixed(2)} of ${sc.points}`, inRange ? "PASS" : "FAIL", `score ${p.score}/${sc.points}, ${p.provider}:${p.model}, ${ms} ms`);
      const verified = (p.criteria ?? []).filter((c) => c.score > 0 && c.evidence_verified).length;
      const positive = (p.criteria ?? []).filter((c) => c.score > 0).length;
      record(sc.name, "positive scores backed by quotes found in the file", positive === 0 || verified > 0 ? "PASS" : "FAIL", `${verified}/${positive} verified`);
      record(sc.name, "confidence derived", ["high", "medium", "low"].includes(String(p.confidence)) ? "PASS" : "FAIL", `${p.confidence}: ${JSON.stringify(p.confidence_reasons)}`);
    }
    report.push({
      scenario: sc.name,
      extraction: extractions.map(({ text, ...x }) => ({ ...x, preview: text.slice(0, 600) })),
      ai_called: out.aiCalled,
      latency_ms: ms,
      result: p,
    });
  }
  const file = path.join(OUT, `evaluate-fixtures-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), providers: st.providers.filter((x) => x.configured).map((x) => ({ name: x.name, model: x.model })), rows, report }, null, 2));
  const n = (r: Row["result"]) => rows.filter((x) => x.result === r).length;
  console.log(`\n${n("PASS")} PASS, ${n("FAIL")} FAIL, ${n("BLOCKED")} BLOCKED — report: ${path.relative(process.cwd(), file)}`);
  process.exit(n("FAIL") ? 1 : 0);
})();
