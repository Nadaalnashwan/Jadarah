import Link from "next/link";
import { BarList, Donut, LineSeries, StackedBars } from "@/components/app/charts";
import { SERIES } from "@/components/app/chart-colors";
import { Badge, Card, KpiCard } from "@/components/ui/primitives";
import { formatDateTime, formatNumber, tx } from "@/lib/i18n/config";
import {
  correlate,
  errorCategory,
  fallbackSummary,
  summarize,
  timeSeries,
  P99_MIN_SAMPLES,
  type ErrorCategory,
} from "@/lib/monitoring/ai-metrics";
import { bucketLabel, monitoringHref } from "@/lib/monitoring/period";
import { aiStatus } from "@/services/ai/provider";
import { demoIds, loadAiRows } from "@/services/monitoring";
import { MiniTable, ms, Panel, pct } from "@/features/monitoring/ui";
import type { TabProps } from "./types";

const LOG_PAGE = 20;

const ERROR_LABELS: Record<ErrorCategory, [string, string]> = {
  quota: ["Quota exhausted", "نفاد الحصة"],
  rate_limit: ["Rate limited", "تجاوز حد الطلبات"],
  timeout: ["Timeout", "انتهاء المهلة"],
  availability: ["Provider unavailable / overloaded", "المزوّد غير متاح أو مثقل"],
  schema: ["Schema validation", "عدم مطابقة المخطط"],
  auth: ["Authentication", "المصادقة"],
  request: ["Invalid request", "طلب غير صالح"],
  other: ["Other", "أخرى"],
};

