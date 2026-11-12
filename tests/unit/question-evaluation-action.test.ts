import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Orchestration of evaluateQuestionWithAI with the real extraction, evaluator, hashing and lock. Only the boundaries
 * are replaced: the Supabase client (an in-memory stand-in that records every RPC call and query filter), auth/i18n,
 * and the provider call (counted; it returns a fixed, schema-valid answer). This is a unit test, not a live result.
 */
const ids = {
  app: "00000000-0000-4000-8000-0000000000a1",
  sub: "00000000-0000-4000-8000-0000000000b1",
  q: "00000000-0000-4000-8000-0000000000c1",
  task: "00000000-0000-4000-8000-0000000000d1",
  company: "00000000-0000-4000-8000-0000000000e1",
};
const fx = (n: string) => readFileSync(path.join(__dirname, "../fixtures/evaluation", n));

type Call = { fn: string; args: Record<string, unknown> };
const db = {
  rpcCalls: [] as Call[],
  filters: [] as { table: string; col: string; val: unknown }[],
  latest: [] as Record<string, unknown>[],
  rejected: false,
  files: [] as { id: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number; question_id: string }[],
  blobs: new Map<string, Buffer>(),
  beginError: null as null | { code: string; message: string },
};
const aiCalls: unknown[] = [];
const DEFAULT_AI = async () => ({
  data: {
    derived_criteria: [],
    criteria: [
      { key: "forecast", score: 2, evidence: "Forecast for SKU-118: 1,240 units in Q3", rationale: "Stated" },
      { key: "risk", score: 1, evidence: "Supplier lead time rose from 9 to 14 days", rationale: "Stated" },
    ],
    requirements: [{ requirement: "Forecast in units", status: "fulfilled", evidence: "1,240 units" }],
    strengths: ["Specific numbers"],
    issues: [],
    improvements: [],
    explanation: "Both requested items are present",
    concerns: [],
    limitations: ["Slide images were not visible"],
  },
  provider: "groq",
  model: "openai/gpt-oss-120b",
  latencyMs: 5,
});
let aiImpl: () => Promise<unknown> = DEFAULT_AI;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireCompanyMember: async () => ({ userId: "u-rec", activeMembership: { company_id: ids.company, role: "recruiter" } }),
}));
vi.mock("@/lib/i18n/server", () => ({ getI18n: async () => ({ locale: "en" }) }));
vi.mock("@/services/ai/provider", () => {
  class AIUnavailableError extends Error {}
  return {
    AIUnavailableError,
    generateJSON: async (...a: unknown[]) => {
      aiCalls.push(a);
      return aiImpl();
    },
  };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const tableData = (table: string, single: boolean) => {
      switch (table) {
        case "assessment_submissions":
          return { id: ids.sub, status: "submitted", assignment: { application_id: ids.app, company_id: ids.company, assessment_id: ids.task } };
        case "assessment_questions":
          return single
            ? {
                id: ids.q, assessment_id: ids.task, type: "case_study", prompt_en: "Forecast Q3 demand and name the main risk", prompt_ar: "توقّع الطلب",
                points: 3, position: 0, config: {}, rubric_id: "r1",
                rubric: { criteria: [{ key: "forecast", name_en: "Forecast", max_points: 2 }, { key: "risk", name_en: "Risk", max_points: 1 }] },
              }
            : [{ id: ids.q, position: 0, rubric_id: "r1" }];
        case "assessment_answers":
          return { text_answer: "" };
        case "assessment_answer_files":
          return db.files;
        case "assessment_ai_evaluations":
          return db.latest;
        case "assessment_ai_rejections":
          return db.rejected ? { id: "rej" } : null;
        default:
          return null;
      }
    };
    const builder = (table: string) => {
      let single = false;
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (col: string, val: unknown) => (db.filters.push({ table, col, val }), b),
        in: () => b,
        order: () => b,
        limit: () => b,
        maybeSingle: () => ((single = true), b),
        then: (res: (v: unknown) => unknown) => res({ data: tableData(table, single), error: null }),
      };
      return b;
    };
    return {
      from: builder,
      storage: { from: () => ({ download: async (p: string) => ({ data: db.blobs.has(p) ? new Blob([new Uint8Array(db.blobs.get(p)!)]) : null, error: db.blobs.has(p) ? null : { message: "x" } }) }) },
      rpc: async (fn: string, args: Record<string, unknown>) => {
        db.rpcCalls.push({ fn, args });
        if (fn === "begin_ai_question_run") return db.beginError ? { data: null, error: db.beginError } : { data: "run-1", error: null };
        if (fn === "record_ai_question_evaluation") return { data: `ai-${db.rpcCalls.length}`, error: null };
        return { data: null, error: null };
      },
    };
  },
}));

const { evaluateQuestionWithAI } = await import("@/features/assessments/question-evaluation-actions");
const run = (force = false) => evaluateQuestionWithAI(ids.app, ids.sub, ids.q, force);
const recorded = () => db.rpcCalls.filter((c) => c.fn === "record_ai_question_evaluation").map((c) => c.args.p_result as Record<string, unknown>);

