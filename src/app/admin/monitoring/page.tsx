import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDateTime, tx, type Locale } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { evaluateAlerts } from "@/lib/monitoring/alerts";
import {
  includeDemo,
  monitoringHref,
  parsePeriod,
  tabOf,
  TABS,
  type MonitoringParams,
  type MonitoringTab,
  type Period,
} from "@/lib/monitoring/period";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { telemetryWriteFailures } from "@/services/ai/provider";
import { aiFilterOptions, loadAiRows } from "@/services/monitoring";
import { AiTab } from "./tabs/ai";
import { AssessmentsTab } from "./tabs/assessments";
import { B2bTab } from "./tabs/b2b";
import { EvaluationTab } from "./tabs/evaluation";
import { OverviewTab } from "./tabs/overview";
import { RecruitmentTab } from "./tabs/recruitment";

export const dynamic = "force-dynamic";

const TAB_LABELS: Record<MonitoringTab, [string, string]> = {
  overview: ["Platform overview", "نظرة عامة على المنصة"],
  ai: ["AI monitoring", "مراقبة الذكاء الاصطناعي"],
  assessments: ["Assessment monitoring", "مراقبة التقييمات"],
  recruitment: ["Recruitment monitoring", "مراقبة التوظيف"],
  b2b: ["B2B & subscriptions", "الاشتراكات والشركات"],
  evaluation: ["Evaluation & quality", "التقييم والجودة"],
};

