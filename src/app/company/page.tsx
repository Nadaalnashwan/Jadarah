import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { BarList, Columns, Donut, TrendArea } from "@/components/app/charts";
import { Card, CardBody, CardHeader, EmptyState, PageHeader, Spotlight, SpotlightStat } from "@/components/ui/primitives";
import { requireCompanyMember } from "@/lib/auth/session";
import { APPLICATION_STATUSES } from "@/lib/domain/application-status";
import { formatDateTime, formatNumber, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type Stats = {
  jobs_by_status: Record<string, number>;
  applications_by_status: Record<string, number>;
  funnel: Record<"applied" | "reviewed" | "assessed" | "shortlisted" | "interviewed" | "hired", number>;
  applications_per_job: { job_id: string; title_en: string; title_ar: string; count: number }[];
  weekly_applications: { week: string; count: number }[];
  upcoming_interviews: number;
  pending_reviews: number;
  avg_assessment_score: number | null;
};

export default async function CompanyOverview() {
  const s = await requireCompanyMember();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const cid = s.activeMembership.company_id;
  const role = s.activeMembership.role;
  // Independent queries run in parallel (they were sequential: interviews, then the stats RPC). Supabase query builders
  // are lazy — they only start when awaited — so both go through Promise.all.
  const isInterviewer = role === "interviewer";
  const [{ data: upcoming }, statsResult] = await Promise.all([
    supabase
      .from("interviews")
      .select("id, title, scheduled_at, timezone, application:applications(job:jobs(title_en, title_ar))")
      .eq("company_id", cid)
      .eq("status", "scheduled")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(5),
    isInterviewer ? Promise.resolve(null) : supabase.rpc("company_dashboard_stats", { p_company: cid }),
  ]);
  if (isInterviewer) {
    return (
      <>
        <PageHeader title={L("Your interviews", "مقابلاتك")} />
        <Card>
          <CardBody>
            {upcoming?.length ? (
              <ul className="flex flex-col gap-2">
                {upcoming.map((i) => (
                  <li key={i.id}>
                    <Link
                      href={`/company/interviews/${i.id}`}
                      className="hover:border-primary/40 flex justify-between rounded-xl border p-3"
                    >
                      <span className="font-semibold">{i.title}</span>
                      <span className="text-muted text-sm">
                        {formatDateTime(i.scheduled_at, locale, i.timezone)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={L("No upcoming interviews", "لا توجد مقابلات قادمة")} />
            )}
          </CardBody>
        </Card>
      </>
    );
  }
  const { data, error } = statsResult ?? { data: null, error: null };
  if (error || !data) {
    // Never hide the workspace behind an unrelated page: say what failed and keep navigation available.
    console.error("[company] dashboard stats failed", { company: cid, code: error?.code });
    return (
      <>
        <PageHeader eyebrow={pick(s.activeMembership.company, "name", locale)} title={L("Recruitment overview", "نظرة على التوظيف")} />
        <EmptyState
          title={L("Statistics are temporarily unavailable", "الإحصاءات غير متاحة مؤقتًا")}
          body={L("Your jobs and applications are still available from the menu. Reload to try again", "وظائفك وطلباتك متاحة من القائمة. أعد تحميل الصفحة للمحاولة مجددًا")}
          action={<Link href="/company/jobs" className="text-primary text-sm font-semibold">{L("Open jobs", "فتح الوظائف")}</Link>}
        />
      </>
    );
  }
  const st = data as unknown as Stats;
  const funnelLabels: Record<keyof Stats["funnel"], string> = {
    applied: L("Applied", "تقدّموا"),
    reviewed: L("Reviewed", "رُوجعوا"),
    assessed: L("Assessed", "قُيّموا"),
    shortlisted: t.status.shortlisted,
    interviewed: L("Interviewed", "قوبلوا"),
    hired: t.status.hired,
  };
  const totalApps = st.funnel.applied;
  const totalJobs = Object.values(st.jobs_by_status ?? {}).reduce((a, b) => a + b, 0);

  return (
    <>
      <Spotlight
        variant="employer"
        eyebrow={pick(s.activeMembership.company, "name", locale)}
        title={L("Recruitment overview", "نظرة على التوظيف")}
        actions={
          <Link
            href="/company/applications"
            className="inline-flex h-11 items-center rounded-xl bg-[var(--mint)] px-5 text-sm font-bold text-[#0b3d2e] transition-transform hover:-translate-y-px"
          >
            {L("Review applications", "راجِع الطلبات")}
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <SpotlightStat
            label={L("Jobs", "الوظائف")}
            value={formatNumber(totalJobs, locale)}
            hint={`${formatNumber(st.jobs_by_status.published ?? 0, locale)} ${t.jobStatus.published} · ${formatNumber(st.jobs_by_status.draft ?? 0, locale)} ${t.jobStatus.draft}`}
          />
          <SpotlightStat
            label={L("Applications", "الطلبات")}
            value={formatNumber(totalApps, locale)}
            hint={`${formatNumber(st.applications_by_status.under_review ?? 0, locale)} ${t.status.under_review}`}
          />
          <SpotlightStat
            emphasis={st.pending_reviews > 0}
            label={L("Answers awaiting review", "إجابات بانتظار المراجعة")}
            value={formatNumber(st.pending_reviews, locale)}
            hint={
              st.avg_assessment_score !== null
                ? `${L("Average score", "متوسط الدرجة")} ${formatNumber(st.avg_assessment_score, locale)}%`
                : undefined
            }
          />
          <SpotlightStat label={L("Upcoming interviews", "مقابلات قادمة")} value={formatNumber(st.upcoming_interviews, locale)} />
        </div>
      </Spotlight>
      <div className="jd-enter-stagger mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title={L("Recruitment funnel", "مسار التوظيف")} />
          <CardBody>
            <BarList
              data={(Object.keys(funnelLabels) as (keyof Stats["funnel"])[]).map((k) => ({
                key: k,
                label: funnelLabels[k],
                value: st.funnel[k],
              }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={L("Applications by stage", "الطلبات حسب المرحلة")} />
          <CardBody>
            <Donut
              centerLabel={L("applications", "طلب")}
              data={APPLICATION_STATUSES.filter((x) => st.applications_by_status[x]).map((x) => ({
                key: x,
                label: t.status[x],
                value: st.applications_by_status[x],
              }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={L("Applications per job", "الطلبات لكل وظيفة")} />
          <CardBody>
            {st.applications_per_job.length ? (
              <Columns
                name={L("Applications", "الطلبات")}
                data={st.applications_per_job.map((j) => ({
                  label: pick(j, "title", locale).slice(0, 18),
                  value: j.count,
                }))}
              />
            ) : (
              <EmptyState title={L("No published jobs yet", "لا توجد وظائف منشورة بعد")} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={L("Weekly applications (12 weeks)", "الطلبات الأسبوعية (12 أسبوعًا)")} />
          <CardBody>
            {st.weekly_applications.length ? (
              <TrendArea
                name={L("Applications", "الطلبات")}
                data={st.weekly_applications.map((w) => ({ label: w.week.slice(5), value: w.count }))}
              />
            ) : (
              <EmptyState title={t.common.emptyTitle} />
            )}
          </CardBody>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title={L("Next interviews", "المقابلات القادمة")} />
        <CardBody>
          {upcoming?.length ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {upcoming.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/company/interviews/${i.id}`}
                    className="hover:border-primary/40 flex items-center gap-3 rounded-xl border p-3"
                  >
                    <CalendarClock className="text-primary size-5" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {pick(i.application?.job, "title", locale)}
                      </span>
                      <span className="text-subtle text-xs">
                        {formatDateTime(i.scheduled_at, locale, i.timezone)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={L("No upcoming interviews", "لا توجد مقابلات قادمة")} />
          )}
        </CardBody>
      </Card>
    </>
  );
}
