import { Columns, Donut, LineSeries, StackedBars } from "@/components/app/charts";
import { SERIES } from "@/components/app/chart-colors";
import { KpiCard } from "@/components/ui/primitives";
import { formatNumber, tx, type Locale } from "@/lib/i18n/config";
import { bucketLabel, type Period } from "@/lib/monitoring/period";
import type { interviewAttendance, recruitmentMonitoring } from "@/services/monitoring";
import { Funnel, MiniTable, Panel, pct } from "./ui";

type Data = Awaited<ReturnType<typeof recruitmentMonitoring>>;
type Attendance = Awaited<ReturnType<typeof interviewAttendance>>;

const STAGE_LABELS: Record<string, [string, string]> = {
  "submitted→assessment_completed": ["Application → assessment completed", "التقديم → إكمال التقييم"],
  "assessment_completed→shortlisted": [
    "Assessment completed → shortlisted",
    "إكمال التقييم → القائمة المختصرة",
  ],
  "shortlisted→interview_scheduled": [
    "Shortlisted → interview scheduled",
    "القائمة المختصرة → جدولة المقابلة",
  ],
  "submitted→hired": ["Application → hired (time to hire)", "التقديم → التعيين (مدة التوظيف)"],
};

/** Recruitment monitoring (charts 14–20 + interviews). Used by Super Admin (platform or one company) and by a
 * company for its own data — the caller's session and RLS decide which rows exist. */
