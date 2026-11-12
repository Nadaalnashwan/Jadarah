/**
 * Calendar & scheduling rules (pure, shared by server and client, unit-tested).
 * Instants are UTC ISO strings / epoch ms; wall-clock values are interpreted in an IANA time zone
 * (default Asia/Riyadh). The database remains the authority on conflicts (exclusion constraint);
 * these helpers only propose slots and render calendars.
 */
export const DEFAULT_TZ = "Asia/Riyadh";

/** Offset (ms) of `timeZone` from UTC at instant `utcMs`. */
export function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Wall-clock "YYYY-MM-DDTHH:mm" in `timeZone` → UTC epoch ms (DST-safe for real zones). */
export function zonedToUtcMs(local: string, timeZone: string): number {
  const naive = Date.parse(`${local.length === 10 ? `${local}T00:00` : local}:00Z`);
  const first = naive - tzOffsetMs(naive, timeZone);
  return naive - tzOffsetMs(first, timeZone);
}

/** UTC instant → { date: YYYY-MM-DD, minutes since local midnight, weekday 0=Sun } in `timeZone`. */
export function toZoned(utcMs: number, timeZone: string) {
  const local = new Date(utcMs + tzOffsetMs(utcMs, timeZone));
  return {
    date: local.toISOString().slice(0, 10),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
    weekday: local.getUTCDay(),
  };
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export interface AvailabilityWindow {
  user_id: string;
  weekday: number; // 0 = Sunday
  start_minute: number;
  end_minute: number;
  timezone: string;
}
export interface BusyInterval {
  user_id: string;
  starts_at: string;
  ends_at: string;
}
export interface Slot {
  startUtc: string;
  endUtc: string;
  /** Wall-clock label in the scheduling time zone, e.g. "09:30". */
  label: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const minutesLabel = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/**
 * Free slots on `date` (in `timeZone`) where EVERY interviewer is inside their weekly availability
 * and not busy, stepping by `stepMinutes`. Interviewers with no availability configured are treated
 * as available during `defaultHours` (Sun–Thu working week by default, matching Saudi business days).
 * Past slots (before `nowMs` + lead time) are excluded.
 */
export function freeSlots(opts: {
  date: string;
  timeZone?: string;
  durationMinutes: number;
  interviewers: string[];
  availability: AvailabilityWindow[];
  busy: BusyInterval[];
  stepMinutes?: number;
  nowMs?: number;
  leadMinutes?: number;
  defaultHours?: { weekdays: number[]; start: number; end: number };
}): Slot[] {
  const tz = opts.timeZone ?? DEFAULT_TZ;
  const step = opts.stepMinutes ?? 15;
  const dur = opts.durationMinutes;
  const def = opts.defaultHours ?? { weekdays: [0, 1, 2, 3, 4], start: 9 * 60, end: 17 * 60 };
  const now = (opts.nowMs ?? Date.now()) + (opts.leadMinutes ?? 30) * 60_000;
  if (!opts.interviewers.length || dur <= 0) return [];

  // Each interviewer's available UTC ranges for that calendar date (their windows may use another tz).
  const dayStartUtc = zonedToUtcMs(opts.date, tz);
  const dayEndUtc = zonedToUtcMs(addDays(opts.date, 1), tz);
  const rangesFor = (user: string): [number, number][] => {
    const own = opts.availability.filter((a) => a.user_id === user);
    if (!own.length) {
      if (!def.weekdays.includes(weekdayOf(opts.date))) return [];
      return [[dayStartUtc + def.start * 60_000, dayStartUtc + def.end * 60_000]];
    }
    const out: [number, number][] = [];
    // Windows are wall-clock in their own zone; check the date before/after for cross-zone overlap.
    for (const w of own) {
      for (const d of [addDays(opts.date, -1), opts.date, addDays(opts.date, 1)]) {
        if (weekdayOf(d) !== w.weekday) continue;
        const base = zonedToUtcMs(d, w.timezone || tz);
        out.push([base + w.start_minute * 60_000, base + w.end_minute * 60_000]);
      }
    }
    return out;
  };
  const avail = new Map(opts.interviewers.map((u) => [u, rangesFor(u)]));
  const busy = opts.busy
    .filter((b) => opts.interviewers.includes(b.user_id))
    .map((b) => [Date.parse(b.starts_at), Date.parse(b.ends_at)] as const);

  const slots: Slot[] = [];
  for (let t = dayStartUtc; t + dur * 60_000 <= dayEndUtc; t += step * 60_000) {
    const end = t + dur * 60_000;
    if (t < now) continue;
    const everyoneAvailable = opts.interviewers.every((u) => avail.get(u)!.some(([s, e]) => s <= t && end <= e));
    if (!everyoneAvailable) continue;
    if (busy.some(([s, e]) => s < end && t < e)) continue; // half-open overlap, same as tstzrange '[)'
    slots.push({ startUtc: new Date(t).toISOString(), endUtc: new Date(end).toISOString(), label: minutesLabel(toZoned(t, tz).minutes) });
  }
  return slots;
}

/** 6×7 month grid (dates) starting on `weekStart` (0 = Sunday). */
export function monthGrid(year: number, month0: number, weekStart = 0): string[] {
  const first = `${year}-${pad(month0 + 1)}-01`;
  const lead = (weekdayOf(first) - weekStart + 7) % 7;
  const start = addDays(first, -lead);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** The 7 dates of the week containing `date`. */
export function weekDates(date: string, weekStart = 0): string[] {
  const lead = (weekdayOf(date) - weekStart + 7) % 7;
  const start = addDays(date, -lead);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** ISO instant `days` ago (request-time helper for server queries). */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** True while an interview has not ended yet. */
export function notEnded(endsAtIso: string): boolean {
  return Date.parse(endsAtIso) > Date.now();
}

/** Interview timing relative to "now" — the single rule every list, calendar and dashboard uses. */
export type InterviewPhase =
  | "upcoming" // scheduled and not started yet
  | "in_progress" // scheduled, started, not ended yet
  | "awaiting_update" // scheduled but already over: past, its outcome has not been recorded
  | "completed"
  | "cancelled";

/** Interviews without an end time are treated as lasting this long. */
export const DEFAULT_INTERVIEW_MINUTES = 60;

/**
 * Classify an interview by its real instants (UTC ISO strings with offsets, compared as epoch ms — the time zone of
 * the viewer never changes the result) and its recorded status. A past interview is never "upcoming", even when its
 * status was not updated; it is "awaiting_update" instead (the workflow still requires an explicit outcome).
 */
export function interviewPhase(
  iv: { status: string; scheduled_at: string; ends_at?: string | null },
  nowMs: number = Date.now(),
): InterviewPhase {
  if (iv.status === "cancelled") return "cancelled";
  if (iv.status === "completed") return "completed";
  const start = Date.parse(iv.scheduled_at);
  const end = iv.ends_at ? Date.parse(iv.ends_at) : start + DEFAULT_INTERVIEW_MINUTES * 60_000;
  if (Number.isNaN(start)) return "awaiting_update";
  if (start > nowMs) return "upcoming";
  if (end > nowMs) return "in_progress";
  return "awaiting_update";
}

/** Split interviews into the "upcoming" section (soonest first) and history (most recent first). */
export function splitInterviews<T extends { status: string; scheduled_at: string; ends_at?: string | null }>(
  rows: T[],
  nowMs: number = Date.now(),
) {
  const withPhase = rows.map((r) => ({ row: r, phase: interviewPhase(r, nowMs) }));
  const current = withPhase
    .filter((x) => x.phase === "upcoming" || x.phase === "in_progress")
    .sort((a, b) => Date.parse(a.row.scheduled_at) - Date.parse(b.row.scheduled_at));
  const history = withPhase
    .filter((x) => x.phase !== "upcoming" && x.phase !== "in_progress")
    .sort((a, b) => Date.parse(b.row.scheduled_at) - Date.parse(a.row.scheduled_at));
  return { current, history };
}

/** Calendar date (YYYY-MM-DD) of an instant in `timeZone` (default Asia/Riyadh). */
export function zonedDate(iso: string, timeZone: string = DEFAULT_TZ): string {
  return toZoned(Date.parse(iso), timeZone).date;
}
