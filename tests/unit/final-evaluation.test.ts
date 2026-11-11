import { describe, expect, it } from "vitest";
import { DEFAULT_INTERVIEW_RUBRIC, overallScore, summariseInterviews } from "@/lib/domain/final-evaluation";

describe("overallScore", () => {
  it("uses nominal weights when all evidence exists", () => {
    const r = overallScore({ match: 80, assessment: 60, interview: 100 });
    expect(r.score).toBe(Math.round(80 * 0.3 + 60 * 0.35 + 100 * 0.35));
    expect(r.coverage).toBe(1);
  });
  it("re-normalises over available evidence and never imputes missing components", () => {
    const r = overallScore({ match: 80, assessment: null, interview: 60 });
    const m = r.components.find((c) => c.key === "match")!;
    const a = r.components.find((c) => c.key === "assessment")!;
    expect(a.value).toBeNull();
    expect(a.effectiveWeight).toBe(0);
    expect(m.effectiveWeight).toBeCloseTo(0.3 / 0.65, 3);
    expect(r.score).toBe(Math.round(80 * (0.3 / 0.65) + 60 * (0.35 / 0.65)));
  });
  it("returns null with no evidence at all", () => {
    expect(overallScore({ match: null, assessment: null, interview: null }).score).toBeNull();
  });
});

describe("summariseInterviews", () => {
  it("averages per criterion, weights the interview score, and flags disagreement", () => {
    const s = summariseInterviews(
      [
        { interviewer: "a", recommendation: "yes", ratings: { technical: 5, communication: 3 } },
        { interviewer: "b", recommendation: "no", ratings: { technical: 3, communication: 5, culture: 4 } },
      ],
      DEFAULT_INTERVIEW_RUBRIC,
    );
    const tech = s.criteria.find((c) => c.key === "technical")!;
    expect(tech.average).toBe(4);
    expect(tech.ratings).toBe(2);
    // unrated rubric criteria stay null (not zero)
    expect(s.criteria.find((c) => c.key === "critical_thinking")!.average).toBeNull();
    // legacy key keeps a readable label
    expect(s.criteria.find((c) => c.key === "culture")!.name_en).toBe("Collaboration");
    expect(s.disagreement).toBe(true);
    // weighted: technical(1.5)*4 + communication(1)*4 + culture(1)*4 → 4 → (4-1)/4*100 = 75
    expect(s.average).toBe(4);
    expect(s.score).toBe(75);
  });
  it("returns null scores without evaluations", () => {
    const s = summariseInterviews([], DEFAULT_INTERVIEW_RUBRIC);
    expect(s.score).toBeNull();
    expect(s.disagreement).toBe(false);
  });
});
