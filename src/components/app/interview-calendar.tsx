"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Video } from "lucide-react";
import { DEFAULT_TZ, addDays, interviewPhase, minutesLabel, monthGrid, toZoned, weekDates } from "@/lib/domain/calendar";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export type CalendarEvent = {
  id: string;
  title: string;
  subtitle?: string;
  startUtc: string;
  endUtc: string;
  status: "scheduled" | "completed" | "cancelled";
  confirmed?: boolean;
  href: string;
  /** "deadline": a practical-task due date (shown at its due time, never as an interview). */
  kind?: "interview" | "deadline";
};
export type BusyBlock = { startUtc: string; endUtc: string; label?: string };

type View = "month" | "week" | "day";

const STATUS_STYLE: Record<CalendarEvent["status"], string> = {
  scheduled: "bg-primary text-primary-foreground border-primary",
  completed: "bg-sky-soft text-navy border-sky dark:text-sky",
  cancelled: "bg-surface-2 text-subtle border-border line-through",
};

/** Past interviews whose outcome was never recorded must not look like upcoming ones. */
function eventStyle(e: CalendarEvent, now: number) {
  if (e.kind === "deadline")
    return e.status === "completed"
      ? "bg-success-soft text-success border-success/40"
      : "bg-warning-soft text-warning border-warning/50";
  const p = interviewPhase({ status: e.status, scheduled_at: e.startUtc, ends_at: e.endUtc }, now);
  return p === "awaiting_update" ? "bg-surface-2 text-muted border-dashed border-border-strong" : STATUS_STYLE[e.status];
}

