import { describe, expect, it } from "vitest";
import { interviewPhase, splitInterviews, zonedDate } from "@/lib/domain/calendar";

// "Now" = 12 November 2026, 10:00 Riyadh time (UTC+3) = 07:00 UTC.
const NOW = Date.parse("2026-11-12T07:00:00Z");
const iv = (scheduled_at: string, status = "scheduled", ends_at: string | null = null) => ({ status, scheduled_at, ends_at });

describe("interviewPhase", () => {
  it("reported case: 11 Nov 2026 01:52 Riyadh is past on 12 Nov, never upcoming", () => {
    // 01:52 Riyadh = 10 Nov 22:52 UTC
    expect(interviewPhase(iv("2026-11-10T22:52:00Z", "scheduled", "2026-11-10T23:22:00Z"), NOW)).toBe("awaiting_update");
    expect(interviewPhase(iv("2026-11-11T01:52:00+03:00"), NOW)).toBe("awaiting_update");
  });
  it("13 Nov 2026 10:00 Riyadh is upcoming on 12 Nov", () => {
    expect(interviewPhase(iv("2026-11-13T10:00:00+03:00"), NOW)).toBe("upcoming");
  });
  it("yesterday, earlier today, later today, tomorrow", () => {
    expect(interviewPhase(iv("2026-11-11T15:00:00+03:00"), NOW)).toBe("awaiting_update");
    expect(interviewPhase(iv("2026-11-12T08:00:00+03:00", "scheduled", "2026-11-12T08:45:00+03:00"), NOW)).toBe("awaiting_update");
    expect(interviewPhase(iv("2026-11-12T14:00:00+03:00"), NOW)).toBe("upcoming");
    expect(interviewPhase(iv("2026-11-13T09:00:00+03:00"), NOW)).toBe("upcoming");
  });
  it("an interview happening right now is in progress", () => {
    expect(interviewPhase(iv("2026-11-12T09:30:00+03:00", "scheduled", "2026-11-12T10:30:00+03:00"), NOW)).toBe("in_progress");
    // no end time: default 60 minutes
    expect(interviewPhase(iv("2026-11-12T09:30:00+03:00"), NOW)).toBe("in_progress");
    expect(interviewPhase(iv("2026-11-12T08:30:00+03:00"), NOW)).toBe("awaiting_update");
  });
  it("respects recorded outcomes regardless of time", () => {
    expect(interviewPhase(iv("2026-11-13T10:00:00+03:00", "cancelled"), NOW)).toBe("cancelled");
    expect(interviewPhase(iv("2026-11-10T10:00:00+03:00", "completed"), NOW)).toBe("completed");
  });
  it("UTC and offset forms of the same instant classify identically", () => {
    const a = interviewPhase(iv("2026-11-12T07:00:01Z"), NOW);
    const b = interviewPhase(iv("2026-11-12T10:00:01+03:00"), NOW);
    expect(a).toBe("upcoming");
    expect(b).toBe(a);
  });
});

describe("splitInterviews", () => {
  it("upcoming soonest first; history most recent first; past scheduled goes to history", () => {
    const rows = [
      { id: "past", ...iv("2026-11-11T01:52:00+03:00") },
      { id: "later", ...iv("2026-11-20T10:00:00+03:00") },
      { id: "soon", ...iv("2026-11-13T10:00:00+03:00") },
      { id: "done", ...iv("2026-11-05T10:00:00+03:00", "completed") },
    ];
    const { current, history } = splitInterviews(rows, NOW);
    expect(current.map((x) => x.row.id)).toEqual(["soon", "later"]);
    expect(history.map((x) => x.row.id)).toEqual(["past", "done"]);
  });
});

describe("zonedDate (Asia/Riyadh midnight boundary)", () => {
  it("22:30 UTC is already the next day in Riyadh", () => {
    expect(zonedDate("2026-11-10T22:30:00Z")).toBe("2026-11-11");
    expect(zonedDate("2026-11-10T20:59:00Z")).toBe("2026-11-10");
    expect(zonedDate("2026-11-10T21:00:00Z")).toBe("2026-11-11");
  });
});
