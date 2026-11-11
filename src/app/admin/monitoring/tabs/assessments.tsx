import { Donut, LineSeries, StackedBars } from "@/components/app/charts";
import { SERIES } from "@/components/app/chart-colors";
import { KpiCard } from "@/components/ui/primitives";
import { formatNumber, tx } from "@/lib/i18n/config";
import { percentile } from "@/lib/monitoring/ai-metrics";
import { bucketLabel } from "@/lib/monitoring/period";
import { builderMonitoring, demoIds } from "@/services/monitoring";
import { Funnel, MiniTable, ms, Panel, pct } from "@/features/monitoring/ui";
import type { TabProps } from "./types";

export const CHECK_LABELS: Record<string, [string, string]> = {
  skill_coverage: ["Required skill coverage", "تغطية المهارات المطلوبة"],
  task_count: ["Number of tasks", "عدد المهام"],
  deliverable_clarity: ["Deliverable clarity", "وضوح المخرجات"],
  time_feasibility: ["Time feasibility", "واقعية الوقت"],
  input_availability: ["Inputs provided", "توفر المدخلات"],
  rubric_alignment: ["Rubric alignment", "اتساق معايير التقييم"],
  scoring_consistency: ["Scoring consistency", "اتساق الدرجات"],
  originality: ["Originality vs references", "الأصالة مقارنة بالمراجع"],
  no_assessor_leakage: ["No assessor-guide leakage", "عدم تسرب دليل المقيّم"],
  no_legacy_branding: ["No legacy branding", "عدم وجود علامة قديمة"],
  dataset_validity: ["Valid datasets", "صحة البيانات المرفقة"],
};

