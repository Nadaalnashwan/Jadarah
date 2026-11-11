/** Monitoring period and context filters, parsed from the URL (so they are shareable and survive reloads). */
export type MonitoringTab = "overview" | "ai" | "assessments" | "recruitment" | "b2b" | "evaluation";
export const TABS: MonitoringTab[] = ["overview", "ai", "assessments", "recruitment", "b2b", "evaluation"];
export type RangeKey = "24h" | "7d" | "30d" | "90d" | "custom";

export type MonitoringParams = {
  tab?: string;
  range?: string;
  from?: string;
  to?: string;
  provider?: string;
  model?: string;
  operation?: string;
  company?: string;
  scope?: string;
  /** Page of the individual AI log list. */
  page?: string;
};

export type Period = {
  range: RangeKey;
  from: Date;
  to: Date;
  bucket: "hour" | "day";
  label_en: string;
  label_ar: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parsePeriod(p: MonitoringParams, now = new Date()): Period {
  const range = (["24h", "7d", "30d", "90d", "custom"].includes(p.range ?? "") ? p.range : "7d") as RangeKey;
  if (range === "custom" && p.from && DATE.test(p.from)) {
    const from = new Date(`${p.from}T00:00:00+03:00`);
    const toDay = p.to && DATE.test(p.to) ? p.to : now.toISOString().slice(0, 10);
    const to = new Date(`${toDay}T00:00:00+03:00`);
    to.setUTCDate(to.getUTCDate() + 1);
    if (to > from) {
      const days = (to.getTime() - from.getTime()) / 86_400_000;
      return {
        range,
        from,
        to: to > now ? now : to,
        bucket: days <= 2 ? "hour" : "day",
        label_en: `${p.from} → ${toDay}`,
        label_ar: `${p.from} ← ${toDay}`,
      };
    }
  }
  const ms = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000, "90d": 90 * 86_400_000 }[
    range === "custom" ? "7d" : range
  ];
  const key = range === "custom" ? "7d" : range;
  const labels: Record<string, [string, string]> = {
    "24h": ["Last 24 hours", "آخر 24 ساعة"],
    "7d": ["Last 7 days", "آخر 7 أيام"],
    "30d": ["Last 30 days", "آخر 30 يومًا"],
    "90d": ["Last 90 days", "آخر 90 يومًا"],
  };
  return {
    range: key as RangeKey,
    from: new Date(now.getTime() - ms),
    to: now,
    bucket: key === "24h" ? "hour" : "day",
    label_en: labels[key][0],
    label_ar: labels[key][1],
  };
}

export function tabOf(p: MonitoringParams): MonitoringTab {
  return (TABS as string[]).includes(p.tab ?? "") ? (p.tab as MonitoringTab) : "overview";
}

/** Demo/test identities and fictional companies are excluded unless the admin explicitly includes them. */
export function includeDemo(p: MonitoringParams): boolean {
  return p.scope === "all";
}

export function bucketLabel(iso: string, bucket: "hour" | "day", locale: "ar" | "en"): string {
  const d = new Date(iso);
  return bucket === "hour"
    ? d.toLocaleTimeString(locale === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Riyadh",
      })
    : d.toLocaleDateString(locale === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", {
        day: "2-digit",
        month: "short",
        timeZone: "Asia/Riyadh",
      });
}

/** Day buckets [from, to) in Riyadh time for non-AI series. */
export function dayKeys(from: Date, to: Date): string[] {
  const out: string[] = [];
  const step = 86_400_000;
  const startRiyadh = new Date(Math.floor((from.getTime() + 3 * 3_600_000) / step) * step - 3 * 3_600_000);
  for (let t = startRiyadh.getTime(); t < to.getTime(); t += step) out.push(new Date(t).toISOString());
  return out;
}

export function dayKeyOf(iso: string): string {
  const step = 86_400_000;
  const t = new Date(iso).getTime();
  return new Date(Math.floor((t + 3 * 3_600_000) / step) * step - 3 * 3_600_000).toISOString();
}

/** Builds a monitoring URL from the current params plus overrides (empty values are dropped). */
export function monitoringHref(
  p: MonitoringParams,
  over: Partial<MonitoringParams> = {},
  base = "/admin/monitoring",
) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...p, ...over })) if (v) q.set(k, v);
  const s = q.toString();
  return `${base}${s ? `?${s}` : ""}`;
}
