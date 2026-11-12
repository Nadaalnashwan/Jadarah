import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isUnsafeZipName, readZip } from "@/lib/zip/safe-zip";
import {
  evaluationPrompt,
  evidenceFound,
  finaliseScores,
  normaliseDerivedCriteria,
  questionCriteria,
  rekeyDerivedScores,
  taskRefsFromGuide,
  submissionBlock,
  type FileExtraction,
} from "@/lib/domain/question-evaluation";
import { aggregateQuestionScores, questionAcceptsFiles } from "@/lib/domain/scoring";
import { extractSubmittedFile, sniff } from "@/services/evaluation/extract";
import { buildDocx, buildZip } from "./helpers/zip-writer";

const file = (over: Partial<FileExtraction>): FileExtraction => ({
  file_id: "f",
  file_name: "a.txt",
  mime_type: "text/plain",
  size_bytes: 1,
  method: "text",
  status: "read",
  chars: 0,
  note: null,
  text: "",
  ...over,
});

describe("safe ZIP reader", () => {
  it("reads ordinary entries and lists directories", () => {
    const z = buildZip([
      { name: "src/", data: "" },
      { name: "src/app.ts", data: "export const ok = 1;" },
      { name: "README.md", data: "# Read me", store: true },
    ]);
    const out = readZip(z, () => true);
    expect(out.map((e) => [e.name, e.status])).toEqual([
      ["src/", "directory"],
      ["src/app.ts", "read"],
      ["README.md", "read"],
    ]);
    expect(out[1].data!.toString()).toBe("export const ok = 1;");
  });

  it("refuses path traversal, absolute paths and drive letters (never rewrites them)", () => {
    for (const n of ["../evil.sh", "a/../../etc/passwd", "/etc/passwd", "C:\\win.ini", "a\\..\\b", "x\0y"]) expect(isUnsafeZipName(n)).toBe(true);
    expect(isUnsafeZipName("src/..hidden/file.ts")).toBe(false);
    const z = buildZip([
      { name: "../../outside.txt", data: "pwned" },
      { name: "ok.txt", data: "fine" },
    ]);
    const out = readZip(z, () => true);
    expect(out[0].status).toBe("skipped_unsafe_name");
    expect(out[0].data).toBeUndefined();
    expect(out[1].status).toBe("read");
  });

  it("does not follow symlinks or read encrypted entries", () => {
    const z = buildZip([
      { name: "link", data: "/etc/passwd", mode: 0o120777 },
      { name: "secret.txt", data: "x", encrypted: true },
    ]);
    expect(readZip(z, () => true).map((e) => e.status)).toEqual(["skipped_symlink", "skipped_encrypted"]);
  });

  it("stops ZIP bombs: size and compression ratio limits, inflate capped", () => {
    const bomb = Buffer.alloc(5 * 1024 * 1024, 0x41);
    const z = buildZip([{ name: "bomb.txt", data: bomb }]);
    expect(readZip(z, () => true)[0].status).toBe("skipped_too_large");
    const ratio = buildZip([{ name: "r.txt", data: Buffer.alloc(1024 * 1024, 0x41) }]);
    expect(readZip(ratio, () => true)[0].status).toBe("skipped_ratio");
    // An archive that lies about its size is not trusted: inflate is capped and the mismatch fails the entry.
    const liar = buildZip([{ name: "liar.txt", data: Buffer.alloc(3 * 1024 * 1024, 0x42), declaredSize: 10 }]);
    expect(readZip(liar, () => true, { maxEntries: 10, maxRead: 10, maxEntryBytes: 2 * 1024 * 1024, maxTotalBytes: 1e8, maxRatio: 1e9 })[0].status).toBe("failed");
  });

  it("applies the entry count limit", () => {
    const z = buildZip(Array.from({ length: 6 }, (_, i) => ({ name: `f${i}.txt`, data: `file ${i}` })));
    const out = readZip(z, () => true, { maxEntries: 10, maxRead: 3, maxEntryBytes: 1e6, maxTotalBytes: 1e6, maxRatio: 1e3 });
    expect(out.filter((e) => e.status === "read")).toHaveLength(3);
    expect(out.filter((e) => e.status === "skipped_limit")).toHaveLength(3);
  });

  it("rejects non-ZIP data", () => {
    expect(() => readZip(Buffer.from("not a zip file at all, just text"), () => true)).toThrow();
  });
});

