import { errorCategory, percentile, type AiLogRow } from "./ai-metrics";

/**
 * Operational alert rules — measurable thresholds with minimum sample sizes. Alerts are evaluated server-side when
 * a Super Admin opens Monitoring; the same alert key is notified at most once per cooldown (database-enforced when
 * proposal 0031 is applied), so repeated page views never spam.
 */
export type Alert = {
  key: string;
  severity: "warning" | "critical";
  title_en: string;
  title_ar: string;
  detail_en: string;
  detail_ar: string;
  /** What to open first when investigating. */
  investigate: string;
};

export const ALERT_RULES = {
  quota: { windowMin: 60, minErrors: 3 },
  errorRate: { windowMin: 60, minAttempts: 20, threshold: 0.3 },
  latency: { windowMin: 60, minSamples: 20, baselineDays: 7, minBaseline: 30, factor: 2 },
  builder: { windowHours: 24, minAttempts: 3, threshold: 0.5 },
  telemetry: { minFailures: 1 },
} as const;

export function evaluateAlerts(input: {
  now: Date;
  /** AI attempts of the last 7 days (any provider). */
  aiRows: AiLogRow[];
  /** Assessment Builder outcomes of the last 24 h. */
  builder: { generated: number; failed: number };
  telemetry: { failures: number; lastFailureAt: number | null };
}): Alert[] {
  const out: Alert[] = [];
  const t = input.now.getTime();
  const lastHour = input.aiRows.filter(
    (r) => t - new Date(r.created_at).getTime() <= ALERT_RULES.quota.windowMin * 60_000,
  );

  // 1. Repeated quota exhaustion (per provider).
  const quotaBy = new Map<string, number>();
  for (const r of lastHour)
    if (!r.success && errorCategory(r.error_code) === "quota")
      quotaBy.set(r.provider, (quotaBy.get(r.provider) ?? 0) + 1);
  for (const [provider, n] of quotaBy)
    if (n >= ALERT_RULES.quota.minErrors)
      out.push({
        key: `ai.quota.${provider}`,
        severity: "critical",
        title_en: `${provider}: quota exhausted ${n} times in the last hour`,
        title_ar: `${provider}: نفاد الحصة ${n} مرات خلال الساعة الأخيرة`,
        detail_en: `Threshold: ≥ ${ALERT_RULES.quota.minErrors} quota errors in ${ALERT_RULES.quota.windowMin} min. Requests fall back to other providers or rule-based modes.`,
        detail_ar: `الحد: ${ALERT_RULES.quota.minErrors} أخطاء حصة أو أكثر خلال ${ALERT_RULES.quota.windowMin} دقيقة. تنتقل الطلبات إلى مزودين آخرين أو الوضع القائم على القواعد.`,
        investigate: `ai&provider=${encodeURIComponent(provider)}&range=24h`,
      });

  // 2. Elevated error rate.
  if (lastHour.length >= ALERT_RULES.errorRate.minAttempts) {
    const rate = lastHour.filter((r) => !r.success).length / lastHour.length;
    if (rate >= ALERT_RULES.errorRate.threshold)
      out.push({
        key: "ai.error_rate",
        severity: rate >= 0.6 ? "critical" : "warning",
        title_en: `AI error rate ${Math.round(rate * 100)}% in the last hour`,
        title_ar: `معدل أخطاء الذكاء الاصطناعي ${Math.round(rate * 100)}% خلال الساعة الأخيرة`,
        detail_en: `${lastHour.length} attempts. Threshold: ≥ ${ALERT_RULES.errorRate.threshold * 100}% with ≥ ${ALERT_RULES.errorRate.minAttempts} attempts.`,
        detail_ar: `${lastHour.length} محاولة. الحد: ${ALERT_RULES.errorRate.threshold * 100}% فأكثر مع ${ALERT_RULES.errorRate.minAttempts} محاولة على الأقل.`,
        investigate: "ai&range=24h",
      });
  }

  // 3. Sustained latency degradation: last-hour p95 vs the previous 7 days.
  const recentLat = lastHour
    .filter((r) => r.success && r.latency_ms !== null)
    .map((r) => r.latency_ms!)
    .sort((a, b) => a - b);
  const baseLat = input.aiRows
    .filter(
      (r) =>
        r.success &&
        r.latency_ms !== null &&
        t - new Date(r.created_at).getTime() > ALERT_RULES.latency.windowMin * 60_000,
    )
    .map((r) => r.latency_ms!)
    .sort((a, b) => a - b);
  if (
    recentLat.length >= ALERT_RULES.latency.minSamples &&
    baseLat.length >= ALERT_RULES.latency.minBaseline
  ) {
    const now95 = percentile(recentLat, 95)!;
    const base95 = percentile(baseLat, 95)!;
    if (base95 > 0 && now95 >= base95 * ALERT_RULES.latency.factor)
      out.push({
        key: "ai.latency_p95",
        severity: "warning",
        title_en: `AI p95 latency ${Math.round(now95)} ms (baseline ${Math.round(base95)} ms)`,
        title_ar: `زمن الاستجابة p95 ${Math.round(now95)} ملّي ث (الأساس ${Math.round(base95)})`,
        detail_en: `Last hour vs previous 7 days; threshold ×${ALERT_RULES.latency.factor} with ≥ ${ALERT_RULES.latency.minSamples} samples.`,
        detail_ar: `الساعة الأخيرة مقابل الأيام السبعة السابقة؛ الحد ×${ALERT_RULES.latency.factor} مع ${ALERT_RULES.latency.minSamples} عينة على الأقل.`,
        investigate: "ai&range=7d",
      });
  }

  // 4. Repeated failed assessment generations.
  const b = input.builder;
  const attempts = b.generated + b.failed;
  if (attempts >= ALERT_RULES.builder.minAttempts && b.failed / attempts >= ALERT_RULES.builder.threshold)
    out.push({
      key: "builder.failures",
      severity: "warning",
      title_en: `${b.failed} of ${attempts} assessment generations failed in 24 h`,
      title_ar: `فشل ${b.failed} من ${attempts} عمليات توليد تقييم خلال 24 ساعة`,
      detail_en: `Threshold: ≥ ${ALERT_RULES.builder.threshold * 100}% failures with ≥ ${ALERT_RULES.builder.minAttempts} attempts.`,
      detail_ar: `الحد: ${ALERT_RULES.builder.threshold * 100}% إخفاقات فأكثر مع ${ALERT_RULES.builder.minAttempts} محاولات على الأقل.`,
      investigate: "assessments&range=24h",
    });

  // 5. Monitoring event collection failures (telemetry writes that did not reach the database).
  if (input.telemetry.failures >= ALERT_RULES.telemetry.minFailures)
    out.push({
      key: "monitoring.telemetry_write",
      severity: "warning",
      title_en: `${input.telemetry.failures} AI telemetry writes failed on this server`,
      title_ar: `تعذّر حفظ ${input.telemetry.failures} من سجلات الذكاء الاصطناعي على هذا الخادم`,
      detail_en:
        "AI requests were served, but their monitoring records were not stored; figures may undercount.",
      detail_ar: "خُدمت الطلبات لكن سجلات المراقبة لم تُحفظ؛ قد تكون الأرقام أقل من الواقع.",
      investigate: "ai&range=24h",
    });
  return out;
}