const DEFAULT_HOURS = [7, 21] as const;
const PHONE = "(max-width: 639px)";
function subscribePhone(cb: () => void) {
  const m = window.matchMedia(PHONE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
const HOUR_PX = 56;

/**
 * Interview calendar (month / week / day). All instants are UTC; everything is rendered in
 * `timeZone` (default Asia/Riyadh). Purely presentational — data comes from RLS-scoped queries.
 */
export function InterviewCalendar({
  events,
  timeZone = DEFAULT_TZ,
  initialDate,
  busy = [],
}: {
  events: CalendarEvent[];
  timeZone?: string;
  initialDate?: string;
  busy?: BusyBlock[];
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  // Captured once at mount (render must stay pure).
  const [now] = useState(() => Date.now());
  const today = toZoned(now, timeZone).date;
  // Phones default to the Day view (a 7-column week needs horizontal scrolling there).
  const isPhone = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);
  const [chosen, setView] = useState<View | null>(null);
  const view: View = chosen ?? (isPhone ? "day" : "week");
  const [cursor, setCursor] = useState(initialDate ?? today);
  const [dir, setDir] = useState(0);

  const byDate = useMemo(() => {
    const m = new Map<string, (CalendarEvent & { startMin: number; endMin: number })[]>();
    for (const e of events) {
      const s = toZoned(Date.parse(e.startUtc), timeZone);
      const en = toZoned(Date.parse(e.endUtc), timeZone);
      const item = { ...e, startMin: s.minutes, endMin: en.date === s.date ? en.minutes : 24 * 60 };
      m.set(s.date, [...(m.get(s.date) ?? []), item].sort((a, b) => a.startMin - b.startMin));
    }
    return m;
  }, [events, timeZone]);
  const busyByDate = useMemo(() => {
    const m = new Map<string, { startMin: number; endMin: number; label?: string }[]>();
    for (const b of busy) {
      const s = toZoned(Date.parse(b.startUtc), timeZone);
      const en = toZoned(Date.parse(b.endUtc), timeZone);
      m.set(s.date, [...(m.get(s.date) ?? []), { startMin: s.minutes, endMin: en.date === s.date ? en.minutes : 1440, label: b.label }]);
    }
    return m;
  }, [busy, timeZone]);

  const fmt = (date: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { timeZone: "UTC", ...opts }).format(
      new Date(`${date}T12:00:00Z`),
    );
  const [y, m] = cursor.split("-").map(Number);
  const title =
    view === "month"
      ? fmt(cursor, { month: "long", year: "numeric" })
      : view === "week"
        ? `${fmt(weekDates(cursor)[0], { day: "numeric", month: "short" })} – ${fmt(weekDates(cursor)[6], { day: "numeric", month: "short", year: "numeric" })}`
        : fmt(cursor, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  function move(n: number) {
    setDir(n);
    if (view === "month") {
      const d = new Date(Date.UTC(y, m - 1 + n, 1));
      setCursor(d.toISOString().slice(0, 10));
    } else setCursor(addDays(cursor, view === "week" ? 7 * n : n));
  }

  const upcoming = events
    .filter((e) => {
      if (e.kind === "deadline") return e.status === "scheduled" && Date.parse(e.endUtc) > now;
      const p = interviewPhase({ status: e.status, scheduled_at: e.startUtc, ends_at: e.endUtc }, now);
      return p === "upcoming" || p === "in_progress";
    })
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  return (
    <div className="bg-surface overflow-hidden rounded-[1.75rem] border">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => move(-1)}
            className="hover:bg-surface-2 rounded-full p-2"
            aria-label={L("Previous", "السابق")}
          >
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="hover:bg-surface-2 rounded-full p-2"
            aria-label={L("Next", "التالي")}
          >
            <ChevronRight className="size-4 rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => {
              setDir(0);
              setCursor(today);
            }}
            className="hover:bg-surface-2 ms-1 rounded-full border px-3 py-1 text-xs font-semibold"
          >
            {L("Today", "اليوم")}
          </button>
        </div>
        <h2
          className="order-last min-w-0 basis-full truncate text-lg font-extrabold tracking-tight sm:order-none sm:flex-1 sm:basis-auto"
          aria-live="polite"
        >
          {title}
        </h2>
        <span className="text-subtle hidden text-xs sm:inline">{timeZone}</span>
        <div
          role="tablist"
          aria-label={L("Calendar view", "عرض التقويم")}
          className="bg-surface-2 ms-auto flex rounded-full p-1 sm:ms-0"
        >
          {(["month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                "relative rounded-full px-3 py-1 text-xs font-semibold transition",
                view === v ? "text-white" : "text-muted hover:text-foreground",
              )}
            >
              {view === v && (
                <motion.span layoutId="cal-view" className="bg-navy dark:bg-primary absolute inset-0 rounded-full" />
              )}
              <span className="relative">{{ month: L("Month", "شهر"), week: L("Week", "أسبوع"), day: L("Day", "يوم") }[v]}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={`${view}-${cursor.slice(0, view === "month" ? 7 : 10)}`}
          custom={dir}
          initial={{ opacity: 0, x: dir * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -24 }}
          transition={{ duration: 0.22 }}
        >
          {view === "month" ? (
            <MonthView
              now={now}
              year={y}
              month0={m - 1}
              today={today}
              byDate={byDate}
              locale={locale}
              onPick={(d) => {
                setCursor(d);
                setView("day");
              }}
            />
          ) : (
            <TimeGrid
              now={now}
              dates={view === "week" ? weekDates(cursor) : [cursor]}
              today={today}
              byDate={byDate}
              busyByDate={busyByDate}
              fmt={fmt}
              L={L}
              compact={view === "week"}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* agenda: always visible on small screens, summary on large */}
      <div className="border-t p-4">
        <p className="text-subtle mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
          <CalendarDays className="size-3.5" /> {L("Upcoming", "القادمة")}
        </p>
        {upcoming.length === 0 ? (
          <p className="text-muted text-sm">{L("No upcoming interviews", "لا توجد مقابلات قادمة")}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {upcoming.slice(0, 6).map((e) => {
              const s = toZoned(Date.parse(e.startUtc), timeZone);
              return (
                <li key={e.id}>
                  <Link href={e.href} className="hover:border-primary/50 flex items-center gap-3 rounded-2xl border p-3 transition">
                    <span className="ink text-primary-ink flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5 text-center">
                      <span className="text-[10px] font-semibold uppercase">{fmt(s.date, { month: "short" })}</span>
                      <span className="ltr-nums text-lg leading-none font-extrabold">{Number(s.date.slice(8))}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{e.title}</span>
                      <span className="text-subtle flex items-center gap-1 text-xs">
                        <Clock className="size-3" /> <span className="ltr-nums">{minutesLabel(s.minutes)}</span>
                        {e.subtitle && <span className="truncate">· {e.subtitle}</span>}
                      </span>
                    </span>
                    {e.confirmed && <CheckCircle2 className="text-success size-4 shrink-0" aria-label={L("Confirmed", "مؤكَّدة")} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function MonthView({
  now,
  year,
  month0,
  today,
  byDate,
  locale,
  onPick,
}: {
  now: number;
  year: number;
  month0: number;
  today: string;
  byDate: Map<string, CalendarEvent[]>;
  locale: "ar" | "en";
  onPick: (d: string) => void;
}) {
  const days = monthGrid(year, month0);
  const names = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", { weekday: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, 10, 1 + i)),
    ),
  );
  return (
    <div className="p-2 sm:p-4">
      <div className="text-subtle grid grid-cols-7 pb-2 text-center text-[11px] font-bold uppercase">
        {names.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const inMonth = Number(d.slice(5, 7)) === month0 + 1;
          const evs = byDate.get(d) ?? [];
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              className={cn(
                "hover:border-primary/40 flex min-h-20 flex-col items-stretch gap-1 rounded-xl border p-1.5 text-start transition sm:min-h-24",
                !inMonth && "opacity-40",
                d === today && "border-primary ring-primary/20 ring-2",
              )}
            >
              <span className={cn("ltr-nums text-xs font-bold", d === today && "text-primary")}>{Number(d.slice(8))}</span>
              {evs.slice(0, 3).map((e) => (
                <span
                  key={e.id}
                  className={cn("truncate rounded-md border px-1 text-[10px] leading-4 font-semibold", eventStyle(e, now))}
                >
                  {e.title}
                </span>
              ))}
              {evs.length > 3 && <span className="text-subtle text-[10px]">+{evs.length - 3}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimeGrid({
  now,
  dates,
  today,
  byDate,
  busyByDate,
  fmt,
  L,
  compact,
}: {
  now: number;
  dates: string[];
  today: string;
  byDate: Map<string, (CalendarEvent & { startMin: number; endMin: number })[]>;
  busyByDate: Map<string, { startMin: number; endMin: number; label?: string }[]>;
  fmt: (d: string, o: Intl.DateTimeFormatOptions) => string;
  L: (en: string, ar: string) => string;
  compact: boolean;
}) {
  // Show 07:00–21:00, widened to fit any earlier/later interview on the visible days.
  const visible = dates.flatMap((d) => byDate.get(d) ?? []);
  const HOUR_START = Math.min(DEFAULT_HOURS[0], ...visible.map((e) => Math.floor(e.startMin / 60)));
  const HOUR_END = Math.max(DEFAULT_HOURS[1], ...visible.map((e) => Math.ceil(e.endMin / 60)));
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const top = (min: number) => ((Math.max(min, HOUR_START * 60) - HOUR_START * 60) / 60) * HOUR_PX;
  return (
    <div className="overflow-x-auto">
      <div className={cn("grid", compact ? "min-w-[46rem]" : "")} style={{ gridTemplateColumns: `3.5rem repeat(${dates.length}, 1fr)` }}>
        <div />
        {dates.map((d) => (
          <div key={d} className={cn("border-s px-2 py-2 text-center", d === today && "bg-accent-soft/50")}>
            <p className="text-subtle text-[11px] font-bold uppercase">{fmt(d, { weekday: "short" })}</p>
            <p className={cn("ltr-nums text-lg font-extrabold", d === today && "text-primary")}>{Number(d.slice(8))}</p>
          </div>
        ))}
        <div className="relative">
          {hours.map((h) => (
            <div key={h} className="text-subtle ltr-nums pe-2 text-end text-[10px]" style={{ height: HOUR_PX }}>
              {minutesLabel(h * 60)}
            </div>
          ))}
        </div>
        {dates.map((d) => (
          <div key={d} className="relative border-s" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h) => (
              <div key={h} className="border-t border-dashed" style={{ height: HOUR_PX }} />
            ))}
            {(busyByDate.get(d) ?? []).map((b, i) => (
              <div
                key={`b${i}`}
                className="bg-surface-2/80 absolute inset-x-1 rounded-lg border border-dashed"
                style={{ top: top(b.startMin), height: Math.max(12, top(b.endMin) - top(b.startMin)) }}
                title={b.label ?? L("Busy", "مشغول")}
              />
            ))}
            {(byDate.get(d) ?? []).map((e) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-x-1"
                style={{ top: top(e.startMin), height: Math.max(22, top(e.endMin) - top(e.startMin)) }}
              >
                <Link
                  href={e.href}
                  className={cn(
                    "flex h-full flex-col overflow-hidden rounded-lg border px-2 py-1 text-[11px] leading-tight shadow-sm transition hover:brightness-110",
                    eventStyle(e, now),
                  )}
                >
                  <span className="flex items-center gap-1 font-bold">
                    {e.status === "scheduled" && <Video className="size-3 shrink-0" />}
                    <span className="truncate">{e.title}</span>
                    {e.confirmed && <CheckCircle2 className="ms-auto size-3 shrink-0" />}
                  </span>
                  <span className="ltr-nums opacity-80">
                    {minutesLabel(e.startMin)}–{minutesLabel(Math.min(e.endMin, 1439))}
                  </span>
                  {e.subtitle && <span className="truncate opacity-80">{e.subtitle}</span>}
                </Link>
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
