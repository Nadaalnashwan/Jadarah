"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { saveMyAvailability } from "@/features/calendar/actions";
import { minutesLabel } from "@/lib/domain/calendar";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

type W = { weekday: number; start_minute: number; end_minute: number };
const ZONES = ["Asia/Riyadh", "Asia/Dubai", "Africa/Cairo", "Europe/London", "UTC"];
const toMin = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function AvailabilityEditor({ initial, initialTimezone }: { initial: W[]; initialTimezone: string }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [rows, setRows] = useState<W[]>(initial);
  const [tz, setTz] = useState(initialTimezone);
  const [pending, start] = useTransition();
  const dayName = (d: number) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", { weekday: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, 10, 1 + d)), // 2026-11-01 is a Sunday
    );
  const set = (i: number, patch: Partial<W>) => setRows((r) => r.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  const total = rows.reduce((a, w) => a + Math.max(0, w.end_minute - w.start_minute), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="surface-card flex flex-wrap items-center gap-3 p-4">
        <label className="text-sm font-semibold" htmlFor="av-tz">
          {L("Time zone", "المنطقة الزمنية")}
        </label>
        <Select id="av-tz" value={tz} onChange={(e) => setTz(e.target.value)} className="w-auto">
          {ZONES.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </Select>
        <span className="text-subtle ltr-nums ms-auto text-xs">
          {L("Weekly hours", "الساعات الأسبوعية")}: {(total / 60).toFixed(1)}
        </span>
        <Button
          type="button"
          size="sm"
          variant="soft"
          onClick={() =>
            setRows(
              [0, 1, 2, 3, 4].map((d) => ({ weekday: d, start_minute: 9 * 60, end_minute: 17 * 60 })),
            )
          }
        >
          <Copy /> {L("Sun–Thu, 9–5", "الأحد–الخميس، 9–5")}
        </Button>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => {
          const idx = rows.map((w, i) => ({ w, i })).filter((x) => x.w.weekday === d);
          return (
            <li key={d} className="surface-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-bold">{dayName(d)}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setRows((r) => [...r, { weekday: d, start_minute: idx.length ? Math.min(1380, idx.at(-1)!.w.end_minute + 60) : 540, end_minute: idx.length ? Math.min(1440, idx.at(-1)!.w.end_minute + 120) : 1020 }])
                  }
                  aria-label={L(`Add hours on ${dayName(d)}`, `إضافة ساعات يوم ${dayName(d)}`)}
                >
                  <Plus />
                </Button>
              </div>
              {idx.length === 0 ? (
                <p className="text-subtle text-sm">{L("Unavailable", "غير متاح")}</p>
              ) : (
                <AnimatePresence initial={false}>
                  {idx.map(({ w, i }) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-2 flex items-center gap-2"
                    >
                      <Input
                        type="time"
                        step={900}
                        value={minutesLabel(w.start_minute)}
                        onChange={(e) => set(i, { start_minute: toMin(e.target.value) })}
                        aria-label={L("From", "من")}
                        className="ltr-nums"
                      />
                      <span className="text-subtle">–</span>
                      <Input
                        type="time"
                        step={900}
                        value={minutesLabel(Math.min(w.end_minute, 1439))}
                        onChange={(e) => set(i, { end_minute: toMin(e.target.value) || 1440 })}
                        aria-label={L("To", "إلى")}
                        className="ltr-nums"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                        aria-label={L("Remove", "حذف")}
                      >
                        <Trash2 />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await saveMyAvailability({ timezone: tz, windows: rows });
              if (r.ok) {
                toast.success(r.message);
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          {L("Save availability", "حفظ أوقات التوفّر")}
        </Button>
      </div>
    </div>
  );
}
