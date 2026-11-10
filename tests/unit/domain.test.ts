import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUSES,
  canCreateInterview,
  canHire,
  canTransition,
  canWithdraw,
  manualTargets,
  TERMINAL_STATUSES,
} from "@/lib/domain/application-status";
import { isAutoScored, percentage, scoreChoice, scoreShortAnswer } from "@/lib/domain/scoring";
import { classifyRequirement, computeMatch } from "@/lib/domain/matching";
import { analyzeSkillGap, planProgress, profileCompletion } from "@/lib/domain/career";
import { safeNext } from "@/features/auth/schemas";

describe("application status machine", () => {
  it("terminal statuses have no outgoing transitions", () => {
    for (const s of TERMINAL_STATUSES) for (const t of APPLICATION_STATUSES) expect(canTransition(s, t)).toBe(false);
  });
  it("interview scheduling requires shortlisting first", () => {
    expect(canTransition("under_review", "interview_scheduled")).toBe(false);
    expect(canTransition("assessment_completed", "interview_scheduled")).toBe(false);
    expect(canTransition("shortlisted", "interview_scheduled")).toBe(true);
  });
  it("canCreateInterview enforces shortlisted-before-interview", () => {
    expect(canCreateInterview({ status: "under_review", was_shortlisted: false })).toBe(false);
    expect(canCreateInterview({ status: "assessment_completed", was_shortlisted: false })).toBe(false);
    expect(canCreateInterview({ status: "shortlisted", was_shortlisted: false })).toBe(false);
    expect(canCreateInterview({ status: "shortlisted", was_shortlisted: true })).toBe(true);
    expect(canCreateInterview({ status: "interview_completed", was_shortlisted: true })).toBe(true);
    expect(canCreateInterview({ status: "hired", was_shortlisted: true })).toBe(false);
  });
  it("a company can hire without prior shortlisting", () => {
    for (const s of ["submitted", "under_review", "assessment_pending", "assessment_completed"] as const) expect(canHire(s)).toBe(true);
    expect(canHire("rejected")).toBe(false);
  });
  it("recruiters cannot pick workflow-only statuses manually", () => {
    expect(manualTargets("shortlisted")).not.toContain("interview_scheduled");
    expect(manualTargets("submitted")).not.toContain("withdrawn");
    expect(manualTargets("assessment_pending")).not.toContain("assessment_completed");
    expect(manualTargets("submitted")).toContain("hired");
  });
  it("candidates can withdraw only open applications", () => {
    expect(canWithdraw("interview_scheduled")).toBe(true);
    expect(canWithdraw("hired")).toBe(false);
  });
});

describe("assessment scoring", () => {
  it("single choice is all-or-nothing", () => {
    expect(scoreChoice("multiple_choice", ["a"], ["a"], 2)).toBe(2);
    expect(scoreChoice("multiple_choice", ["b"], ["a"], 2)).toBe(0);
    expect(scoreChoice("multiple_choice", ["a", "b"], ["a"], 2)).toBe(0);
  });
  it("multiple select gives partial credit with penalties, floored at 0", () => {
    expect(scoreChoice("multiple_select", ["a", "b"], ["a", "b"], 3)).toBe(3);
    expect(scoreChoice("multiple_select", ["a"], ["a", "b"], 3)).toBe(1.5);
    expect(scoreChoice("multiple_select", ["a", "c"], ["a", "b"], 3)).toBe(0);
    expect(scoreChoice("multiple_select", ["c", "d"], ["a", "b"], 3)).toBe(0);
  });
  it("short answers match case-insensitively and never on empty input", () => {
    expect(scoreShortAnswer(" Return ", ["return"], 2)).toBe(2);
    expect(scoreShortAnswer("", [""], 2)).toBe(0);
  });
  it("subjective types require human review", () => {
    expect(isAutoScored("long_answer")).toBe(false);
    expect(isAutoScored("coding")).toBe(false);
    expect(isAutoScored("short_answer")).toBe(false);
    expect(isAutoScored("short_answer", { accepted_answers: ["x"] })).toBe(true);
  });
  it("percentage handles zero max", () => {
    expect(percentage(5, 10)).toBe(50);
    expect(percentage(0, 0)).toBeNull();
  });
});

describe("explainable matching", () => {
  const req = { skill_id: "s", name: "SQL", importance: "required" as const, min_level: 3 };
  it("classifies each requirement", () => {
    expect(classifyRequirement(req, undefined)).toBe("missing");
    expect(classifyRequirement(req, { skill_id: "s", level: 2, source: "cv" })).toBe("partial");
    expect(classifyRequirement(req, { skill_id: "s", level: 4, source: "self" })).toBe("unverified");
    expect(classifyRequirement(req, { skill_id: "s", level: 3, source: "assessment" })).toBe("matched");
    expect(classifyRequirement(req, { skill_id: "s", level: 3, source: "self", evidence: "Built a warehouse" })).toBe("matched");
  });
  it("never invents skills and weights required over preferred", () => {
    const r = computeMatch(
      [req, { skill_id: "p", name: "Python", importance: "preferred", min_level: 2 }],
      [{ skill_id: "s", level: 4, source: "cv" }],
      { required: 0, candidate: 2 },
    );
    expect(r.counts).toEqual({ matched: 1, partial: 0, missing: 1, unverified: 0 });
    expect(r.score).toBe(67); // 1 / 1.5
    expect(r.requirements.find((x) => x.skill_id === "p")!.candidate_level).toBeNull();
  });
  it("experience contributes at most 15%", () => {
    const none = computeMatch([req], [], { required: 3, candidate: 3 });
    expect(none.score).toBe(15);
  });
});

describe("career intelligence", () => {
  it("analyses gaps", () => {
    const g = analyzeSkillGap(["sql", "python", "power-bi"], [
      { slug: "sql", level: 4, source: "cv" },
      { slug: "python", level: 2, source: "self" },
    ]);
    expect(g).toEqual({ strong: ["sql"], developing: ["python"], missing: ["power-bi"], coverage: 0.33 });
  });
  it("computes weighted plan progress", () => {
    expect(planProgress([])).toBe(0);
    expect(planProgress([{ status: "completed", estimated_hours: 10 }, { status: "not_started", estimated_hours: 10 }])).toBe(50);
    expect(planProgress([{ status: "in_progress" }, { status: "completed" }])).toBe(75);
  });
  it("computes profile completion", () => {
    expect(profileCompletion({ education: 0, experience: 0, skills: 0, projects: 0, certifications: 0, languages: 0, cvs: 0 })).toBe(0);
    expect(profileCompletion({ full_name: "x", headline: "x", summary: "x", city: "x", education: 1, experience: 1, skills: 1, projects: 1, certifications: 1, languages: 1, cvs: 1 })).toBe(100);
  });
});

describe("redirect safety", () => {
  it("only allows same-origin relative paths", () => {
    expect(safeNext("/candidate")).toBe("/candidate");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
  });
});