beforeEach(() => {
  db.rpcCalls = [];
  db.filters = [];
  db.latest = [];
  db.rejected = false;
  db.beginError = null;
  db.files = [{ id: "f1", storage_path: "c/s/q/forecast.pptx", file_name: "forecast.pptx", mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", size_bytes: 1, question_id: ids.q }];
  db.blobs = new Map([["c/s/q/forecast.pptx", fx("forecast.pptx")]]);
  aiCalls.length = 0;
  aiImpl = DEFAULT_AI;
});

describe("evaluateQuestionWithAI orchestration", () => {
  it("reads only this question's files, evaluates once, stores the result with run, hash, ids, limitations and confidence", async () => {
    const r = await run();
    expect(r).toMatchObject({ ok: true, data: { reused: false, status: "completed" } });
    expect(aiCalls).toHaveLength(1);
    expect(db.filters).toContainEqual({ table: "assessment_answer_files", col: "question_id", val: ids.q });
    expect(db.filters).toContainEqual({ table: "assessment_answer_files", col: "submission_id", val: ids.sub });
    const prompt = (aiCalls[0] as [{ prompt: string }])[0].prompt;
    expect(prompt).toContain(`TASK ID: ${ids.task}`);
    expect(prompt).toContain(`QUESTION ID: ${ids.q}`);
    expect(prompt).toContain("Forecast for SKU-118: 1,240 units in Q3"); // the file's real content, not its name
    expect(db.rpcCalls.map((c) => c.fn)).toEqual(["begin_ai_question_run", "update_ai_question_run", "record_ai_question_evaluation"]);
    expect(db.rpcCalls[1].args).toMatchObject({ p_run: "run-1", p_status: "evaluating" });
    const p = recorded()[0];
    expect(p).toMatchObject({ run_id: "run-1", status: "completed", score: 3, limitations: ["Slide images were not visible"], confidence: "medium", task_id: ids.task, question_id: ids.q });
    expect(p.input_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns the stored result without calling the AI when nothing changed; a confirmed re-evaluation calls it again", async () => {
    await run();
    const hash = recorded()[0].input_sha256;
    db.latest = [{ id: "ai-prev", status: "completed", score: 3, max_score: 3, created_at: "2026-11-12T09:00:00Z", input_sha256: hash }];
    db.rpcCalls = [];
    const again = await run();
    expect(again).toMatchObject({ ok: true, data: { id: "ai-prev", reused: true } });
    expect(aiCalls).toHaveLength(1); // no new provider call (and so no new ai_provider_logs row)
    expect(db.rpcCalls).toEqual([]); // no run, nothing stored
    const forced = await run(true);
    expect(forced).toMatchObject({ ok: true, data: { reused: false } });
    expect(aiCalls).toHaveLength(2);
    expect(db.rpcCalls[0]).toMatchObject({ fn: "begin_ai_question_run", args: { p_forced: true, p_input_sha256: hash } });
  });

  it("evaluates again when the file bytes changed, or when the stored result was rejected", async () => {
    await run();
    const hash = recorded()[0].input_sha256;
    db.latest = [{ id: "ai-prev", status: "completed", score: 3, max_score: 3, created_at: "2026-11-12T09:00:00Z", input_sha256: hash }];
    db.blobs.set("c/s/q/forecast.pptx", fx("budget.xlsx")); // different bytes (still read as declared type → fails)
    await run();
    expect(recorded()[1].input_sha256).not.toBe(hash);
    db.blobs.set("c/s/q/forecast.pptx", fx("forecast.pptx"));
    db.rejected = true;
    const n = aiCalls.length;
    await run();
    expect(aiCalls.length).toBe(n + 1);
  });

  it("one run at a time per submission + question", async () => {
    let release!: () => void;
    aiImpl = () =>
      new Promise((res) => {
        release = () => res(DEFAULT_AI());
      });
    const first = run(true);
    await vi.waitFor(() => expect(aiCalls).toHaveLength(1));
    const second = await run(true);
    expect(second).toMatchObject({ ok: false, error: "This question is already being evaluated. Wait for it to finish" });
    release();
    expect(await first).toMatchObject({ ok: true });
  });

  it("persists a failure with its code and stores no result", async () => {
    const { AIUnavailableError } = await import("@/services/ai/provider");
    aiImpl = async () => {
      throw new AIUnavailableError("gemini_overloaded");
    };
    const r = await run(true);
    expect(r).toMatchObject({ ok: false, error: "AI could not evaluate this answer now. Score manually or try again" });
    expect(recorded()).toEqual([]);
    expect(db.rpcCalls.at(-1)).toMatchObject({ fn: "update_ai_question_run", args: { p_run: "run-1", p_status: "failed", p_error_code: "gemini_overloaded" } });
  });

  it("never scores an unreadable file and never sends it to the AI", async () => {
    db.files = [{ id: "f2", storage_path: "c/s/q/protected.pdf", file_name: "protected.pdf", mime_type: "application/pdf", size_bytes: 1, question_id: ids.q }];
    db.blobs = new Map([["c/s/q/protected.pdf", fx("protected.pdf")]]);
    const n = aiCalls.length;
    const r = await run(true);
    expect(r).toMatchObject({ ok: true, data: { status: "extraction_failed", score: null } });
    expect(aiCalls.length).toBe(n);
    expect(db.rpcCalls.map((c) => c.fn)).not.toContain("update_ai_question_run"); // never reached "evaluating"
    expect(recorded()[0]).toMatchObject({ status: "extraction_failed", score: null, confidence: "low" });
  });

  it("without proposal 0034: works with the in-process lock and keeps model limitations visible as points to check", async () => {
    db.beginError = { code: "PGRST202", message: "Could not find the function" };
    const r = await run(true);
    expect(r).toMatchObject({ ok: true });
    const p = recorded()[0];
    expect(p.run_id).toBeNull();
    expect(p.concerns).toContain("Limitation stated by the evaluator: Slide images were not visible");
    expect(db.rpcCalls.map((c) => c.fn)).not.toContain("update_ai_question_run");
  });
});
