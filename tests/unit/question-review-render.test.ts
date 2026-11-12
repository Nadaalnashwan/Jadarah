import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The real review component and the real view builder; only the framework router and server actions are stubbed.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }) }));
vi.mock("@/features/assessments/question-evaluation-actions", () => ({
  evaluateQuestionWithAI: vi.fn(),
  reviewQuestion: vi.fn(),
  rejectAiSuggestion: vi.fn(),
}));
vi.mock("@/features/assessments/file-actions", () => ({ assessmentFileUrl: vi.fn() }));

const { QuestionReviewPanel } = await import("@/app/company/applications/[id]/question-review");
const { buildQuestionViews } = await import("@/app/company/applications/[id]/question-views");
const { I18nProvider } = await import("@/lib/i18n/client");

const SUB = "00000000-0000-4000-8000-000000000001";
const NOW = Date.parse("2026-11-12T10:00:00Z");
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const q = (id: string, position: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: "case_study",
  prompt_en: `Question ${id} instructions`,
  prompt_ar: `تعليمات السؤال ${id}`,
  points: 10,
  position,
  config: {},
  rubric_id: null,
  rubric: null,
  assessment_options: [],
  ...extra,
});
const aiRow = (id: string, question: string, over: Record<string, unknown> = {}) => ({
  id,
  submission_id: SUB,
  question_id: question,
  status: "completed" as const,
  rubric_source: "ai_derived" as const,
  criteria: [
    { key: "method", name: "Method", max_points: 6, applicable: true, score: 5, evidence: "moving average", evidence_verified: true, rationale: "Method stated" },
    { key: "risk", name: "Risk", max_points: 4, applicable: true, score: 3, evidence: null, evidence_verified: false, rationale: "Risk partly covered" },
  ],
  requirements: [{ requirement: "State the forecast", status: "fulfilled" as const, evidence: null, evidence_verified: false, note: null }],
  strengths: ["Clear method"],
  issues: [],
  improvements: ["Quantify the risk"],
  concerns: ["Limitation stated by the evaluator: The chart image was not visible"],
  files: [{ file_id: "f1", file_name: "forecast.pptx", method: "text", status: "read", chars: 362, note: null }],
  score: 8,
  max_score: 10,
  explanation: "Mostly complete",
  provider: "groq",
  model: "openai/gpt-oss-120b",
  created_at: iso(60_000),
  ...over,
});

function views(locale: "en" | "ar") {
  return buildQuestionViews(
    locale,
    SUB,
    [q("q1", 0), q("q2", 1), q("q3", 2), q("q4", 3)],
    [{ question_id: "q1", text_answer: "Forecast 1,240 units", selected_option_ids: [], points_awarded: null }],
    [],
    [],
    [{ id: "f1", submission_id: SUB, question_id: "q1", file_name: "forecast.pptx", size_bytes: 30079, mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }],
    // q1: AI result, rejected; q3: AI result, then a failed re-run; q4: nothing yet; q2: a run in progress
    [aiRow("a1", "q1"), aiRow("a3", "q3", { created_at: iso(600_000) })] as never[],
    [{ submission_id: SUB, question_id: "q1", action: "ai_rejected", points: null, previous_points: null, source: "ai_rejected", comments: "The forecast method was misread", ai_evaluation_id: "a1", changed_at: iso(30_000) }],
    null,
    {
      runs: [
        { submission_id: SUB, question_id: "q2", status: "evaluating", error_code: null, error_message: null, started_at: iso(8_000), updated_at: iso(2_000), forced: false },
        { submission_id: SUB, question_id: "q3", status: "failed", error_code: "gemini_overloaded", error_message: "AI could not evaluate this answer now", started_at: iso(20_000), updated_at: iso(15_000), forced: true },
      ],
      rejections: [{ ai_evaluation_id: "a1", submission_id: SUB, question_id: "q1", reason: "The forecast method was misread", created_at: iso(30_000), rejected_by_profile: { full_name: "Recruiter One" } }],
    },
    NOW,
  );
}

const render = (locale: "en" | "ar", qs = views(locale)) =>
  renderToStaticMarkup(
    createElement(
      I18nProvider,
      { locale } as never, // children are passed as the third argument (typed as required on the provider)
      createElement(QuestionReviewPanel, {
        applicationId: "00000000-0000-4000-8000-0000000000aa",
        submissionId: SUB,
        questions: qs,
        unlinkedFiles: [],
        totals: { auto: 0, manual: 0, max: 40, percentage: null, pending: 4 },
        reliability: true,
      }),
    ),
  );

describe("employer question review renders the evaluation states", () => {
  it("derives one state per question from results, runs and reviews", () => {
    expect(views("en").map((v) => v.state)).toEqual(["requires_review", "evaluating", "failed", "not_evaluated"]);
  });
  it("shows states, the rejection, confidence and limitations (English)", () => {
    const html = render("en");
    for (const t of ["Requires human review", "Evaluating", "Failed", "Not evaluated", "Rejected by the reviewer", "The forecast method was misread", "Recruiter One", "Confidence", "Medium", "Limitations stated by the evaluator", "The chart image was not visible", "Some scores are not backed by a quote from the submission (1/2)", "The criteria were suggested by AI, not set by the employer"])
      expect(html, t).toContain(t);
    // a rejected suggestion offers neither "start from the AI suggestion" nor another rejection
    expect(html).not.toContain("Start from the AI suggestion");
    expect(html).not.toContain("Reject this AI suggestion");
    // the folded limitation is shown once, under limitations, not again under points to check
    expect(html.match(/The chart image was not visible/g)?.length).toBe(1);
  });
  it("shows the failure of the last run with its stored message", () => {
    const qs = views("en");
    const html = render("en", [qs[2], qs[0]]);
    expect(html).toContain("AI could not evaluate this answer now");
    expect(html).toContain("The previous result below is unchanged");
    expect(html).toContain("Reject this AI suggestion"); // q3's result is not rejected
  });
  it("renders in Arabic", () => {
    const html = render("ar");
    for (const t of ["يتطلب مراجعة بشرية", "جارٍ التقييم", "تعذّر التقييم", "لم يُقيَّم", "رفضه المراجِع", "درجة الثقة", "متوسطة", "قيود ذكرها المُقيِّم"]) expect(html, t).toContain(t);
  });
  it("UI copy added for these states has no trailing periods", () => {
    const text = render("en").replace(/<[^>]+>/g, "\n");
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => /^[A-Z]/.test(l) && l.length > 12 && !/forecast method was misread|Mostly complete/.test(l));
    expect(lines.filter((l) => /[^.]\.$/.test(l))).toEqual([]);
  });
});