export function RecruitmentView({
  d,
  att,
  period,
  locale,
}: {
  d: Data;
  att: Attendance;
  period: Period;
  locale: Locale;
}) {
  const L = tx(locale);
  const n = (v: number) => formatNumber(v, locale);
  const f = d.funnel;
  const cohort = `${L("Cohort", "المجموعة")}: ${n(d.applications)} ${L("applications submitted in", "طلبًا قُدّم خلال")} ${L(period.label_en, period.label_ar).toLowerCase()}`;
  const empty = !d.applications;
  const emptyText = L("No applications were submitted in this period", "لم تُقدَّم طلبات في هذه الفترة");
  const trend = d.trend.map((t) => ({
    label: bucketLabel(t.day, "day", locale),
    applications: t.applications,
    invited: t.invited,
    completed: t.completed,
  }));
  const days = (h: number | null) =>
    h === null
      ? "—"
      : h < 48
        ? `${formatNumber(Number(h.toFixed(1)), locale)} ${L("h", "س")}`
        : `${formatNumber(Number((h / 24).toFixed(1)), locale)} ${L("days", "يوم")}`;
  const iv = d.interviews;
  const hire = d.stages.find((s) => s.key === "submitted→hired");
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={L("Applications", "الطلبات")}
          value={n(d.applications)}
          hint={`${n(d.publishedJobs)} ${L("jobs published now", "وظيفة منشورة حاليًا")}`}
        />
        <KpiCard
          label={L("Assessment completion", "إكمال التقييمات")}
          value={pct(d.assessmentCompletionRate, locale)}
          hint={`${n(f.assessed)}/${n(f.invited)} ${L("invited candidates submitted", "مرشحًا مدعوًا قدّم")}`}
        />
        <KpiCard
          label={L("Average assessment score", "متوسط درجة التقييم")}
          value={d.avgScore ? `${formatNumber(Math.round(d.avgScore.value), locale)}%` : "—"}
          hint={
            d.avgScore
              ? `n=${n(d.avgScore.samples)} ${L("scored submissions", "إجابة مُقيّمة")}`
              : L("No scored submissions yet", "لا توجد إجابات مُقيّمة بعد")
          }
        />
        <KpiCard
          label={L("Time to hire", "مدة التوظيف")}
          value={days(hire?.avgHours ?? null)}
          hint={`${n(f.hired)} ${L("hired", "معيّن")} · ${n(f.rejected)} ${L("rejected", "مرفوض")}`}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label={L("Shortlist rate", "نسبة القائمة المختصرة")}
          value={pct(d.applications ? f.shortlisted / d.applications : null, locale)}
          hint={`${n(f.shortlisted)}/${n(d.applications)}`}
        />
        <KpiCard
          label={L("Interview scheduling rate", "نسبة جدولة المقابلات")}
          value={pct(f.shortlisted ? f.interviewed / f.shortlisted : null, locale)}
          hint={`${n(f.interviewed)} ${L("of shortlisted applications", "من الطلبات المختصرة")}`}
        />
        <KpiCard
          label={L("Interview completion", "إكمال المقابلات")}
          value={pct(iv.total - iv.cancelled ? iv.completed / (iv.total - iv.cancelled) : null, locale)}
          hint={`${n(iv.completed)}/${n(iv.total - iv.cancelled)} ${L("non-cancelled interviews", "مقابلة غير ملغاة")}`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title={L("14 · Recruitment funnel", "14 · قمع التوظيف")}
          sample={cohort}
          empty={empty}
          emptyText={emptyText}
          definition={L(
            "Each step counts applications from the cohort that reached it at any time",
            "كل خطوة تعد طلبات المجموعة التي وصلت إليها في أي وقت",
          )}
        >
          <Funnel
            locale={locale}
            steps={[
              { label: L("Applied", "قدّم"), value: f.applied },
              { label: L("Assessment invited", "دُعي للتقييم"), value: f.invited },
              { label: L("Assessment submitted", "قدّم التقييم"), value: f.assessed },
              { label: L("Reviewed", "رُوجع"), value: f.reviewed },
              { label: L("Shortlisted", "في القائمة المختصرة"), value: f.shortlisted },
              { label: L("Interviewed", "قوبل"), value: f.interviewed },
              { label: L("Hired", "عُيّن"), value: f.hired },
            ]}
          />
        </Panel>
        <Panel
          className="xl:col-span-2"
          title={L("15 · Applications over time", "15 · الطلبات عبر الزمن")}
          sample={cohort}
          empty={empty}
          emptyText={emptyText}
        >
          <LineSeries
            data={trend}
            xKey="label"
            series={[{ key: "applications", name: L("Applications", "الطلبات"), color: SERIES.primary }]}
          />
        </Panel>
        <Panel
          className="xl:col-span-2"
          title={L("16 · Assessment completion trend", "16 · اتجاه إكمال التقييمات")}
          sample={cohort}
          empty={empty}
          emptyText={emptyText}
          definition={L(
            "Invitations by the day they were sent; completions by the day the candidate submitted",
            "الدعوات حسب يوم إرسالها؛ والإكمال حسب يوم تقديم المرشح",
          )}
        >
          <StackedBars
            stacked={false}
            data={trend}
            xKey="label"
            series={[
              { key: "invited", name: L("Invited", "دعوات"), color: SERIES.secondary },
              { key: "completed", name: L("Submitted", "مقدّمة"), color: SERIES.success },
            ]}
          />
        </Panel>
        <Panel
          title={L("17 · Interview status", "17 · حالة المقابلات")}
          sample={`${n(iv.total)} ${L("interviews for the cohort", "مقابلة للمجموعة")}`}
          empty={!iv.total}
          emptyText={L("No interviews for this cohort", "لا توجد مقابلات لهذه المجموعة")}
          definition={
            att
              ? L(
                  `Video joins recorded for ${att.interviewsWithJoin} interviews (candidate joined: ${att.candidateJoined}, interviewer joined: ${att.interviewerJoined}). A created room is not proof an interview happened`,
                  `سُجّل الانضمام بالفيديو لـ ${att.interviewsWithJoin} مقابلة (انضم المرشح: ${att.candidateJoined}، انضم المقابل: ${att.interviewerJoined}). إنشاء الغرفة ليس دليلًا على حدوث المقابلة`,
                )
              : undefined
          }
        >
          <Donut
            centerLabel={L("interviews", "مقابلة")}
            data={[
              { key: "s", label: L("Scheduled", "مجدولة"), value: iv.scheduled },
              { key: "c", label: L("Completed", "مكتملة"), value: iv.completed },
              { key: "x", label: L("Cancelled", "ملغاة"), value: iv.cancelled },
            ]}
          />
          <p className="text-subtle mt-3 text-xs">
            {n(iv.confirmed)} {L("confirmed by the candidate", "أكدها المرشح")}
          </p>
        </Panel>
        <Panel
          className="xl:col-span-2"
          title={L("18 · Average assessment score by job", "18 · متوسط درجة التقييم حسب الوظيفة")}
          sample={`${n(d.scoreByJob.reduce((a, j) => a + j.samples, 0))} ${L("scored submissions (top 10 jobs by volume)", "إجابة مُقيّمة (أعلى 10 وظائف)")}`}
          empty={!d.scoreByJob.length}
          emptyText={L("No scored submissions for this cohort", "لا توجد إجابات مُقيّمة لهذه المجموعة")}
          definition={L(
            "Mean percentage of each scored submission (not an average of averages)",
            "متوسط النسبة لكل إجابة مُقيّمة (ليس متوسطًا للمتوسطات)",
          )}
        >
          <MiniTable
            head={[L("Job", "الوظيفة"), "n", L("Average", "المتوسط")]}
            empty="—"
            rows={d.scoreByJob.map((j) => [
              locale === "ar" ? j.title_ar : j.title_en,
              n(j.samples),
              `${formatNumber(Math.round(j.avg), locale)}%`,
            ])}
          />
        </Panel>
        <Panel
          title={L("19 · Match score distribution", "19 · توزيع درجة المطابقة")}
          sample={`n=${n(d.matchSamples)} ${L("applications with a match score", "طلبًا بدرجة مطابقة")}`}
          empty={!d.matchSamples}
          emptyText={emptyText}
          definition={L(
            "Skills-overlap estimate at application time — not a measure of competence",
            "تقدير لتداخل المهارات وقت التقديم — وليس مقياسًا للكفاءة",
          )}
        >
          <Columns data={d.matchBuckets} name={L("Applications", "الطلبات")} />
        </Panel>
        <Panel
          className="xl:col-span-3"
          title={L("20 · Hiring stage duration", "20 · مدة مراحل التوظيف")}
          sample={cohort}
          empty={empty}
          emptyText={emptyText}
          definition={L(
            "Mean time between the first entry into each status, from the application status history. Only applications that reached both statuses are counted",
            "متوسط الوقت بين أول دخول لكل حالة من سجل حالات الطلب. تُحسب فقط الطلبات التي بلغت الحالتين",
          )}
        >
          <MiniTable
            head={[L("Stage", "المرحلة"), "n", L("Average", "المتوسط")]}
            empty="—"
            rows={d.stages.map((s) => [L(...STAGE_LABELS[s.key]), n(s.samples), days(s.avgHours)])}
          />
        </Panel>
        <Panel
          className="xl:col-span-3"
          title={L("Interview activity over time", "نشاط المقابلات عبر الزمن")}
          sample={`${n(iv.total)} ${L("interviews", "مقابلة")}`}
          empty={!iv.total}
          emptyText={L("No interviews for this cohort", "لا توجد مقابلات لهذه المجموعة")}
        >
          <StackedBars
            stacked={false}
            data={iv.trend.map((t) => ({
              label: bucketLabel(t.day, "day", locale),
              scheduled: t.scheduled,
              completed: t.completed,
            }))}
            xKey="label"
            series={[
              { key: "scheduled", name: L("Scheduled (created)", "جُدولت"), color: SERIES.primary },
              { key: "completed", name: L("Completed", "اكتملت"), color: SERIES.success },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
