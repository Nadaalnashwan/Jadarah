import { describe, expect, it } from "vitest";
import { addDays, freeSlots, monthGrid, toZoned, weekDates, zonedToUtcMs } from "@/lib/domain/calendar";

const NOW = Date.parse("2026-11-01T00:00:00Z"); // well before the test dates

describe("time zones", () => {
  it("converts Riyadh wall-clock to UTC (UTC+3, no DST)", () => {
    expect(new Date(zonedToUtcMs("2026-11-15T09:00", "Asia/Riyadh")).toISOString()).toBe("2026-11-15T06:00:00.000Z");
  });
  it("handles DST zones (Europe/London summer = UTC+1)", () => {
    expect(new Date(zonedToUtcMs("2026-07-01T09:00", "Europe/London")).toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(new Date(zonedToUtcMs("2026-12-01T09:00", "Europe/London")).toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });
  it("maps UTC back to zoned date/minutes/weekday", () => {
    expect(toZoned(Date.parse("2026-11-15T21:30:00Z"), "Asia/Riyadh")).toEqual({ date: "2026-11-16", minutes: 30, weekday: 1 });
  });
});

describe("freeSlots", () => {
  const base = { timeZone: "Asia/Riyadh", nowMs: NOW, stepMinutes: 30 } as const;

  it("uses Sun–Thu 09:00–17:00 when no availability is configured, none on Friday", () => {
    const sun = freeSlots({ ...base, date: "2026-11-15", durationMinutes: 60, interviewers: ["a"], availability: [], busy: [] });
    expect(sun[0].label).toBe("09:00");
    expect(sun.at(-1)!.label).toBe("16:00");
    const fri = freeSlots({ ...base, date: "2026-11-20", durationMinutes: 60, interviewers: ["a"], availability: [], busy: [] });
    expect(fri).toHaveLength(0);
  });

  it("intersects all interviewers' availability and removes busy overlaps (half-open)", () => {
    const slots = freeSlots({
      ...base,
      date: "2026-11-15", // Sunday
      durationMinutes: 60,
      interviewers: ["a", "b"],
      availability: [
        { user_id: "a", weekday: 0, start_minute: 9 * 60, end_minute: 13 * 60, timezone: "Asia/Riyadh" },
        { user_id: "b", weekday: 0, start_minute: 10 * 60, end_minute: 15 * 60, timezone: "Asia/Riyadh" },
      ],
      // b busy 11:00–12:00 Riyadh = 08:00–09:00Z
      busy: [{ user_id: "b", starts_at: "2026-11-15T08:00:00Z", ends_at: "2026-11-15T09:00:00Z" }],
    });
    expect(slots.map((s) => s.label)).toEqual(["10:00", "12:00"]); // 10:00-11:00 ends exactly at busy start; 12:00-13:00 starts at busy end
  });

  it("respects an interviewer whose availability is in another time zone", () => {
    const slots = freeSlots({
      ...base,
      date: "2026-11-16", // Monday
      durationMinutes: 30,
      interviewers: ["a"],
      // 09:00–10:00 London (UTC+0 in Nov) = 12:00–13:00 Riyadh
      availability: [{ user_id: "a", weekday: 1, start_minute: 540, end_minute: 600, timezone: "Europe/London" }],
      busy: [],
    });
    expect(slots.map((s) => s.label)).toEqual(["12:00", "12:30"]);
  });

  it("excludes past slots", () => {
    const slots = freeSlots({
      ...base,
      nowMs: Date.parse("2026-11-15T10:00:00Z"), // 13:00 Riyadh
      leadMinutes: 0,
      date: "2026-11-15",
      durationMinutes: 60,
      interviewers: ["a"],
      availability: [],
      busy: [],
    });
    expect(slots[0].label).toBe("13:00");
  });
});

describe("grids", () => {
  it("month grid has 42 days starting on Sunday", () => {
    const g = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(g).toHaveLength(42);
    expect(g[0]).toBe("2026-11-01");
  });
  it("week dates", () => {
    expect(weekDates("2026-11-18")).toEqual(Array.from({ length: 7 }, (_, i) => addDays("2026-11-15", i)));
  });
});