describe("file content extraction (real files, no AI)", () => {
  const pdf = readFileSync(path.join(__dirname, "../fixtures/cv-sample.pdf"));

  it("reads the text layer of a real PDF", async () => {
    const r = await extractSubmittedFile({ id: "1", file_name: "cv.pdf", mime_type: "application/pdf", size_bytes: pdf.length }, pdf, "u");
    expect(r.method).toBe("pdf_text");
    expect(r.status).toBe("read");
    expect(r.text).toMatch(/page 1/);
    expect(r.chars).toBeGreaterThan(100);
  });

  it("does not trust the declared type: a fake PDF fails instead of being evaluated", async () => {
    const fake = Buffer.from("MZ this is an executable pretending to be a PDF");
    const r = await extractSubmittedFile({ id: "2", file_name: "report.pdf", mime_type: "application/pdf", size_bytes: fake.length }, fake, "u");
    expect(r.status).toBe("failed");
    expect(r.text).toBe("");
    expect(sniff(fake)).not.toBe("pdf");
  });

  it("reads DOCX text", async () => {
    const docx = buildDocx(["Database design", "Index on users.email for login lookups"]);
    const r = await extractSubmittedFile(
      { id: "3", file_name: "design.docx", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size_bytes: docx.length },
      docx,
      "u",
    );
    expect(r.method).toBe("docx");
    expect(r.text).toContain("Index on users.email");
  });

  it("reads source files inside a ZIP, lists the archive, skips unsafe and binary entries", async () => {
    const zip = buildZip([
      { name: "api/", data: "" },
      { name: "api/routes.ts", data: "router.post('/orders', validate(orderSchema), createOrder);" },
      { name: "api/routes.test.ts", data: "it('rejects an empty order', ...)" },
      { name: "node_modules/x/index.js", data: "ignored" },
      { name: "../escape.ts", data: "nope" },
      { name: "logo.png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]) },
      { name: "docs/notes.pdf", data: pdf, store: true },
    ]);
    const r = await extractSubmittedFile({ id: "4", file_name: "api.zip", mime_type: "application/zip", size_bytes: zip.length }, zip, "u");
    expect(r.method).toBe("zip");
    expect(r.text).toContain("=== api/routes.ts ===");
    expect(r.text).toContain("validate(orderSchema)");
    expect(r.text).toContain("=== docs/notes.pdf ===");
    expect(r.text).not.toContain("ignored");
    expect(r.text).not.toContain("nope");
    const st = Object.fromEntries(r.entries!.map((e) => [e.name, e.status]));
    expect(st["../escape.ts"]).toBe("skipped_unsafe_name");
    expect(st["node_modules/x/index.js"]).toBe("skipped_type");
    expect(st["logo.png"]).toBe("listed_image");
    expect(r.status).toBe("partial");
  });

  it("reports a damaged legacy .doc explicitly instead of pretending to read it", async () => {
    const doc = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(100)]);
    const r = await extractSubmittedFile({ id: "5", file_name: "old.doc", mime_type: "application/msword", size_bytes: doc.length }, doc, "u");
    expect(r.status).toBe("failed");
    expect(r.note).toMatch(/damaged|could not be read/);
    expect(r.text).toBe("");
  });
});

