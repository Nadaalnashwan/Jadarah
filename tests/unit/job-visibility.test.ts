import { describe, expect, it } from "vitest";
import { isJobOpen, LISTED_JOB_FILTER, openDeadlineFilter, riyadhToday } from "@/lib/domain/listings";

describe("riyadhToday", () => {
  it("rolls over at midnight Riyadh (21:00 UTC), not at UTC midnight", () => {
    expect(riyadhToday(Date.parse("2026-11-11T20:59:00Z"))).toBe("2026-11-11");
    expect(riyadhToday(Date.parse("2026-11-11T21:00:00Z"))).toBe("2026-11-12");
  });
});

describe("isJobOpen", () => {
  const today = "2026-11-12";
  it("published with no deadline or a future/today deadline is open", () => {
    expect(isJobOpen({ status: "published", deadline: null }, today)).toBe(true);
    expect(isJobOpen({ status: "published", deadline: "2026-11-12" }, today)).toBe(true);
    expect(isJobOpen({ status: "published", deadline: "2026-12-01" }, today)).toBe(true);
  });
  it("expired, draft, paused, closed and archived jobs are not open", () => {
    expect(isJobOpen({ status: "published", deadline: "2026-11-11" }, today)).toBe(false);
    for (const status of ["draft", "paused", "closed", "archived"])
      expect(isJobOpen({ status, deadline: null }, today)).toBe(false);
  });
});

describe("listing filters", () => {
  it("open-deadline filter keeps jobs without a deadline or due today or later", () => {
    expect(openDeadlineFilter("2026-11-12")).toBe("deadline.is.null,deadline.gte.2026-11-12");
  });
  it("employer-posted and verified jobs are listed, practice scenarios are not", () => {
    expect(LISTED_JOB_FILTER).toContain("created_by.not.is.null");
    expect(LISTED_JOB_FILTER).toContain("listing_type.in.(verified,employer)");
  });
});
