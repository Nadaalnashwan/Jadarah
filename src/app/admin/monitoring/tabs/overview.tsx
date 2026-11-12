import { LineSeries } from "@/components/app/charts";
import { SERIES } from "@/components/app/chart-colors";
import { KpiCard } from "@/components/ui/primitives";
import { formatNumber, tx } from "@/lib/i18n/config";
import { summarize } from "@/lib/monitoring/ai-metrics";
import { bucketLabel, monitoringHref } from "@/lib/monitoring/period";
import { demoIds, loadAiRows, platformOverview } from "@/services/monitoring";
import { DrillLink, ms, Panel, pct } from "@/features/monitoring/ui";
import type { TabProps } from "./types";

export async function OverviewTab({ supabase, period, demo, locale, params = {} }: TabProps) {
  const L = tx(locale);
  const n = (v: number) => formatNumber(v, locale);
  const excl = demo ? null : await demoIds(supabase);
  const [o, ai] = await Promise.all([
    platformOverview(supabase, period, excl),
    loadAiRows(supabase, period.from, period.to),
  ]);
  const aiRows = excl ? ai.rows.filter((r) => !r.user_id || !excl.users.has(r.user_id)) : ai.rows;
  const s = summarize(aiRows);
  const trend = o.trend.map((d) => ({
    label: bucketLabel(d.day, "day", locale),
    signups: d.signups,
    applications: d.applications,
  }));
  const scope = demo
    ? L("including demo records", "مع السجلات التجريبية")
    : L("excluding demo identities and companies", "دون الهويات والشركات التجريبية");
  const link = (tab: string, label: string) => (
    <DrillLink
      href={monitoringHref(
        { scope: params.scope, range: params.range, from: params.from, to: params.to },
        { tab },
      )}
    >
      {label}
    </DrillLink>
  );
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="ov-people">
        <h2 id="ov-people" className="text-subtle mb-3 text-xs font-bold tracking-wide uppercase">
          {L("People & organizations — current totals", "الأشخاص والجهات — الإجماليات الحالية")} · {scope}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={L("Registered accounts", "الحسابات المسجلة")}
            value={n(o.registered)}
            hint={`${n(o.candidates)} ${L("candidates", "مرشح")} · ${n(o.employers)} ${L("employer accounts", "حساب جهة")}`}
          />
          <KpiCard
            label={L("Organizations", "الجهات")}
            value={n(o.companies)}
            hint={`${n(o.pendingAccess)} ${L("access requests pending", "طلب وصول معلّق")}`}
          />
          <KpiCard
            label={L("Active paid subscriptions", "الاشتراكات المدفوعة النشطة")}
            value={n(o.activeSubs)}
            hint={`${n(o.demoSubs)} ${L("active demonstration subscriptions (not revenue)", "اشتراك تجريبي نشط (ليس إيرادًا)")}`}
          />
          <KpiCard
            label={L("Published jobs", "الوظائف المنشورة")}
            value={n(o.published)}
            hint={`${n(o.drafts)} ${L("drafts", "مسودة")}`}
          />
        </div>
      </section>
      <section aria-labelledby="ov-flow">
        <h2 id="ov-flow" className="text-subtle mb-3 text-xs font-bold tracking-wide uppercase">
          {L("Recruitment & assessments — current totals", "التوظيف والتقييمات — الإجماليات الحالية")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={L("Applications", "الطلبات")}
            value={n(o.applications)}
            hint={link("recruitment", L("Recruitment monitoring", "مراقبة التوظيف"))}
          />
          <KpiCard
            label={L("Assessments", "التقييمات")}
            value={n(o.assessmentsPublished)}
            hint={`${n(o.assessmentDrafts)} ${L("drafts awaiting approval", "مسودة بانتظار الاعتماد")}`}
          />
          <KpiCard
            tone={o.pendingReviews ? "peach" : undefined}
            label={L("Submitted answers", "الإجابات المقدّمة")}
            value={n(o.submissions)}
            hint={`${n(o.pendingReviews)} ${L("awaiting human review", "بانتظار المراجعة البشرية")}`}
          />
          <KpiCard label={L("Interviews", "المقابلات")} value={n(o.interviews)} />
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title={L("Sign-ups and applications per day", "التسجيلات والطلبات يوميًا")}
          sample={`${L(period.label_en, period.label_ar)} · ${n(trend.reduce((a, d) => a + d.signups, 0))} ${L("sign-ups", "تسجيل")} · ${n(trend.reduce((a, d) => a + d.applications, 0))} ${L("applications", "طلب")}`}
          definition={L(
            "Counted by Riyadh calendar day from account creation and application submission times",
            "تُحسب حسب يوم الرياض من وقت إنشاء الحساب وتقديم الطلب",
          )}
        >
          <LineSeries
            data={trend}
            xKey="label"
            series={[
              { key: "signups", name: L("Sign-ups", "التسجيلات"), color: SERIES.primary },
              { key: "applications", name: L("Applications", "الطلبات"), color: SERIES.secondary },
            ]}
          />
        </Panel>
        <Panel
          title={L("AI health in this period", "صحة الذكاء الاصطناعي في الفترة")}
          sample={`${n(s.attempts)} ${L("attempts", "محاولة")}`}
          action={link("ai", L("Details", "التفاصيل"))}
        >
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-subtle text-xs font-semibold">{L("Success rate", "معدل النجاح")}</dt>
              <dd className="ltr-nums text-2xl font-extrabold">{pct(s.successRate, locale, 1)}</dd>
            </div>
            <div>
              <dt className="text-subtle text-xs font-semibold">p95</dt>
              <dd className="ltr-nums text-2xl font-extrabold">{ms(s.latency.p95, locale)}</dd>
            </div>
            <div>
              <dt className="text-subtle text-xs font-semibold">
                {L("Failed attempts", "المحاولات الفاشلة")}
              </dt>
              <dd className="ltr-nums text-2xl font-extrabold">{n(s.failed)}</dd>
            </div>
            <div>
              <dt className="text-subtle text-xs font-semibold">
                {L("Providers used", "المزوّدون المستخدمون")}
              </dt>
              <dd className="ltr-nums text-2xl font-extrabold">{n(s.byProvider.length)}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