describe("question-specific criteria", () => {
  const rubric = { criteria: [{ key: "schema", name_en: "Schema", max_points: 4 }, { key: "indexes", name_en: "Indexes", max_points: 2 }] };

  it("uses the question's own employer rubric first", () => {
    expect(questionCriteria(rubric, false)).toMatchObject({ source: "employer_question", criteria: [{ key: "schema" }, { key: "indexes" }] });
  });
  it("labels a rubric shared by several questions as assessment-wide", () => {
    expect(questionCriteria(rubric, true).source).toBe("employer_shared");
  });
  it("falls back to AI-derived criteria (labelled) only when there is no rubric", () => {
    expect(questionCriteria(null, false)).toEqual({ source: "ai_derived", criteria: [] });
  });
  it("narrows an assessment-wide rubric to this task's criteria with the builder mapping (read-only)", () => {
    const shared = { criteria: [
      { key: "api", name_en: "API", max_points: 4 },
      { key: "tests", name_en: "Tests", max_points: 3 },
      { key: "report", name_en: "Report", max_points: 3 },
    ] };
    const refs = taskRefsFromGuide({ rubric: [{ key: "api", task_refs: [0] }, { key: "tests", task_refs: [0, 1] }, { key: "report", task_refs: [1] }] })!;
    const q1 = questionCriteria(shared, true, { position: 0, taskRefs: refs });
    const q2 = questionCriteria(shared, true, { position: 1, taskRefs: refs });
    expect(q1).toMatchObject({ source: "employer_question", mapped: true });
    expect(q1.criteria.map((c) => [c.key, c.max_points])).toEqual([["api", 4], ["tests", 1.5]]);
    expect(q2.criteria.map((c) => [c.key, c.max_points])).toEqual([["tests", 1.5], ["report", 3]]);
    // incomplete mapping → no narrowing, labelled assessment-wide
    expect(taskRefsFromGuide({ rubric: [{ key: "api" }] })).toBeNull();
    expect(questionCriteria(shared, true, { position: 0, taskRefs: { api: [0] } }).source).toBe("employer_shared");
    // a question's own rubric is never narrowed
    expect(questionCriteria(shared, false, { position: 1, taskRefs: refs }).criteria).toHaveLength(3);
  });

  it("normalises derived criteria to the question's points and keeps unique keys", () => {
    const d = normaliseDerivedCriteria(
      [
        { key: "Correctness", name: "Correctness", max_points: 5 },
        { key: "correctness", name: "Correctness 2", max_points: 3 },
        { key: "tests", name: "Tests", max_points: 2 },
      ],
      20,
    );
    expect(d.map((c) => c.max_points)).toEqual([10, 6, 4]);
    expect(new Set(d.map((c) => c.key)).size).toBe(3);
    const rekeyed = rekeyDerivedScores([{ key: "tests", score: 3, rationale: "" }], d);
    expect(rekeyed[0].key).toBe("tests");
  });
});

describe("evidence and score finalisation", () => {
  const criteria = [
    { key: "schema", name: "Schema", max_points: 4 },
    { key: "indexes", name: "Indexes", max_points: 2 },
  ];
  const submitted = "CREATE TABLE orders (id uuid primary key, user_id uuid references users(id));\nNo indexes were added.";

  it("finds real quotes (whitespace/case-insensitive, elisions) and rejects invented ones", () => {
    expect(evidenceFound("create table   ORDERS (id uuid", submitted)).toBe(true);
    expect(evidenceFound("CREATE TABLE orders ... references users(id)", submitted)).toBe(true);
    expect(evidenceFound("CREATE INDEX orders_user_idx", submitted)).toBe(false);
    expect(evidenceFound(null, submitted)).toBe(false);
  });

  it("clamps scores, scales to the question's points and flags unbacked claims", () => {
    const out = finaliseScores(
      criteria,
      [
        { key: "schema", score: 9, evidence: "CREATE TABLE orders (id uuid primary key", rationale: "table defined" },
        { key: "indexes", score: 2, evidence: "CREATE INDEX orders_user_idx ON orders(user_id)", rationale: "invented" },
        { key: "unknown", score: 5, evidence: null, rationale: "not a criterion" },
      ],
      [{ requirement: "Add an index on user_id", status: "fulfilled", evidence: "CREATE INDEX orders_user_idx" }],
      12,
      submitted,
    );
    expect(out.criteria.map((c) => c.score)).toEqual([4, 2]);
    expect(out.criteria[1].evidence).toBeNull();
    expect(out.criteria[1].evidence_verified).toBe(false);
    expect(out.unverified).toBe(1);
    expect(out.requirements[0].evidence_verified).toBe(false);
    expect(out.score).toBe(12); // (4+2)/6 × 12
  });

  it("scores a criterion the evaluator skipped as 0 and says so", () => {
    const out = finaliseScores(criteria, [{ key: "schema", score: 2, evidence: "CREATE TABLE orders", rationale: "partial" }], [], 6, submitted);
    expect(out.criteria[1]).toMatchObject({ score: 0, rationale: expect.stringMatching(/Not assessed/) });
    expect(out.score).toBe(2);
  });

  it("leaves criteria of an assessment-wide rubric that belong to other questions out of the total", () => {
    const out = finaliseScores(
      criteria,
      [
        { key: "schema", score: 4, evidence: "CREATE TABLE orders", rationale: "ok" },
        { key: "indexes", applies: false, score: 0, rationale: "about question 2" },
      ],
      [],
      10,
      submitted,
      "employer_shared",
    );
    expect(out.criteria[1].applicable).toBe(false);
    expect(out.score).toBe(10); // 4/4 of the applicable criteria
    // `applies` is ignored for a question's own rubric
    expect(finaliseScores(criteria, [{ key: "indexes", applies: false, score: 0, rationale: "" }], [], 10, submitted).criteria[1].applicable).toBe(true);
  });
});