export default async function MonitoringPage({ searchParams }: { searchParams: Promise<MonitoringParams> }) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const { locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const tab = tabOf(sp);
  const period = parsePeriod(sp);
  const demo = includeDemo(sp);
  // Filter options load in parallel (previously the AI options waited for the company list).
  const [{ data: companies }, ai] = await Promise.all([
    supabase.from("company_profiles").select("id, name_en, name_ar, is_demo").order("name_en"),
    tab === "ai" ? aiFilterOptions(supabase, new Date(period.to.getTime() - 90 * 86_400_000)) : Promise.resolve(null),
  ]);
  const companyOptions = (companies ?? []).filter((c) => demo || !c.is_demo);

  return (
    <>
      <PageHeader
        eyebrow={L("Super Admin", "المشرف العام")}
        title={L("Monitoring & evaluation", "المراقبة والتقييم")}
        description={L(
          "Live operational figures aggregated on the server from recorded events. Every figure states its period and sample",
          "أرقام تشغيلية حيّة تُجمَّع على الخادم من الأحداث المسجلة. كل رقم يوضح فترته وحجم عينته",
        )}
      />
      <Suspense fallback={null}>
        <AlertsPanel supabase={supabase} locale={locale} params={sp} />
      </Suspense>
      <nav
        aria-label={L("Monitoring sections", "أقسام المراقبة")}
        className="-mx-1 mb-4 overflow-x-auto px-1"
      >
        <ul className="flex min-w-max gap-1.5" role="list">
          {TABS.map((t) => (
            <li key={t}>
              <Link
                href={monitoringHref(
                  { ...sp, provider: undefined, model: undefined, operation: undefined },
                  { tab: t },
                )}
                aria-current={t === tab ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
                  t === tab
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-surface hover:bg-surface-2",
                )}
              >
                {L(...TAB_LABELS[t])}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <FilterBar params={sp} tab={tab} period={period} locale={locale} companies={companyOptions} ai={ai} />
      <div className="mt-6">
        {tab === "overview" && (
          <OverviewTab supabase={supabase} period={period} demo={demo} locale={locale} params={sp} />
        )}
        {tab === "ai" && (
          <AiTab supabase={supabase} period={period} demo={demo} locale={locale} params={sp} />
        )}
        {tab === "assessments" && (
          <AssessmentsTab supabase={supabase} period={period} demo={demo} locale={locale} params={sp} />
        )}
        {tab === "recruitment" && (
          <RecruitmentTab supabase={supabase} period={period} demo={demo} locale={locale} params={sp} />
        )}
        {tab === "b2b" && <B2bTab supabase={supabase} period={period} demo={demo} locale={locale} />}
        {tab === "evaluation" && (
          <EvaluationTab supabase={supabase} period={period} demo={demo} locale={locale} />
        )}
      </div>
    </>
  );
}

function FilterBar({
  params,
  tab,
  period,
  locale,
  companies,
  ai,
}: {
  params: MonitoringParams;
  tab: MonitoringTab;
  period: Period;
  locale: Locale;
  companies: { id: string; name_en: string; name_ar: string }[];
  ai: { providers: string[]; models: string[]; operations: string[] } | null;
}) {
  const L = tx(locale);
  const ranges: [string, string, string][] = [
    ["24h", "Last 24 hours", "آخر 24 ساعة"],
    ["7d", "Last 7 days", "آخر 7 أيام"],
    ["30d", "Last 30 days", "آخر 30 يومًا"],
    ["90d", "Last 90 days", "آخر 90 يومًا"],
    ["custom", "Custom range", "فترة مخصصة"],
  ];
  const showCompany = tab === "recruitment" || tab === "assessments";
  return (
    <form
      method="get"
      role="search"
      aria-label={L("Monitoring filters", "مرشحات المراقبة")}
      className="surface-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6"
    >
      <input type="hidden" name="tab" value={tab} />
      <Select name="range" defaultValue={params.range ?? period.range} aria-label={L("Period", "الفترة")}>
        {ranges.map(([v, en, ar]) => (
          <option key={v} value={v}>
            {L(en, ar)}
          </option>
        ))}
      </Select>
      <Input
        type="date"
        name="from"
        defaultValue={params.from}
        aria-label={L("From (custom range)", "من (فترة مخصصة)")}
      />
      <Input
        type="date"
        name="to"
        defaultValue={params.to}
        aria-label={L("To (custom range)", "إلى (فترة مخصصة)")}
      />
      {ai && (
        <>
          <Select name="provider" defaultValue={params.provider ?? ""} aria-label={L("Provider", "المزوّد")}>
            <option value="">{L("All providers", "كل المزوّدين")}</option>
            {ai.providers.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Select name="model" defaultValue={params.model ?? ""} aria-label={L("Model", "النموذج")}>
            <option value="">{L("All models", "كل النماذج")}</option>
            {ai.models.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Select
            name="operation"
            defaultValue={params.operation ?? ""}
            aria-label={L("Operation", "العملية")}
          >
            <option value="">{L("All operations", "كل العمليات")}</option>
            {ai.operations.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </>
      )}
      {showCompany && (
        <Select name="company" defaultValue={params.company ?? ""} aria-label={L("Company", "الشركة")}>
          <option value="">{L("All companies", "كل الشركات")}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {locale === "ar" ? c.name_ar : c.name_en}
            </option>
          ))}
        </Select>
      )}
      <Select name="scope" defaultValue={params.scope ?? ""} aria-label={L("Data scope", "نطاق البيانات")}>
        <option value="">{L("Live data (excl. demo)", "بيانات حقيقية (دون التجريبية)")}</option>
        <option value="all">{L("Include demo records", "تضمين السجلات التجريبية")}</option>
      </Select>
      <div className="flex items-center gap-2 lg:col-span-1">
        <Button type="submit" className="flex-1">
          {L("Apply", "تطبيق")}
        </Button>
        <Button asChild variant="ghost">
          <Link href={monitoringHref({ tab })}>{L("Clear", "مسح")}</Link>
        </Button>
      </div>
      <p className="text-subtle ltr-nums text-xs sm:col-span-2 lg:col-span-6">
        {L("Showing", "المعروض")}: {L(period.label_en, period.label_ar)} ·{" "}
        {formatDateTime(period.from.toISOString(), locale)} →{" "}
        {formatDateTime(period.to.toISOString(), locale)} {L("(Riyadh time)", "(بتوقيت الرياض)")}
      </p>
    </form>
  );
}

/**
 * Operational alerts: thresholds evaluated server-side on each visit; each active alert is raised as an in-app
 * notification to Super Admins at most once per cooldown (raise_monitoring_alert, proposal 0031). Without the
 * function the alert is still shown here — nothing is sent externally.
 */
async function AlertsPanel({
  supabase,
  locale,
  params,
}: {
  supabase: ServerSupabase;
  locale: Locale;
  params: MonitoringParams;
}) {
  const L = tx(locale);
  const now = new Date();
  const [{ rows }, builder] = await Promise.all([
    loadAiRows(supabase, new Date(now.getTime() - 7 * 86_400_000), now),
    supabase
      .from("ai_generation_records")
      .select("output")
      .eq("kind", "assessment")
      .gte("created_at", new Date(now.getTime() - 86_400_000).toISOString()),
  ]);
  const events = (builder.data ?? []).map(
    (r) => (r.output as { event?: string; assessment_id?: string } | null) ?? {},
  );
  const alerts = evaluateAlerts({
    now,
    aiRows: rows,
    builder: {
      generated: events.filter((e) => e.event === "generated" || (!e.event && e.assessment_id)).length,
      failed: events.filter((e) => e.event === "failed").length,
    },
    telemetry: telemetryWriteFailures(),
  });
  let notified: "yes" | "unavailable" | "none" = "none";
  // Raise every alert in parallel (was one round trip per alert in sequence).
  const raised = await Promise.all(
    alerts.map((a) =>
      supabase.rpc(
        "raise_monitoring_alert" as never,
        { p_key: a.key, p_title_en: a.title_en, p_title_ar: a.title_ar, p_cooldown_minutes: 360 } as never,
      ),
    ),
  );
  if (raised.length) notified = raised.some((r) => r.error) ? "unavailable" : "yes";
  if (!alerts.length)
    return (
      <p className="text-subtle mb-4 flex items-center gap-2 text-xs">
        <Badge tone="positive" dot>
          {L("No active alerts", "لا توجد تنبيهات نشطة")}
        </Badge>
        {L("Checked now against the alert thresholds", "تم الفحص الآن وفق حدود التنبيه")}
      </p>
    );
  return (
    <Card
      tone="peach"
      className="mb-4 p-4 sm:p-5"
      role="region"
      aria-label={L("Active alerts", "التنبيهات النشطة")}
    >
      <h2 className="text-sm font-bold">{L("Active alerts", "التنبيهات النشطة")}</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {alerts.map((a) => (
          <li
            key={a.key}
            className="bg-surface flex flex-col gap-1 rounded-xl px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold">
                <Badge tone={a.severity === "critical" ? "negative" : "progress"} className="me-2">
                  {a.severity === "critical" ? L("Critical", "حرج") : L("Warning", "تحذير")}
                </Badge>
                {L(a.title_en, a.title_ar)}
              </p>
              <p className="text-subtle mt-0.5 text-xs">{L(a.detail_en, a.detail_ar)}</p>
            </div>
            <Link
              href={monitoringHref(
                { scope: params.scope },
                Object.fromEntries(new URLSearchParams(`tab=${a.investigate}`)),
              )}
              className="text-primary shrink-0 text-xs font-semibold underline-offset-4 hover:underline"
            >
              {L("Investigate", "تحقق")}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-subtle mt-2 text-xs">
        {notified === "yes"
          ? L(
              "Super Admins are notified in-app at most once every 6 hours per alert",
              "يُشعَر المشرفون داخل المنصة مرة واحدة كل 6 ساعات لكل تنبيه كحد أقصى",
            )
          : L(
              "In-app notifications for alerts need proposal 0031; alerts are shown here only",
              "إشعارات التنبيهات داخل المنصة تتطلب المقترح 0031؛ تُعرض التنبيهات هنا فقط",
            )}
      </p>
    </Card>
  );
}
