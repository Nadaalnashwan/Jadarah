import Link from "next/link";
import { ArrowUpRight, CalendarClock, ClipboardCheck, MessageSquareQuote, Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, EmptyState, Progress, Spotlight, SpotlightStat } from "@/components/ui/primitives";
import { requireCandidate } from "@/lib/auth/session";
import { planProgress } from "@/lib/domain/career";
import { isTerminal, type ApplicationStatus } from "@/lib/domain/application-status";
import { formatDate, formatDateTime, formatNumber, pick, tx } from "@/lib/i18n/config";
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
import { LISTED_JOB_FILTER, openDeadlineFilter } from "@/lib/domain/listings";

/**
 * Candidate overview, in priority order: 1) what needs action now (tasks, interview confirmations),
 * 2) current applications, 3) relevant opportunities, 4) results and shared feedback, 5) career development.
 * Every number is read from the candidate's own records (RLS); nothing is estimated.
 */
export default async function CandidateOverview() {
  const session = await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const uid = session.userId;
  const nowIso = new Date().toISOString();

  const [
    completion,
    { data: apps },
    { data: assignments },
    { data: interviews },
    { data: feedback },
    { data: plan },
    skills,
    { data: cp },
    { data: jobs },
  ] = await Promise.all([
    getProfileCompletion(supabase, uid, session.profile.full_name),
    supabase
      .from("applications")
      .select(
        "id, job_id, status, submitted_at, requires_task, completed_at, task_assignment_id, job:jobs(title_en, title_ar, company:company_profiles(name_en, name_ar))",
      )
      .eq("candidate_id", uid)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("assessment_assignments")
      .select(
        "id, status, due_at, created_at, assessment:assessments(title_en, title_ar, duration_minutes), assessment_submissions(percentage, status, needs_review, submitted_at)",
      )
      .eq("candidate_id", uid)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("interviews")
      .select(
        "id, title, status, scheduled_at, timezone, candidate_confirmed_at, application:applications!inner(candidate_id, job:jobs(title_en, title_ar))",
      )
      .eq("application.candidate_id", uid)
      .eq("status", "scheduled")
      .gte("scheduled_at", nowIso)
      .order("scheduled_at")
      .limit(5),
    supabase
      .from("interview_feedback")
      .select("id, shared_at, application:applications!inner(candidate_id, job:jobs(title_en, title_ar))")
      .eq("application.candidate_id", uid)
      .eq("shared_with_candidate", true)
      .order("shared_at", { ascending: false })
      .limit(3),
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
      .or(LISTED_JOB_FILTER).or(openDeadlineFilter())
      .order("published_at", { ascending: false })
      .limit(60),
  ]);

  const applications = apps ?? [];
  const activeApps = applications.filter((a) => !isTerminal(a.status as ApplicationStatus));
  const openTasks = (assignments ?? []).filter((a) => a.status === "assigned" || a.status === "in_progress");
  const results = (assignments ?? []).filter((a) => a.status === "submitted" || a.status === "evaluated").slice(0, 3);
  const toConfirm = (interviews ?? []).filter((i) => !i.candidate_confirmed_at);
  const progress = plan ? planProgress(plan.development_plan_items) : 0;
  const appliedJobIds = new Set(applications.map((a) => a.job_id));
  const records = toSkillRecords(skills);
  const recommended = (jobs ?? [])
    .filter((j) => !appliedJobIds.has(j.id))
    .map((j) => ({ job: j, match: matchJob(j, records, cp?.years_experience ?? null, locale) }))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, 4);
  const firstName = session.profile.full_name.split(" ")[0] || "";
  const actionsCount = openTasks.length + toConfirm.length;
  const nextStep = (s: ApplicationStatus, taskPending: boolean) =>
    taskPending
      ? L("Submit the practical task", "سلّم المهمة العملية")
      : s === "interview_scheduled"
        ? L("Prepare for your interview", "استعد لمقابلتك")
        : s === "shortlisted"
          ? L("Shortlisted — an interview may follow", "في القائمة المختصرة — قد تليها مقابلة")
          : L("The company is reviewing", "الشركة تراجع طلبك");

  return (
    <>
      <Spotlight
        title={fmt(t.candidate.overviewTitle, { name: firstName })}
        description={t.candidate.overviewBody}
        actions={
          <Button asChild>
            <Link href="/candidate/jobs">{t.candidate.browseJobs}</Link>
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <SpotlightStat
            emphasis={actionsCount > 0}
            label={L("Needs your action", "يحتاج إجراءً منك")}
            value={formatNumber(actionsCount, locale)}
            hint={L("Tasks and interview confirmations", "مهام وتأكيد مقابلات")}
          />
          <SpotlightStat
            label={t.candidate.applicationsActive}
            value={formatNumber(activeApps.length, locale)}
            hint={L(`Out of ${applications.length} applications`, `من أصل ${applications.length} طلبًا`)}
          />
          <SpotlightStat
            label={L("Assessments submitted", "تقييمات مُسلّمة")}
            value={formatNumber((assignments ?? []).filter((a) => a.status === "submitted" || a.status === "evaluated").length, locale)}
          />
          <SpotlightStat
            label={t.candidate.profileCompletion}
            value={`${formatNumber(completion, locale)}%`}
            hint={
              completion < 100 ? (
                <Link href="/candidate/profile" className="text-primary font-semibold">
                  {L("Complete your profile", "أكمل ملفك")}
                </Link>
              ) : undefined
            }
          />
        </div>
      </Spotlight>

      {/* 1. Required actions */}
      <Card tone={actionsCount ? "peach" : undefined} className="jd-enter mt-6">
        <CardHeader
          className={actionsCount ? undefined : "pb-5 sm:pb-6"}
          title={actionsCount ? L("Next actions", "الخطوات التالية") : L("You're all caught up", "لا شيء ينتظرك الآن")}
          description={
            actionsCount
              ? undefined
              : L("No open tasks or interview confirmations", "لا توجد مهام مفتوحة أو مقابلات بانتظار التأكيد")
          }
        />
        {actionsCount > 0 && (
          <CardBody>
            <ul className="grid gap-2 md:grid-cols-2">
              {openTasks.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/candidate/assessments/${a.id}`}
                    className="bg-surface-elevated hover:border-primary/40 flex items-center gap-3 rounded-xl border p-3 transition"
                  >
                    <ClipboardCheck className="text-primary size-5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{pick(a.assessment, "title", locale)}</span>
                      <span className="text-subtle block text-xs">
                        {a.status === "in_progress" ? L("In progress", "قيد التنفيذ") : L("Not started", "لم تبدأ")}
                        {a.due_at && ` · ${L("Due", "الموعد")} ${formatDateTime(a.due_at, locale)}`}
                      </span>
                    </span>
                    <span className="text-primary text-xs font-bold">
                      {a.status === "in_progress" ? L("Continue", "متابعة") : L("Start", "ابدأ")}
                    </span>
                  </Link>
                </li>
              ))}
              {toConfirm.map((i) => (
                <li key={i.id}>
                  <Link
                    href="/candidate/interviews"
                    className="bg-surface-elevated hover:border-primary/40 flex items-center gap-3 rounded-xl border p-3 transition"
                  >
                    <CalendarClock className="text-primary size-5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{pick(i.application?.job, "title", locale)}</span>
                      <span className="text-subtle block text-xs">{formatDateTime(i.scheduled_at, locale, i.timezone)}</span>
                    </span>
                    <span className="text-primary text-xs font-bold">{L("Confirm", "أكّد الحضور")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        )}
      </Card>

      <div className="jd-enter-stagger mt-6 grid items-start gap-6 xl:grid-cols-[1.25fr_1fr]">
        {/* 2. Current applications */}
        <Card>
          <CardHeader
            title={L("Current applications", "طلباتك الحالية")}
            action={
              applications.length ? (
                <Link href="/candidate/applications" className="text-primary text-xs font-semibold">
                  {L("All applications", "كل الطلبات")}
                </Link>
              ) : undefined
            }
          />
          <CardBody>
            {activeApps.length ? (
              <ul className="divide-y">
                {activeApps.slice(0, 5).map((a) => {
                  const taskPending = a.requires_task && !a.completed_at;
                  return (
                    <li key={a.id}>
                      <Link
                        href={taskPending && a.task_assignment_id ? `/candidate/assessments/${a.task_assignment_id}` : `/candidate/applications/${a.id}`}
                        className="hover:bg-surface-2/60 -mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-3"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{pick(a.job, "title", locale)}</span>
                          <span className="text-subtle block truncate text-xs">
                            {pick(a.job?.company, "name", locale)} · {nextStep(a.status as ApplicationStatus, taskPending)}
                          </span>
                        </span>
                        <StatusBadge status={a.status as ApplicationStatus} t={t} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title={applications.length ? L("No active applications", "لا توجد طلبات نشطة") : t.candidate.noApplications}
                action={
                  <Button asChild>
                    <Link href="/candidate/jobs">{t.candidate.browseJobs}</Link>
                  </Button>
                }
              />
            )}
          </CardBody>
        </Card>

        {/* 3. Relevant opportunities */}
        <Card>
          <CardHeader
            title={t.candidate.recommendedJobs}
            action={
              <Link href="/candidate/jobs" className="text-primary text-xs font-semibold">
                {t.candidate.browseJobs}
              </Link>
            }
          />
          <CardBody>
            {recommended.length === 0 ? (
              <EmptyState
                title={
                  records.length === 0
                    ? L("Add skills to get recommendations", "أضف مهاراتك لتحصل على اقتراحات")
                    : L("No open opportunities right now", "لا توجد فرص متاحة حاليًا")
                }
                action={
                  records.length === 0 ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href="/candidate/skills">{L("Add skills", "أضف مهارات")}</Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {recommended.map(({ job, match }) => (
                  <li key={job.id}>
                    <Link
                      href={`/candidate/jobs/${job.id}`}
                      className="group bg-surface-elevated hover:border-primary/40 flex items-center gap-4 rounded-xl border p-3 transition"
                    >
                      <span
                        className="ltr-nums bg-tone-blue text-primary flex size-11 shrink-0 flex-col items-center justify-center rounded-xl text-sm font-extrabold"
                        title={L("Evidence match out of 100", "مطابقة الأدلة من 100")}
                      >
                        {match.score}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="group-hover:text-primary block truncate font-semibold">
                          {pick(job, "title", locale)}
                        </span>
                        <span className="text-subtle block truncate text-xs">
                          {pick(job.company, "name", locale)} · {job.city} · {t.workMode[job.work_mode]}
                        </span>
                      </span>
                      <ArrowUpRight className="text-subtle size-4 shrink-0 rtl:-scale-x-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="jd-enter-stagger mt-6 grid items-start gap-6 lg:grid-cols-2">
        {/* 4. Results & shared feedback */}
        <Card>
          <CardHeader
            title={L("Results and feedback", "النتائج والملاحظات")}
            action={
              <Link href="/candidate/assessments" className="text-primary text-xs font-semibold">
                {L("All assessments", "كل التقييمات")}
              </Link>
            }
          />
          <CardBody>
            {results.length === 0 && !(feedback ?? []).length ? (
              <p className="text-muted text-sm">
                {L("Results appear here after you submit an assessment", "تظهر النتائج هنا بعد تسليمك تقييمًا")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {results.map((r) => {
                  const sub = r.assessment_submissions;
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/candidate/assessments/${r.id}`}
                        className="bg-surface-elevated hover:border-primary/40 flex items-center gap-3 rounded-xl border p-3 transition"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{pick(r.assessment, "title", locale)}</span>
                          <span className="text-subtle block text-xs">
                            {sub?.submitted_at ? formatDate(sub.submitted_at, locale) : ""}
                          </span>
                        </span>
                        {sub?.needs_review || sub?.percentage === null || sub?.percentage === undefined ? (
                          <Badge tone="progress">{L("Under human review", "قيد المراجعة البشرية")}</Badge>
                        ) : (
                          <span className="ltr-nums text-lg font-extrabold">{formatNumber(sub.percentage, locale)}%</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
                {(feedback ?? []).map((f) => (
                  <li key={f.id} className="bg-surface-glass flex items-center gap-3 rounded-xl border p-3">
                    <MessageSquareQuote className="text-primary size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {L("Interview feedback shared", "ملاحظات مقابلة مشاركة")} · {pick(f.application?.job, "title", locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* 5. Career development */}
        <Card>
          <CardHeader
            title={L("Career development", "التطوير المهني")}
            action={
              <Link href="/candidate/career" className="text-primary text-xs font-semibold">
                {plan ? L("Open plan", "افتح الخطة") : L("Set a goal", "حدّد هدفًا")}
              </Link>
            }
          />
          <CardBody className="flex flex-col gap-4">
            {plan ? (
              <div>
                <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                  <span className="truncate">{pick(plan, "title", locale)}</span>
                  <span className="ltr-nums">{formatNumber(progress, locale)}%</span>
                </p>
                <Progress value={progress} className="mt-2" label={t.candidate.planProgress} />
              </div>
            ) : (
              <p className="text-muted flex items-start gap-2 text-sm">
                <Sparkles className="text-primary mt-0.5 size-4 shrink-0" />
                {L(
                  "Choose a target role to see the skills you have demonstrated and the gaps to close",
                  "اختر دورًا مستهدفًا لترى المهارات التي أثبتّها والفجوات المتبقية",
                )}
              </p>
            )}
            <p className="text-subtle text-xs">
              {L(`${records.length} skills in your profile`, `${records.length} مهارة في ملفك`)} ·{" "}
              <Link href="/candidate/skills" className="text-primary font-semibold">
                {L("Manage skills", "إدارة المهارات")}
              </Link>
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
