import { describe, expect, it } from "vitest";
import { coverageFeedback, recommendCareers, type CategoryDemand } from "@/lib/domain/discovery";

const cat = (slug: string, skills: [string, string, number][], jobs = 1): CategoryDemand => ({
  slug,
  name: slug,
  jobs: Array.from({ length: jobs }, (_, i) => ({ id: `${slug}-${i}`, title: `${slug} job ${i}` })),
  skills: new Map(skills.map(([id, name, count]) => [id, { name, count, required: count }])),
});

describe("career discovery", () => {
  const categories = [
    cat("data", [["sql", "SQL", 5], ["py", "Python", 3], ["bi", "Power BI", 2]]),
    cat("security", [["siem", "SIEM", 4], ["net", "Networking", 2]]),
    cat("design", [["fig", "Figma", 3]]),
  ];
  it("ranks by demand-weighted overlap and explains matched and missing skills", () => {
    const r = recommendCareers([{ id: "sql", name: "SQL", source: "cv" }, { id: "net", name: "Networking", source: "self" }], [], categories);
    expect(r.map((x) => x.slug)).toEqual(["data", "security"]);
    expect(r[0].matched).toEqual([{ name: "SQL", source: "cv" }]);
    expect(r[0].missing).toEqual(["Python", "Power BI"]);
  });
  it("never recommends a field with no overlap and no stated interest", () => {
    const r = recommendCareers([{ id: "sql", name: "SQL", source: "cv" }], [], categories);
    expect(r.find((x) => x.slug === "design")).toBeUndefined();
  });
  it("includes a field the candidate is interested in, even without matching skills yet", () => {
    const r = recommendCareers([], ["design"], categories);
    expect(r.map((x) => x.slug)).toEqual(["design"]);
    expect(r[0].interest).toBe(true);
  });
});

describe("exploratory feedback coverage", () => {
  it("detects which key points a response covers (EN + AR)", () => {
    const criteria = [
      { key: "cause", en: "", ar: "", keywords: ["cache", "مؤقت"] },
      { key: "test", en: "", ar: "", keywords: ["test", "اختبار"] },
    ];
    expect(coverageFeedback("The cached total is stale.", criteria)).toMatchObject({ covered: ["cause"], missed: ["test"] });
    expect(coverageFeedback("سأضيف اختبار يمنع التكرار والقيمة المحفوظة مؤقتا", criteria).covered).toEqual(["cause", "test"]);
  });
});