export async function AiTab({ supabase, period, demo, locale, params = {} }: TabProps) {
  const L = tx(locale);
  const n = (v: number) => formatNumber(v, locale);
  const [{ rows: raw, truncated, traced }, excl] = await Promise.all([
    loadAiRows(supabase, period.from, period.to, {
      provider: params.provider,
      model: params.model,
      operation: params.operation,
    }),
    demo ? Promise.resolve(null) : demoIds(supabase),
  ]);
  const rows = excl ? raw.filter((r) => !r.user_id || !excl.users.has(r.user_id)) : raw;
  const s = summarize(rows);
  const series = timeSeries(rows, period.from, period.to, period.bucket).map((p) => ({
    label: bucketLabel(p.start, period.bucket, locale),
    attempts: p.attempts,
    success: p.success,
    failed: p.failed,
    p50: p.p50,
    p95: p.p95,
    input: p.inputTokens,
    output: p.outputTokens,
  }));
  const ops = correlate(rows);
  const fb = fallbackSummary(ops);
  const status = aiStatus();
  const count = (c: ErrorCategory) => s.errors.find((e) => e.key === c)?.count ?? 0;
  const sample = `${L("Period", "الفترة")}: ${L(period.label_en, period.label_ar)} · ${n(s.attempts)} ${L("attempts", "محاولة")}`;
  const empty = s.attempts === 0;
  const emptyText = L(
    "No AI attempts were recorded for these filters",
    "لم تُسجَّل محاولات ذكاء اصطناعي لهذه المرشحات",
  );

  // Individual attempts, paginated separately from the aggregates.
  const page = Math.max(1, Number(params.page) || 1);
  let lq = supabase
    .from("ai_provider_logs")
    .select(
      "id, provider, model, operation, latency_ms, input_tokens, output_tokens, success, error_code, created_at",
      { count: "exact" },
    )
    .gte("created_at", period.from.toISOString())
    .lt("created_at", period.to.toISOString());
  if (params.provider) lq = lq.eq("provider", params.provider);
  if (params.model) lq = lq.eq("model", params.model);
  if (params.operation) lq = lq.eq("operation", params.operation);
  if (excl?.users.size) lq = lq.or(`user_id.is.null,user_id.not.in.(${[...excl.users].join(",")})`);
  const { data: logs, count: logCount } = await lq
    .order("created_at", { ascending: false })
    .range((page - 1) * LOG_PAGE, page * LOG_PAGE - 1);
  const pages = Math.max(1, Math.ceil((logCount ?? 0) / LOG_PAGE));

  return (
    <div className="flex flex-col gap-6">
      {truncated && (
        <p className="bg-warning-soft text-warning rounded-xl px-4 py-2 text-sm">
          {L(
            "The period has more than 50,000 attempts; narrow it for complete figures",
            "تتجاوز الفترة 50٬000 محاولة؛ ضيّقها للحصول على أرقام كاملة",
          )}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={L("AI attempts", "محاولات الذكاء الاصطناعي")}
          value={n(s.attempts)}
          hint={`${n(fb.operations)} ${L("logical requests", "طلبًا منطقيًا")}`}
        />
        <KpiCard
          label={L("Success rate", "معدل النجاح")}
          value={pct(s.successRate, locale, 1)}
          hint={`${n(s.success)} ${L("succeeded", "نجحت")} · ${n(s.failed)} ${L("failed", "فشلت")} (${pct(s.attempts ? s.failed / s.attempts : null, locale, 1)})`}
        />
        <KpiCard
          label={L("Latency p50 / p95", "زمن الاستجابة p50 / p95")}
          value={`${ms(s.latency.p50, locale)} / ${ms(s.latency.p95, locale)}`}
          hint={`${L("avg", "المتوسط")} ${ms(s.latency.avg, locale)} · p99 ${
            s.latency.p99 === null
              ? L(`needs ≥ ${P99_MIN_SAMPLES} samples`, `يتطلب ${P99_MIN_SAMPLES} عينة`)
              : ms(s.latency.p99, locale)
          } · n=${n(s.latency.samples)}`}
        />
        <KpiCard
          label={L("Tokens (input / output)", "الرموز (مدخلة / مخرجة)")}
          value={`${n(s.tokens.input)} / ${n(s.tokens.output)}`}
          hint={`${L("total", "الإجمالي")} ${n(s.tokens.total)} · ${L("reported on", "مُبلَّغ عنها في")} ${n(s.tokens.samples)}/${n(s.attempts)}`}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {(["quota", "rate_limit", "timeout", "availability", "schema"] as ErrorCategory[]).map((c) => (
          <KpiCard
            key={c}
            label={L(...ERROR_LABELS[c])}
            value={n(count(c))}
            tone={count(c) ? "peach" : undefined}
            hint={L("failed attempts", "محاولات فاشلة")}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title={L("1 · AI requests over time", "1 · طلبات الذكاء الاصطناعي عبر الزمن")}
          sample={sample}
          empty={empty}
          emptyText={emptyText}
          definition={L(
            "Attempts per bucket (each provider call, including retries and fallbacks). Empty buckets are zero, not interpolated",
            "المحاولات في كل فترة (كل استدعاء للمزوّد بما فيه إعادة المحاولة والبدائل). الفترات الفارغة صفر دون استيفاء",
          )}
        >
          <LineSeries
            data={series}
            xKey="label"
            series={[{ key: "attempts", name: L("Attempts", "المحاولات"), color: SERIES.primary }]}
          />
        </Panel>
        <Panel
          title={L("2 · Provider usage", "2 · استخدام المزوّدين")}
          sample={sample}
          empty={empty}
          emptyText={emptyText}
        >
          <Donut
            data={s.byProvider.map((p) => ({ key: p.key, label: p.key, value: p.attempts }))}
            centerLabel={L("attempts", "محاولة")}
          />
        </Panel>
        <Panel
          className="xl:col-span-2"
          title={L("3 · Success vs failure", "3 · النجاح مقابل الفشل")}
          sample={sample}
          empty={empty}
          emptyText={emptyText}
        >
          <StackedBars
            data={series}
            xKey="label"
            series={[
              { key: "success", name: L("Succeeded", "نجحت"), color: SERIES.success },
              { key: "failed", name: L("Failed", "فشلت"), color: SERIES.failure },
            ]}
          />
        </Panel>
        <Panel
          title={L("6 · Error breakdown", "6 · تصنيف الأخطاء")}
          sample={`${n(s.failed)} ${L("failed attempts", "محاولة فاشلة")}`}
          empty={!s.failed}
          emptyText={L("No failed attempts in this period", "لا توجد محاولات فاشلة في هذه الفترة")}
          definition={L(
            "Categorised from the recorded provider error code",
            "مصنّفة حسب رمز الخطأ المسجل من المزوّد",
          )}
        >
          <BarList
            data={s.errors.map((e) => ({ key: e.key, label: L(...ERROR_LABELS[e.key]), value: e.count }))}
          />
        </Panel>
        <Panel
          className="xl:col-span-2"
          title={L("4 · Response latency (p50 / p95)", "4 · زمن الاستجابة (p50 / p95)")}
          sample={`n=${n(s.latency.samples)} ${L("attempts with a recorded latency", "محاولة بزمن مسجل")}`}
          empty={!s.latency.samples}
          emptyText={emptyText}
          definition={L(
            "Nearest-rank percentiles per bucket over every attempt with a latency (successful and failed). Buckets without attempts are gaps",
            "مئينات بأسلوب الرتبة الأقرب لكل فترة على كل محاولة لها زمن (ناجحة وفاشلة). الفترات بلا محاولات تظهر فراغًا",
          )}
        >
          <LineSeries
            data={series}
            xKey="label"
            unit=" ms"
            series={[
              { key: "p50", name: "p50", color: SERIES.p50 },
              { key: "p95", name: "p95", color: SERIES.p95, dashed: true },
            ]}
          />
        </Panel>
        <Panel
          title={L("7 · Fallback performance", "7 · أداء البدائل")}
          sample={`${n(fb.operations)} ${L("logical requests", "طلبًا منطقيًا")}`}
          empty={!fb.operations}
          emptyText={emptyText}
          definition={
            traced && fb.exactShare === 1
              ? L("Attempts grouped exactly by request id", "تُجمع المحاولات بدقة حسب معرّف الطلب")
              : L(
                  `Attempts with a request id are grouped exactly (${pct(fb.exactShare, locale)} of requests); older attempts are grouped by user and operation within 2 minutes of a failed attempt — approximate`,
                  `تُجمع المحاولات ذات معرّف الطلب بدقة (${pct(fb.exactShare, locale)} من الطلبات)؛ والأقدم تُجمع حسب المستخدم والعملية خلال دقيقتين من محاولة فاشلة — تقريبي`,
                )
          }
        >
          <BarList
            data={[
              {
                key: "ok",
                label: L("Succeeded on the first attempt", "نجحت من المحاولة الأولى"),
                value: fb.firstTry,
              },
              {
                key: "pf",
                label: L("Primary attempt failed", "فشلت المحاولة الأولى"),
                value: fb.primaryFailures,
              },
              {
                key: "rr",
                label: L("Recovered by retrying the same model", "تعافت بإعادة المحاولة"),
                value: fb.recoveredRetry,
              },
              {
                key: "rf",
                label: L("Recovered by a fallback model", "تعافت عبر نموذج بديل"),
                value: fb.recoveredFallback,
              },
              { key: "ff", label: L("Failed completely", "فشلت كليًا"), value: fb.failed },
            ]}
          />
        </Panel>
        <Panel
          className="xl:col-span-2"
          title={L("5 · Token consumption", "5 · استهلاك الرموز")}
          sample={`${n(s.tokens.samples)}/${n(s.attempts)} ${L("attempts reported tokens", "محاولة أبلغت عن الرموز")}`}
          empty={!s.tokens.samples}
          emptyText={L(
            "Providers reported no token usage for these attempts",
            "لم يبلّغ المزوّدون عن استهلاك رموز لهذه المحاولات",
          )}
          definition={L(
            "Sums of provider-reported input and output tokens. No cost is estimated",
            "مجموع الرموز المدخلة والمخرجة كما أبلغ المزوّد. لا تُقدَّر أي تكلفة",
          )}
        >
          <StackedBars
            data={series}
            xKey="label"
            series={[
              { key: "input", name: L("Input", "مدخلة"), color: SERIES.primary },
              { key: "output", name: L("Output", "مخرجة"), color: SERIES.secondary },
            ]}
          />
        </Panel>
        <Panel
          title={L("Configured routing", "التوجيه المضبوط")}
          definition={L(
            "Keys stay on the server; only their presence is shown",
            "المفاتيح تبقى على الخادم؛ يُعرض وجودها فقط",
          )}
        >
          <ul className="flex flex-col gap-2 text-sm">
            {status.providers.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-2">
                <span className="font-semibold">{p.name}</span>
                <Badge tone={p.configured ? "positive" : "muted"}>
                  {p.configured ? L("Configured", "مضبوط") : L("Not configured", "غير مضبوط")}
                </Badge>
              </li>
            ))}
            {(["fast", "structured", "deep"] as const).map((r) => (
              <li key={r} className="text-subtle flex justify-between gap-2 text-xs">
                <span>{r}</span>
                <span>
                  {status.routes[r]
                    ? `${status.routes[r]!.provider} · ${status.routes[r]!.model}`
                    : L("rule-based", "قائم على القواعد")}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={L("Models", "النماذج")} sample={sample}>
          <MiniTable
            head={[
              L("Provider · model", "المزوّد · النموذج"),
              L("Attempts", "المحاولات"),
              L("Success", "النجاح"),
              "p50",
            ]}
            empty={emptyText}
            rows={s.byModel.map((m) => [
              m.key,
              n(m.attempts),
              pct(m.success / m.attempts, locale),
              ms(m.p50, locale),
            ])}
          />
        </Panel>
        <Panel title={L("Operations", "العمليات")} sample={sample}>
          <MiniTable
            head={[L("Operation", "العملية"), L("Attempts", "المحاولات"), L("Success", "النجاح"), ""]}
            empty={emptyText}
            rows={s.byOperation.map((o) => [
              o.key,
              n(o.attempts),
              pct(o.success / o.attempts, locale),
              <Link
                key={o.key}
                className="text-primary text-xs font-semibold"
                href={monitoringHref({ ...params, page: undefined }, { operation: o.key })}
              >
                {L("Filter", "تصفية")}
              </Link>,
            ])}
          />
        </Panel>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-bold">{L("Individual attempts", "المحاولات الفردية")}</h3>
          <p className="text-subtle ltr-nums text-xs">
            {n(logCount ?? 0)} {L("in period", "في الفترة")} · {L("page", "صفحة")} {n(page)}/{n(pages)}
          </p>
        </div>
        <MiniTable
          head={[
            L("Time", "الوقت"),
            L("Operation", "العملية"),
            L("Provider · model", "المزوّد · النموذج"),
            L("Latency", "الزمن"),
            L("Tokens", "الرموز"),
            L("Result", "النتيجة"),
          ]}
          empty={emptyText}
          align={["start", "start", "start", "end", "end", "end"]}
          rows={(logs ?? []).map((l) => [
            formatDateTime(l.created_at, locale),
            l.operation,
            `${l.provider} · ${l.model ?? "—"}`,
            ms(l.latency_ms, locale),
            l.input_tokens === null && l.output_tokens === null
              ? "—"
              : n((l.input_tokens ?? 0) + (l.output_tokens ?? 0)),
            l.success ? (
              <Badge key="s" tone="positive">
                {L("Success", "نجاح")}
              </Badge>
            ) : (
              <Badge
                key="f"
                tone="negative"
              >{`${L(...ERROR_LABELS[errorCategory(l.error_code)])}${l.error_code ? ` · ${l.error_code}` : ""}`}</Badge>
            ),
          ])}
        />
        {pages > 1 && (
          <nav className="mt-3 flex justify-end gap-2" aria-label={L("Log pages", "صفحات السجل")}>
            {page > 1 && (
              <Link
                className="bg-surface-2 rounded-full px-3 py-1.5 text-xs font-semibold"
                href={monitoringHref(params, { page: String(page - 1) })}
              >
                {L("Previous", "السابق")}
              </Link>
            )}
            {page < pages && (
              <Link
                className="bg-surface-2 rounded-full px-3 py-1.5 text-xs font-semibold"
                href={monitoringHref(params, { page: String(page + 1) })}
              >
                {L("Next", "التالي")}
              </Link>
            )}
          </nav>
        )}
        <p className="text-subtle mt-3 text-xs">
          {L(
            "Logs contain no prompts, CV text or answers — only provider, model, operation, timing, token counts and error codes",
            "لا تحتوي السجلات على أي مطالبات أو نصوص سير ذاتية أو إجابات — فقط المزوّد والنموذج والعملية والتوقيت وعدد الرموز ورموز الأخطاء",
          )}
        </p>
      </Card>
    </div>
  );
}
