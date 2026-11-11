import { describe, expect, it } from "vitest";
import { toYearMonth } from "@/lib/domain/cv-dates";

describe("CV review date normalisation", () => {
  it("normalises explicit month+year forms", () => {
    expect(toYearMonth("2021-3")).toBe("2021-03");
    expect(toYearMonth("03/2021")).toBe("2021-03");
    expect(toYearMonth("March 2021")).toBe("2021-03");
    expect(toYearMonth("Sep. 2019")).toBe("2019-09");
  });
  it("never invents a month from a bare year or free text", () => {
    expect(toYearMonth("2020")).toBe("");
    expect(toYearMonth("Present")).toBe("");
    expect(toYearMonth(null)).toBe("");
  });
});
