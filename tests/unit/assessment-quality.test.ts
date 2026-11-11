import { describe, expect, it } from "vitest";
import { generateRows, ngramOverlap, toCsv, validateDataset, validateDraft, type Draft, type DatasetSpec } from "@/lib/domain/assessment-quality";

const ds: DatasetSpec = {
  file_name: "batches.csv",
  purpose: "defect analysis",
  rows: 60,
  columns: [
    { name: "batch_id", type: "id", prefix: "B" },
    { name: "line", type: "category", values: ["L1", "L2", "L3"] },
    { name: "defects", type: "int", min: 0, max: 10 },
    { name: "diameter_mm", type: "float", min: 4.9, max: 5.1, decimals: 3 },
    { name: "date", type: "date", start: "2026-01-01" },
  ],
  effects: [{ when_column: "line", equals: "L3", target_column: "defects", multiply: 3 }],
};

describe("synthetic data", () => {
  it("is deterministic, well-formed and applies the planted pattern", () => {
    const a = generateRows(ds, "seed");
    const b = generateRows(ds, "seed");
    expect(a).toEqual(b);
    expect(a).toHaveLength(60);
    expect(validateDataset(ds, a)).toEqual([]);
    const avg = (l: string) => {
      const r = a.filter((x) => x.line === l);
      return r.reduce((s, x) => s + Number(x.defects), 0) / r.length;
    };
    expect(avg("L3")).toBeGreaterThan(avg("L1") * 1.8);
    const csv = toCsv(ds, a);
    expect(csv.split("\n")[0]).toBe("batch_id,line,defects,diameter_mm,date");
    expect(csv.trim().split("\n")).toHaveLength(61);
  });
  it("flags invalid specs", () => {
    const bad: DatasetSpec = { ...ds, file_name: "../x.csv", effects: [{ when_column: "line", equals: "L9", target_column: "defects", add: 1 }] };
    const issues = validateDataset(bad, generateRows(bad));
    expect(issues.join(" ")).toMatch(/simple \.csv name/);
    expect(issues.join(" ")).toMatch(/never occurs/);
  });
});

describe("draft validation", () => {
  const draft: Draft = {
    scenario_en: "A plant producing metal fasteners saw defects rise on one production line over recent weeks.",
    duration_minutes: 90,
    tasks: [
      { title_en: "Analyse", instructions_en: "Use batches.csv to compare defect rates by line and identify the anomaly.", inputs: ["batches.csv"], deliverables: [{ name: "Analysis", format: "xlsx" }], time_minutes: 45, skills: ["Statistical Quality Control"] },
      { title_en: "Act", instructions_en: "Write a containment and corrective action plan with verification steps.", inputs: [], deliverables: [{ name: "CAPA plan", format: "pdf" }], time_minutes: 40, skills: ["Root Cause Analysis"] },
    ],
    datasets: [ds],
    rubric: [
      { key: "analysis", criterion_en: "Data analysis", max_points: 4, expected_evidence: "Correct per-line rates with L3 highlighted", task_refs: [0] },
      { key: "rca", criterion_en: "Root cause", max_points: 3, expected_evidence: "Plausible causes linked to evidence", task_refs: [1] },
      { key: "capa", criterion_en: "Corrective action", max_points: 3, expected_evidence: "Containment vs corrective distinguished", task_refs: [1] },
    ],
  };
  it("passes a coherent draft", () => {
    const checks = validateDraft({ draft, jobSkills: ["Statistical Quality Control", "Root Cause Analysis"], referenceTexts: ["Completely different reference about hotel reservations and guest complaints handling."] });
    expect(checks.filter((c) => !c.passed)).toEqual([]);
  });
  it("detects copying, missing inputs, legacy branding and leakage", () => {
    const copied = { ...draft, scenario_en: "You are a quality engineer at a virtual factory producing metal pins and received diameter measurements for six subsamples — MIDAN" };
    copied.tasks = [{ ...draft.tasks[0], inputs: ["missing.csv"], instructions_en: draft.tasks[0].instructions_en + " Correct per-line rates with L3 highlighted" }, draft.tasks[1]];
    const checks = validateDraft({ draft: copied, jobSkills: ["Statistical Quality Control"], referenceTexts: ["you are a quality engineer at a virtual factory producing metal pins and received diameter measurements for six subsamples and defect logs"] });
    const failed = checks.filter((c) => !c.passed).map((c) => c.check);
    expect(failed).toEqual(expect.arrayContaining(["originality", "input_availability", "no_legacy_branding", "no_assessor_leakage"]));
  });
  it("ngram overlap", () => {
    expect(ngramOverlap("a b c d e f g h i", "a b c d e f g h i", 8)).toBe(1);
    expect(ngramOverlap("a b c d e f g h i", "z y x w v u t s r", 8)).toBe(0);
  });
});
