import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Progress,
  Stat,
} from "@/components/ui/primitives";
import { requireCandidate } from "@/lib/auth/session";
import { planProgress } from "@/lib/domain/career";
import { isTerminal, type ApplicationStatus } from "@/lib/domain/application-status";
import { formatNumber, pick, tx } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/messages";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCandidateSkills,
  getProfileCompletion,
  JOB_LIST_SELECT,
  matchJob,
  toSkillRecords,
} from "@/services/candidate";
import { ApplicationsByStatus } from "./overview-client";

export default async function CandidateOverview() {
  const session = await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const uid = session.userId;

  const [
    completion,
    { data: apps },
    { data: assignments },
    { data: plan },
    skills,
    { data: cp },
    { data: jobs },
  ] = await Promise.all([
    getProfileCompletion(supabase, uid, session.profile.full_name),
    supabase
      .from("applications")
      .select(
        "id, job_id, status, submitted_at, job:jobs(title_en, title_ar, company:company_profiles(name_en, name_ar))",
      )
      .eq("candidate_id", uid)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("assessment_assignments")
      .select("id, status, due_at, assessment:assessments(title_en, title_ar)")
      .eq("candidate_id", uid)
      .in("status", ["assigned", "in_progress"]),
    supabase
      .from("development_plans")
      .select("id, title_en, title_ar, development_plan_items(status, estimated_hours)")
      .eq("candidate_id", uid)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getCandidateSkills(supabase, uid),
    supabase.from("candidate_profiles").select("years_experience").eq("user_id", uid).maybeSingle(),
    supabase
      .from("jobs")
      .select(JOB_LIST_SELECT)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(60),
  ]);

  const applications = apps ?? [];
  const active = applications.filter((a) => !isTerminal(a.status as ApplicationStatus)).length;
  const progress = plan ? planProgress(plan.development_plan_items) : 0;
  const appliedJobIds = new Set(applications.map((a) => a.job_id));
  const records = toSkillRecords(skills);
  const recommended = (jobs ?? [])
    .filter((j) => !appliedJobIds.has(j.id))
    .map((j) => ({ job: j, match: matchJob(j, records, cp?.years_experience ?? null, locale) }))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, 4);

  const firstName = session.profile.full_name.split(" ")[0] || "";
  const statusRows = applications.map((a) => ({
    id: a.id,
    status: a.status as ApplicationStatus,
    title: pick(a.job, "title", locale),
    company: pick(a.job?.company, "name", locale),
    submitted_at: a.submitted_at,
  }));

  return (
    <>
      <PageHeader
        eyebrow={t.candidate.nav.overview}
        title={fmt(t.candidate.overviewTitle, { name: firstName })}
        description={t.candidate.overviewBody}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <Stat label={t.candidate.profileCompletion} value={`${formatNumber(completion, locale)}%`} />
          <Progress value={completion} className="mt-3" label={t.candidate.profileCompletion} />
          {completion < 100 && (
            <Link
              href="/candidate/profile"
              className="text-primary dark:text-lavender mt-3 inline-flex items-center gap-1 text-xs font-semibold"
            >
              {L("Complete your profile", "أكمل ملفك")} <ArrowUpRight className="size-3 rtl:-scale-x-100" />
            </Link>
          )}
        </Card>
        <Card className="p-5">
          <Stat
            label={t.candidate.applicationsActive}
            value={formatNumber(active, locale)}
            hint={L(`${applications.length} total`, `${applications.length} إجمالًا`)}
          />
        </Card>
        <Card className="p-5">
          <Stat label={t.candidate.assessmentsDue} value={formatNumber(assignments?.length ?? 0, locale)} />
          {assignments?.[0] && (
            <Link
              href={`/candidate/assessments/${assignments[0].id}`}
              className="text-primary dark:text-lavender mt-3 inline-flex items-center gap-1 text-xs font-semibold"
            >
              {pick(assignments[0].assessment, "title", locale)}{" "}
              <ArrowUpRight className="size-3 rtl:-scale-x-100" />
            </Link>
          )}
        </Card>
        <Card className="p-5">
          <Stat
            label={t.candidate.planProgress}
            value={plan ? `${formatNumber(progress, locale)}%` : "—"}
            hint={plan ? pick(plan, "title", locale) : L("No plan yet", "لا توجد خطة بعد")}
          />
          {plan && <Progress value={progress} className="mt-3" />}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader
            title={t.candidate.recentActivity}
          />
          <CardBody>
            {statusRows.length ? (
              <ApplicationsByStatus rows={statusRows} />
            ) : (
              <EmptyState
                title={t.candidate.noApplications}
                action={
                  <Button asChild>
                    <Link href="/candidate/jobs">{t.candidate.browseJobs}</Link>
                  </Button>
                }
              />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title={t.candidate.recommendedJobs}
          />
          <CardBody>
            {recommended.length === 0 ? (
              <EmptyState title={L("Add skills to get recommendations", "أضف مهاراتك لتحصل على اقتراحات")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {recommended.map(({ job, match }) => (
                  <li key={job.id}>
                    <Link
                      href={`/candidate/jobs/${job.id}`}
                      className="group hover:border-primary/40 hover:bg-accent-soft/40 flex items-center gap-4 rounded-2xl border p-4 transition"
                    >
                      <div className="relative flex size-12 shrink-0 items-center justify-center">
                        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
                          <circle
                            cx="18"
                            cy="18"
                            r="15.5"
                            fill="none"
                            stroke="var(--surface-2)"
                            strokeWidth="3"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15.5"
                            fill="none"
                            stroke="var(--royal)"
                            strokeWidth="3"
                            strokeDasharray={`${(match.score / 100) * 97.4} 97.4`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="ltr-nums text-xs font-extrabold">{match.score}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="group-hover:text-primary dark:group-hover:text-lavender truncate font-semibold">
                          {pick(job, "title", locale)}
                        </p>
                        <p className="text-subtle truncate text-xs">
                          {pick(job.company, "name", locale)} · {job.city} · {t.workMode[job.work_mode]}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