export async function AssessmentsTab({ supabase, period, demo, locale, params = {} }: TabProps) {
  const L = tx(locale);
  const n = (v: number) => formatNumber(v, locale);
  const excl = demo ? null : await demoIds(supabase);
  const b = await builderMonitoring(supabase, period, excl?.companies ?? null, params.company || null);
  const sample = `${L(period.label_en, period.label_ar)} · ${n(b.attempts)} ${L("generation attempts", "محاولة توليد")}`;
  const durSorted = [...b.durations].sort((x, y) => x - y);
  const trend = b.trend.map((d) => ({
    label: bucketLabel(d.day, "day", locale),
    generated: d.generated,
    failed: d.failed,
  }));
  const byModel = b.durationByModel.map((m) => ({
    model: m.model,
    p50: percentile(m.ms, 50),
    p95: percentile(m.ms, 95),
    samples: m.samples,
  }));
  const checks = b.checks.map((c) => ({
    label: L(...(CHECK_LABELS[c.check] ?? [c.check, c.check])),
    passed: c.passed,
    failed: c.total - c.passed,
  }));
  const lc = b.lifecycle;
  const emptyText = L(
    "No Assessment Builder activity in this period.",
    "لا يوجد نشاط لمنشئ التقييمات في هذه الفترة.",
  );
  return (
    <div className="flex flex-col gap-6">
      {b.generationsAccess === "rls_only" && (
        <p className="bg-warning-soft text-warning rounded-xl px-4 py-2 text-sm">
          {L(
            "Draft records are readable only by each company's recruiters. Apply proposal 0031 (metadata-only monitoring function) to include them; figures below that depend on drafts are incomplete.",
            "سجلات المسودات متاحة فقط لمسؤولي التوظيف في كل شركة. طبّق المقترح 0031 (دالة مراقبة للبيانات الوصفية فقط) لتضمينها؛ الأرقام المعتمدة على المسودات أدناه غير مكتملة.",
          )}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          tone="blue"
          label={L("Generation attempts", "محاولات التوليد")}
          value={n(b.attempts)}
          hint={`${n(b.generatedEvents)} ${L("succeeded", "نجحت")} · ${n(b.failedEvents)} ${L("failed", "فشلت")} (${pct(b.attempts ? b.failedEvents / b.attempts : null, locale)})`}
        />
        <KpiCard
          tone="mist"
          label={L("Generation duration p50", "مدة التوليد p50")}
          value={ms(percentile(durSorted, 50), locale)}
          hint={
            b.instrumentedSamples
              ? `p95 ${ms(percentile(durSorted, 95), locale)} · n=${n(b.instrumentedSamples)}`
              : L("Recorded for generations after this release", "تُسجَّل لعمليات التوليد بعد هذا الإصدار")
          }
        />
        <KpiCard
          tone="sage"
          label={L("Drafts passing every check", "مسودات اجتازت كل الفحوص")}
          value={lc.generated ? pct(lc.validated / lc.generated, locale) : "—"}
          hint={`${n(lc.validated)}/${n(lc.generated)} ${L("drafts", "مسودة")}`}
        />
        <KpiCard
          tone="sand"
          label={L("Human corrections", "التعديلات البشرية")}
          value={b.instrumentedSamples || b.humanEdits ? n(b.humanEdits) : "—"}
          hint={
            b.instrumentedSamples || b.humanEdits
              ? `${n(b.editedAssessments)} ${L("drafts edited", "مسودة عُدّلت")} · ${n(b.regenerated)} ${L("sections regenerated", "قسمًا أعيد توليده")}`
              : L(
                  "Recorded for drafts generated from this release on",
                  "تُسجَّل للمسودات المولّدة من هذا الإصدار",
                )
          }
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={L("Reference retrieval", "استرجاع المراجع")}
          value={
            b.retrieval.ok + b.retrieval.none + b.retrieval.failed
              ? pct(b.retrieval.ok / (b.retrieval.ok + b.retrieval.none + b.retrieval.failed), locale)
              : "—"
          }
          hint={`${n(b.retrieval.ok)} ${L("found references", "وجدت مراجع")} · ${n(b.retrieval.none)} ${L("none matched", "بلا تطابق")} · ${n(b.retrieval.failed)} ${L("errors", "أخطاء")}`}
        />
        <KpiCard
          label={L("References used", "المراجع المستخدمة")}
          value={n(b.retrieval.references)}
          hint={`${n(b.retrieval.generationsWithRefs)}/${n(lc.generated)} ${L("drafts used at least one", "مسودة استخدمت مرجعًا واحدًا على الأقل")}`}
        />
        <KpiCard
          label={L("Automatic repair", "الإصلاح التلقائي")}
          value={b.instrumentedSamples ? n(b.repair.attempted) : "—"}
          hint={`${n(b.repair.accepted)} ${L("repairs kept (fewer failed checks)", "إصلاحًا اعتُمد (فحوص فاشلة أقل)")}`}
        />
        <KpiCard
          label={L("Approved / rejected", "المعتمدة / المرفوضة")}
          value={`${n(lc.approved)} / ${n(lc.rejected)}`}
          hint={`${n(lc.published)} ${L("published", "منشورة")}`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title={L("8 · Generation success trend", "8 · اتجاه نجاح التوليد")}
          sample={sample}
          empty={!b.attempts}
          emptyText={emptyText}
          definition={L(
            "Successful = a draft was saved; failed = generation ended without a draft (recorded from this release on).",
            "الناجحة = حُفظت مسودة؛ الفاشلة = انتهى التوليد دون مسودة (تُسجَّل من هذا الإصدار).",
          )}
        >
          <StackedBars
            data={trend}
            xKey="label"
            series={[
              { key: "generated", name: L("Succeeded", "نجحت"), color: SERIES.success },
              { key: "failed", name: L("Failed", "فشلت"), color: SERIES.failure },
            ]}
          />
        </Panel>
        <Panel
          title={L("11 · Assessment lifecycle", "11 · دورة حياة التقييم")}
          sample={`${n(lc.generated)} ${L("drafts generated in the period", "مسودة وُلِّدت في الفترة")}`}
          empty={!lc.generated}
          emptyText={emptyText}
          definition={L(
            "Validated = passed every automatic check; reviewed = edited by a person or decided; published = the resulting Assessment is live.",
            "المتحقق منها = اجتازت كل الفحوص الآلية؛ المراجَعة = عدّلها شخص أو اتُّخذ فيها قرار؛ المنشورة = التقييم الناتج متاح.",
          )}
        >
          <Funnel
            locale={locale}
            steps={[
              { label: L("Generated", "وُلِّدت"), value: lc.generated },
              { label: L("Validated", "تحقق منها"), value: lc.validated },
              { label: L("Reviewed", "رُوجعت"), value: lc.reviewed },
              { label: L("Approved", "اعتُمدت"), value: lc.approved },
              { label: L("Published", "نُشرت"), value: lc.published },
            ]}
          />
        </Panel>
        <Panel
          className="xl:col-span-2"
          title={L("10 · Quality checks", "10 · فحوص الجودة")}
          sample={`${n(lc.generated)} ${L("drafts — latest validation of each", "مسودة — آخر تحقق لكل منها")}`}
          empty={!checks.length}
          emptyText={emptyText}
          definition={L(
            "Rule-based checks run on every draft. They verify structure and coverage; they do not prove an assessment is valid or fair.",
            "فحوص آلية قائمة على القواعد تُجرى على كل مسودة. تتحقق من البنية والتغطية ولا تثبت صلاحية التقييم أو عدالته.",
          )}
        >
          <StackedBars
            horizontal
            height="h-96"
            data={checks}
            xKey="label"
            series={[
              { key: "passed", name: L("Passed", "اجتاز"), color: SERIES.success },
              { key: "failed", name: L("Failed", "لم يجتز"), color: SERIES.failure },
            ]}
          />
        </Panel>
        <Panel
          title={L("9 · Generation duration by model", "9 · مدة التوليد حسب النموذج")}
          sample={`${n(byModel.reduce((a, m) => a + m.samples, 0))} ${L("successful builder calls", "استدعاء ناجح للمنشئ")}`}
          empty={!byModel.length}
          emptyText={emptyText}
          definition={L(
            "Latency of successful Assessment Builder provider calls (all companies).",
            "زمن استدعاءات المزوّد الناجحة لمنشئ التقييمات (كل الشركات).",
          )}
        >
          <MiniTable
            head={[L("Model", "النموذج"), "n", "p50", "p95"]}
            empty={emptyText}
            rows={byModel.map((m) => [m.model, n(m.samples), ms(m.p50, locale), ms(m.p95, locale)])}
          />
          {byModel.length > 0 && (
            <LineSeries
              height="h-40"
              data={byModel.map((m) => ({ model: m.model, p50: m.p50, p95: m.p95 }))}
              xKey="model"
              unit=" ms"
              series={[
                { key: "p50", name: "p50", color: SERIES.p50 },
                { key: "p95", name: "p95", color: SERIES.p95, dashed: true },
              ]}
            />
          )}
        </Panel>
        <Panel
          className="xl:col-span-2"
          title={L("12 · Assessments by company", "12 · التقييمات حسب الشركة")}
          sample={`${n(b.byCompany.length)} ${L("companies", "شركة")}`}
          empty={!b.byCompany.length}
          emptyText={emptyText}
        >
          <StackedBars
            stacked={false}
            data={b.byCompany.map((c) => ({
              label: locale === "ar" ? c.name_ar : c.name_en,
              generated: c.generated,
              approved: c.approved,
              published: c.published,
            }))}
            xKey="label"
            series={[
              { key: "generated", name: L("Generated", "وُلِّدت"), color: SERIES.primary },
              { key: "approved", name: L("Approved", "اعتُمدت"), color: SERIES.secondary },
              { key: "published", name: L("Published", "نُشرت"), color: SERIES.success },
            ]}
          />
        </Panel>
        <Panel
          title={L("13 · Reference library health", "13 · سلامة مكتبة المراجع")}
          sample={`${n(b.references.total)} ${L("references", "مرجع")} · ${n(b.references.embedded)} ${L("embedded chunks", "مقطعًا مُضمَّنًا")}`}
          empty={!b.references.total}
          emptyText={L("The reference library is empty.", "مكتبة المراجع فارغة.")}
          definition={L(
            "Validation status of the private reference library (contents are never shown here).",
            "حالة التحقق لمكتبة المراجع الخاصة (لا تُعرض محتوياتها هنا).",
          )}
        >
          <Donut
            centerLabel={L("references", "مرجع")}
            data={[
              { key: "v", label: L("Validated", "متحقق منها"), value: b.references.validated },
              { key: "r", label: L("Needs review", "بحاجة لمراجعة"), value: b.references.needsReview },
              { key: "i", label: L("Incomplete", "غير مكتملة"), value: b.references.incomplete },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
