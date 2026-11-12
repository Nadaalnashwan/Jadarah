import { describe, expect, it } from "vitest";
import { EVALUATOR_VERSION, evaluationInputHash, reusableResult, type EvaluationInput } from "@/lib/domain/evaluation-hash";
import { evaluationConfidence, evaluationSystemPrompt, questionEvaluationState, RUN_STALE_MS, type ConfidenceInput } from "@/lib/domain/question-evaluation";
import { acquireLocalLock, LOCAL_LOCK_MAX_MS } from "@/services/evaluation/run-lock";

const input = (over: Partial<EvaluationInput> = {}): EvaluationInput => ({
  taskId: "task-1",
  questionId: "q-1",
  prompt: "Forecast Q3 demand for SKU-118",
  promptAr: null,
  points: 10,
  deliverables: [{ name: "forecast.xlsx" }],
  rubricSource: "employer_question",
  criteria: [{ key: "method", name: "Method", max_points: 6 }, { key: "accuracy", name: "Accuracy", max_points: 4 }],
  answer: "See the attached workbook",
  files: [{ id: "f1", name: "forecast.xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sha256: "a".repeat(64) }],
  locale: "en",
  ...over,
});

describe("input hash (duplicate-evaluation prevention)", () => {
  it("is stable for the same input, independent of file order", () => {
    const two = [
      { id: "f1", name: "a.pdf", mime: "application/pdf", sha256: "1".repeat(64) },
      { id: "f2", name: "b.pdf", mime: "application/pdf", sha256: "2".repeat(64) },
    ];
    expect(evaluationInputHash(input({ files: two }))).toBe(evaluationInputHash(input({ files: [two[1], two[0]] })));
    expect(evaluationInputHash(input())).toMatch(/^[0-9a-f]{64}$/);
  });
  it("changes when file bytes, the answer, the criteria, the question, the task or the language change", () => {
    const h = evaluationInputHash(input());
    const variants: Partial<EvaluationInput>[] = [
      { files: [{ ...input().files[0], sha256: "b".repeat(64) }] },
      { files: [] },
      { answer: "See the attached workbook." },
      { criteria: [{ key: "method", name: "Method", max_points: 5 }, { key: "accuracy", name: "Accuracy", max_points: 5 }] },
      { rubricSource: "ai_derived", criteria: [] },
      { prompt: "Forecast Q4 demand" },
      { points: 8 },
      { questionId: "q-2" },
      { taskId: "task-2" },
      { locale: "ar" },
      { deliverables: [] },
    ];
    for (const v of variants) expect(evaluationInputHash(input(v)), JSON.stringify(v)).not.toBe(h);
  });
  it("a file that could not be downloaded hashes differently from the downloaded one", () => {
    expect(evaluationInputHash(input({ files: [{ ...input().files[0], sha256: null }] }))).not.toBe(evaluationInputHash(input()));
  });
  it("carries the evaluator version", () => {
    expect(EVALUATOR_VERSION).toMatch(/\S/);
  });
});

describe("reusing the stored result", () => {
  const h = "c".repeat(64);
  it("reuses only an identical, real, unrejected result", () => {
    expect(reusableResult({ status: "completed", input_sha256: h }, h)).toBe(true);
    expect(reusableResult({ status: "no_submission", input_sha256: h }, h)).toBe(true);
    expect(reusableResult({ status: "completed", input_sha256: "d".repeat(64) }, h)).toBe(false);
    expect(reusableResult({ status: "completed", input_sha256: null }, h)).toBe(false);
    expect(reusableResult({ status: "completed", input_sha256: h, rejected: true }, h)).toBe(false);
    expect(reusableResult(null, h)).toBe(false);
  });
  it("never reuses an 'unreadable files' result (reading may succeed next time)", () => {
    expect(reusableResult({ status: "extraction_failed", input_sha256: h }, h)).toBe(false);
  });
});

describe("in-process lock", () => {
  it("allows one run per key until released, and ignores a lock older than the maximum duration", () => {
    const k = `s:${Math.random()}`;
    const release = acquireLocalLock(k, 1_000);
    expect(release).not.toBeNull();
    expect(acquireLocalLock(k, 2_000)).toBeNull();
    expect(acquireLocalLock(`${k}:other`, 2_000)).not.toBeNull();
    release!();
    const again = acquireLocalLock(k, 3_000);
    expect(again).not.toBeNull();
    expect(acquireLocalLock(k, 3_000 + LOCAL_LOCK_MAX_MS + 1)).not.toBeNull(); // stale lock taken over
    again!(); // releasing the old holder must not free the new holder's lock
    expect(acquireLocalLock(k, 3_000 + LOCAL_LOCK_MAX_MS + 2)).toBeNull();
  });
});

describe("derived confidence", () => {
  const base: ConfidenceInput = {
    status: "completed",
    rubric_source: "employer_question",
    files: [{ file_name: "forecast.pdf", method: "pdf_text", status: "read", chars: 4000 }],
    criteria: [
      { score: 5, evidence_verified: true },
      { score: 3, evidence_verified: true },
    ],
    limitations: [],
    answerChars: 200,
  };
  it("is high only when everything was read and every score is backed by a quote", () => {
    expect(evaluationConfidence(base)).toEqual({ level: "high", reasons: [{ code: "all_evidence_verified", level: "high" }] });
  });
  it("is low when a file could not be read or most scores have no verified quote", () => {
    const unreadable = evaluationConfidence({ ...base, files: [...base.files, { file_name: "x.xls", method: "none", status: "unsupported", chars: 0 }] });
    expect(unreadable.level).toBe("low");
    expect(unreadable.reasons).toContainEqual({ code: "file_unreadable", level: "low", detail: "x.xls" });
    const noQuotes = evaluationConfidence({ ...base, criteria: [{ score: 5, evidence_verified: false }, { score: 3, evidence_verified: false }, { score: 1, evidence_verified: true }] });
    expect(noQuotes).toMatchObject({ level: "low", reasons: [{ code: "evidence_missing_most", detail: "2/3" }] });
    // exactly half is "some", not "most"
    expect(evaluationConfidence({ ...base, criteria: [{ score: 5, evidence_verified: false }, { score: 3, evidence_verified: true }] }).reasons[0]).toMatchObject({ code: "evidence_missing_some", detail: "1/2" });
    expect(evaluationConfidence({ ...base, status: "extraction_failed" }).level).toBe("low");
  });
  it("is at most medium for AI transcription, truncation, some unverified quotes, AI-derived criteria or stated limitations", () => {
    const cases: [Partial<ConfidenceInput>, string][] = [
      [{ files: [{ file_name: "scan.pdf", method: "pdf_ocr_ai", status: "read", chars: 900 }] }, "ai_transcription"],
      [{ files: [{ file_name: "photo.jpg", method: "image_ai", status: "read", chars: 300 }] }, "ai_transcription"],
      [{ files: [{ file_name: "big.pdf", method: "pdf_text", status: "read", chars: 20_000 }] }, "truncated"],
      [{ answerChars: 12_000 }, "truncated"],
      [{ criteria: [{ score: 5, evidence_verified: true }, { score: 2, evidence_verified: true }, { score: 1, evidence_verified: false }] }, "evidence_missing_some"],
      [{ rubric_source: "ai_derived" }, "criteria_ai_derived"],
      [{ rubric_source: "employer_shared" }, "criteria_shared"],
      [{ limitations: ["The chart image was not visible"] }, "model_limitations"],
      [{ files: [{ file_name: "code.zip", method: "zip", status: "partial", chars: 3000 }] }, "archive_partial"],
    ];
    for (const [over, code] of cases) {
      const c = evaluationConfidence({ ...base, ...over });
      expect(c.level, code).toBe("medium");
      expect(c.reasons.map((r) => r.code), code).toContain(code);
    }
    expect(evaluationConfidence({ ...base, rubric_source: "employer_shared", rubricMapped: true }).level).toBe("high");
  });
  it("zero scores without quotes do not lower confidence (nothing is claimed)", () => {
    expect(evaluationConfidence({ ...base, criteria: [{ score: 0, evidence_verified: false }, { score: 4, evidence_verified: true }] }).level).toBe("high");
  });
  it("is high for 'nothing submitted' (a fact, not a judgement)", () => {
    expect(evaluationConfidence({ ...base, status: "no_submission", files: [] }).level).toBe("high");
  });
});

describe("evaluation state per question", () => {
  const now = Date.parse("2026-11-12T10:00:00Z");
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  it("covers not evaluated, in progress, failed, requires review and completed", () => {
    const s = (o: Partial<Parameters<typeof questionEvaluationState>[0]>) =>
      questionEvaluationState({ autoScored: false, reviewed: false, ai: null, run: null, now, ...o });
    expect(s({})).toBe("not_evaluated");
    expect(s({ run: { status: "reading_files", started_at: iso(5_000), updated_at: iso(5_000) } })).toBe("reading_files");
    expect(s({ run: { status: "evaluating", started_at: iso(9_000), updated_at: iso(2_000) } })).toBe("evaluating");
    // a run that stopped reporting is shown as failed, not as running forever
    expect(s({ run: { status: "evaluating", started_at: iso(RUN_STALE_MS + 9_000), updated_at: iso(RUN_STALE_MS + 1_000) } })).toBe("failed");
    expect(s({ run: { status: "failed", started_at: iso(1_000), updated_at: iso(500) } })).toBe("failed");
    // a failed re-run after a stored result: the failure is what happened last
    expect(s({ ai: { created_at: iso(60_000) }, run: { status: "failed", started_at: iso(1_000), updated_at: iso(500) } })).toBe("failed");
    // an older failure followed by a stored result: the result counts
    expect(s({ ai: { created_at: iso(1_000) }, run: { status: "failed", started_at: iso(60_000), updated_at: iso(59_000) } })).toBe("requires_review");
    expect(s({ ai: { created_at: iso(1_000) }, run: { status: "completed", started_at: iso(9_000), updated_at: iso(1_000) } })).toBe("requires_review");
    expect(s({ ai: { created_at: iso(1_000) }, reviewed: true })).toBe("completed");
    expect(s({ reviewed: true })).toBe("completed"); // scored by a person without AI
    expect(s({ autoScored: true })).toBe("completed");
  });
});

describe("prompt asks for limitations", () => {
  it("instructs the model to state limitations", () => {
    expect(evaluationSystemPrompt("en", false)).toMatch(/limitations/);
  });
});
