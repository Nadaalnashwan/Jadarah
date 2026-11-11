import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { BarList, Columns, Donut, TrendArea } from "@/components/app/charts";
import { Card, CardBody, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui/primitives";
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
  const { data: upcoming } = await supabase
    .from("interviews")
    .select("id, title, scheduled_at, timezone, application:applications(job:jobs(title_en, title_ar))")
    .eq("company_id", cid)
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(5);
  if (role === "interviewer") {
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
  const { data, error } = await supabase.rpc("company_dashboard_stats", { p_company: cid });
  if (error) redirect("/company/verification");
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

  return (
    <>
      <PageHeader
        eyebrow={pick(s.activeMembership.company, "name", locale)}
        title={L("Recruitment overview", "نظرة على التوظيف")}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <Stat
            label={L("Published jobs", "وظائف منشورة")}
            value={formatNumber(st.jobs_by_status.published ?? 0, locale)}
            hint={`${formatNumber(st.jobs_by_status.draft ?? 0, locale)} ${t.jobStatus.draft}`}
          />
        </Card>
        <Card className="p-5">
          <Stat label={L("Applications", "الطلبات")} value={formatNumber(totalApps, locale)} />
        </Card>
        <Card className="p-5">
          <Stat
            label={L("Upcoming interviews", "مقابلات قادمة")}
            value={formatNumber(st.upcoming_interviews, locale)}
          />
        </Card>
        <Card className="p-5">
          <Stat
            label={L("Answers awaiting review", "إجابات بانتظار المراجعة")}
            value={formatNumber(st.pending_reviews, locale)}
            hint={
              st.avg_assessment_score !== null
                ? `${L("Avg. score", "متوسط الدرجة")} ${formatNumber(st.avg_assessment_score, locale)}%`
                : undefined
            }
          />
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
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
                    <CalendarClock className="text-primary dark:text-lavender size-5" />
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