describe("evaluation input isolation", () => {
  it("contains only this question's answer and files, and states unreadable files", () => {
    const block = submissionBlock("My approach for question 2", [
      file({ file_id: "q2a", file_name: "api.zip", mime_type: "application/zip", method: "zip", text: "=== routes.ts ===\nrouter.post()" }),
      file({ file_id: "q2b", file_name: "old.doc", mime_type: "application/msword", status: "unsupported", note: "legacy Word file", text: "" }),
    ]);
    expect(block.text).toContain("My approach for question 2");
    expect(block.text).toContain('name="api.zip"');
    expect(block.text).toContain("router.post()");
    expect(block.text).toMatch(/old\.doc[\s\S]*CONTENT NOT AVAILABLE: legacy Word file/);
    expect(submissionBlock("", []).text).toContain("no files were submitted for this question");
  });

  it("puts the question's own instructions, deliverables and criteria in the prompt", () => {
    const p = evaluationPrompt(
      { id: "q2", taskId: "t1", position: 1, type: "coding", prompt: "Build POST /orders with validation", points: 8, deliverables: [{ name: "routes.ts", format: "TypeScript" }] },
      [{ key: "validation", name: "Validation", max_points: 5 }],
      "employer_question",
      "<answer_text>x</answer_text>",
    );
    expect(p).toContain("QUESTION 2");
    expect(p).toMatch(/^TASK ID: t1\nQUESTION ID: q2\n/);
    expect(p).toContain("Build POST /orders with validation");
    expect(p).toContain("routes.ts (TypeScript)");
    expect(p).toContain('"key":"validation"');
  });
});

describe("overall score from question results", () => {
  it("a human review replaces the automatic score (no double counting) and weights are the points", () => {
    const r = aggregateQuestionScores([
      { points: 2, type: "multiple_choice", autoPoints: 2 },
      { points: 3, type: "multiple_choice", autoPoints: 0, reviewedPoints: 1.5 },
      { points: 10, type: "case_study", reviewedPoints: 7 },
      { points: 5, type: "coding", reviewedPoints: 5 },
    ]);
    expect(r).toEqual({ autoScore: 2, manualScore: 13.5, maxScore: 20, pending: 0, percentage: 77.5 });
  });

  it("an unreviewed open question is pending, never 0 or correct", () => {
    const r = aggregateQuestionScores([
      { points: 4, type: "true_false", autoPoints: 4 },
      { points: 6, type: "long_answer" },
    ]);
    expect(r.pending).toBe(1);
    expect(r.percentage).toBeNull();
    expect(r.autoScore + r.manualScore).toBe(4);
  });

  it("open questions accept files, objective ones do not", () => {
    expect(questionAcceptsFiles("coding")).toBe(true);
    expect(questionAcceptsFiles("case_study")).toBe(true);
    expect(questionAcceptsFiles("multiple_choice")).toBe(false);
  });
});
