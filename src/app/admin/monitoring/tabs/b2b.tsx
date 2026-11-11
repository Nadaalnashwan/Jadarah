import { LineSeries, StackedBars } from "@/components/app/charts";
import { SERIES } from "@/components/app/chart-colors";
import { KpiCard } from "@/components/ui/primitives";
import { formatNumber, tx } from "@/lib/i18n/config";
import { b2bMonitoring } from "@/services/monitoring";
import { MiniTable, Panel } from "@/features/monitoring/ui";
import type { TabProps } from "./types";

const STATUS_LABELS: Record<string, [string, string]> = {
  active: ["Active", "نشط"],
  pending: ["Pending", "معلّق"],
  suspended: ["Suspended", "موقوف"],
  expired: ["Expired", "منتهٍ"],
  cancelled: ["Cancelled", "ملغى"],
};

export async function B2bTab({ supabase, period, demo, locale }: Omit<TabProps, "params">) {
  const L = tx(locale);
  const n = (v: number) => formatNumber(v, locale);
  const sar = (v: number) => `${formatNumber(Math.round(v), locale)} ${L("SAR", "ر.س")}`;
  const b = await b2bMonitoring(supabase, period, demo);
  const limited = b.organizations - b.credits.unlimited > 0;
  const remaining = Math.max(0, b.credits.allocated - b.credits.usedLimited);
  const periodLabel = L(period.label_en, period.label_ar);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          tone="sand"
          label={L("Provisioned organizations", "الجهات المُفعّلة")}
          value={n(b.organizations)}
          hint={`${n(b.demonstration)} ${L("demonstration subscriptions", "اشتراك تجريبي")}`}
        />
        <KpiCard
          tone="sage"
          label={L("Paid revenue (recorded)", "الإيراد المحصّل (المسجّل)")}
          value={sar(b.revenue.received)}
          hint={`${n(b.revenue.payments)} ${L("payments, refunds subtracted", "دفعة، بعد خصم المبالغ المستردة")}`}
        />
        <KpiCard
          tone="blue"
          label={L("Contract value", "قيمة العقود")}
          value={sar(b.revenue.contract)}
          hint={L("Prices of non-demo subscriptions", "أسعار الاشتراكات غير التجريبية")}
        />
        <KpiCard
          tone={b.revenue.outstanding ? "peach" : undefined}
          label={L("Unpaid amount", "المبالغ غير المدفوعة")}
          value={sar(b.revenue.outstanding)}
          hint={L(
            "Contract minus recorded payments (waived excluded)",
            "قيمة العقد ناقص المدفوع (دون المعفاة)",
          )}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label={L("Assessment credits allocated", "أرصدة التقييم المخصصة")}
          value={limited ? n(b.credits.allocated) : "—"}
          hint={
            b.credits.unlimited
              ? `${n(b.credits.unlimited)} ${L("plans with unlimited credits", "خطة بأرصدة غير محدودة")}`
              : undefined
          }
        />
        <KpiCard
          label={L("Credits consumed", "الأرصدة المستهلكة")}
          value={n(b.credits.used)}
          hint={L("All plans", "كل الخطط")}
        />
        <KpiCard
          label={L("Credits remaining", "الأرصدة المتبقية")}
          value={limited ? n(remaining) : "—"}
          hint={
            limited
              ? L("Plans with a credit limit", "الخطط ذات الحد")
              : L("No plan has a credit limit", "لا توجد خطة بحد للأرصدة")
          }
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title={L("21 · Subscription status", "21 · حالة الاشتراكات")}
          sample={`${n(b.organizations)} ${L("subscriptions", "اشتراك")}`}
          empty={!b.organizations}
          emptyText={L("No subscriptions yet.", "لا توجد اشتراكات بعد.")}
          definition={L(
            "Demonstration subscriptions are shown separately and never counted as revenue.",
            "الاشتراكات التجريبية تُعرض منفصلة ولا تُحتسب إيرادًا.",
          )}
        >
          <StackedBars
            data={b.byStatus.map((s) => ({
              label: L(...STATUS_LABELS[s.status]),
              paying: s.paying,
              demo: s.demo,
            }))}
            xKey="label"
            series={[
              { key: "paying", name: L("Customer", "عميل"), color: SERIES.primary },
              { key: "demo", name: L("Demonstration", "تجريبي"), color: SERIES.warning },
            ]}
          />
        </Panel>
        <Panel
          className="xl:col-span-2"
          title={L("22 · Company activity", "22 · نشاط الشركات")}
          sample={`${periodLabel} · ${n(b.activity.length)} ${L("companies", "شركة")}`}
          empty={!b.activity.length}
          emptyText={L("No companies yet.", "لا توجد شركات بعد.")}
          definition={L(
            "Jobs created and applications received in the period.",
            "الوظائف المنشأة والطلبات المستلمة خلال الفترة.",
          )}
        >
          <StackedBars
            stacked={false}
            data={b.activity
              .slice(0, 15)
              .map((c) => ({
                label: locale === "ar" ? c.name_ar : c.name_en,
                jobs: c.jobs,
                applications: c.applications,
              }))}
            xKey="label"
            series={[
              { key: "jobs", name: L("Jobs created", "وظائف منشأة"), color: SERIES.primary },
              { key: "applications", name: L("Applications", "الطلبات"), color: SERIES.secondary },
            ]}
          />
        </Panel>
        <Panel
          className="xl:col-span-3"
          title={L("23 · Assessment credit consumption", "23 · استهلاك أرصدة التقييم")}
          sample={`${n(b.activity.length)} ${L("companies", "شركة")}`}
          empty={!b.activity.length}
          emptyText="—"
        >
          <MiniTable
            head={[
              L("Company", "الشركة"),
              L("Allocated", "المخصص"),
              L("Used", "المستهلك"),
              L("Remaining", "المتبقي"),
              L("Jobs", "الوظائف"),
              L("Applications", "الطلبات"),
            ]}
            empty="—"
            rows={b.activity.map((c) => [
              <span key="n">
                {locale === "ar" ? c.name_ar : c.name_en}
                {c.demo && <span className="text-subtle ms-2 text-xs">({L("demo", "تجريبي")})</span>}
              </span>,
              c.allocated === null ? L("Unlimited", "غير محدود") : n(c.allocated),
              n(c.used),
              c.allocated === null ? "—" : n(Math.max(0, c.allocated - c.used)),
              n(c.jobs),
              n(c.applications),
            ])}
          />
        </Panel>
        <Panel
          className="xl:col-span-2"
          title={L("24 · Recorded revenue over time", "24 · الإيراد المسجّل عبر الزمن")}
          sample={`${n(b.revenue.payments)} ${L("recorded payments (all time, by month)", "دفعة مسجّلة (كل الفترات، شهريًا)")}`}
          empty={!b.revenueByMonth.length}
          emptyText={L(
            "No payments have been recorded. Contract values are not revenue until a payment is recorded.",
            "لم تُسجَّل أي دفعات. قيم العقود ليست إيرادًا حتى تُسجَّل دفعة.",
          )}
        >
          <LineSeries
            data={b.revenueByMonth}
            xKey="month"
            unit=""
            series={[
              { key: "revenue", name: L("Net received (SAR)", "صافي المحصّل (ر.س)"), color: SERIES.success },
            ]}
          />
        </Panel>
        <Panel
          title={L("25 · Subscription activity", "25 · نشاط الاشتراكات")}
          sample={L("All time, by month", "كل الفترات، شهريًا")}
          empty={!b.subscriptionTrend.length}
          emptyText="—"
        >
          <StackedBars
            stacked={false}
            data={b.subscriptionTrend}
            xKey="month"
            series={[
              { key: "created", name: L("Provisioned", "أُنشئت"), color: SERIES.primary },
              { key: "activated", name: L("Activated", "فُعّلت"), color: SERIES.success },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
