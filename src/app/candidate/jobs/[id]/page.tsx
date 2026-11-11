import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Wallet } from "lucide-react";
import { CompanyBanner, CompanyIdentity, CompanyMark, identityOf } from "@/components/app/company-mark";
import { TaskPreviewCard, type TaskPreview } from "@/components/app/task-preview";
import { MatchExplanation } from "@/components/app/match-explanation";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { requireCandidate } from "@/lib/auth/session";
import type { ApplicationStatus } from "@/lib/domain/application-status";
import { formatDate, formatNumber, pick, pickArray, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getCandidateSkills, matchJob, toSkillRecords } from "@/services/candidate";
import { withSemantics } from "@/services/semantic";
import { ApplyForm } from "./apply-form";
import { SaveJobButton } from "../save-button";
import { isPracticeListing } from "@/lib/domain/listings";

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select(
      "*, company:company_profiles(id, slug, name_en, name_ar, sector_en, sector_ar, organization_type, website, description_en, description_ar, company_brand_profiles(identity_status, usage_permission, logo_source_url, primary_hex), company_identity(logo_path, cover_path, tagline_en, tagline_ar, primary_hex, secondary_hex, accent_hex)), job_skills(importance, min_level, skill:skills(id, slug, name_en, name_ar)), job_requirements(*), job_application_questions(*)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();
  const [skills, { data: cp }, { data: cvs }, { data: existing }, { data: saved }, { data: preview }] = await Promise.all([
    getCandidateSkills(supabase, session.userId),
    supabase
      .from("candidate_profiles")
      .select("years_experience")
      .eq("user_id", session.userId)
      .maybeSingle(),
    supabase
      .from("candidate_documents")
      .select("id, file_name, label, version, is_primary")
      .eq("candidate_id", session.userId)
      .eq("kind", "cv")
      .is("deleted_at", null)
      .order("is_primary", { ascending: false }),
    supabase
      .from("applications")
      .select("id, status, requires_task, completed_at, task_assignment_id")
      .eq("job_id", id)
      .eq("candidate_id", session.userId)
      .maybeSingle(),
    supabase
      .from("saved_jobs")
      .select("job_id")
      .eq("job_id", id)
      .eq("candidate_id", session.userId)
      .maybeSingle(),
    supabase.rpc("job_task_preview", { p_job: id }),
  ]);
  // Imported practice scenarios are not vacancies: only reachable for a candidate who already has an application.
  if (isPracticeListing(job) && !existing) notFound();
  const task = preview as TaskPreview | null;
  const skillRecords = toSkillRecords(skills);
  const match = await withSemantics(supabase, matchJob(job, skillRecords, cp?.years_experience ?? null, locale), {
    candidateId: session.userId,
    jobId: id,
    candidateSkillIds: skillRecords.map((s) => s.skill_id),
    locale,
    refreshCandidate: true,
  });
  const closed =
    job.status !== "published" ||
    (job.deadline !== null && job.deadline < new Date().toISOString().slice(0, 10));

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-6">
        {job.company && (identityOf(job.company)?.primary_hex || identityOf(job.company)?.cover_path) && (
          <Link href={`/candidate/companies/${job.company.slug}`} className="block">
            <CompanyBanner company={job.company} locale={locale} />
          </Link>
        )}
        <Card className="overflow-hidden">
          <div className="bg-navy text-ivory relative p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                {job.company && (
                  <Link href={`/candidate/companies/${job.company.slug}`} className="text-sky/90 flex items-center gap-2 text-sm hover:text-white">
                    <CompanyMark company={job.company} size="sm" className="bg-white/10" /> {pick(job.company, "name", locale)}
                  </Link>
                )}
                <h1 className="editorial mt-2 text-3xl font-extrabold sm:text-4xl">
                  {pick(job, "title", locale)}
                </h1>
              </div>
              <div className="rounded-full bg-white/10">
                <SaveJobButton jobId={job.id} saved={!!saved} />
              </div>
            </div>
            <div className="text-sky/90 mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" /> {job.city} · {t.workMode[job.work_mode]}
              </span>
              <span>
                {t.employmentType[job.employment_type]} · {t.level[job.experience_level]}
              </span>
              {job.salary_visible && job.salary_min && (
                <span className="ltr-nums flex items-center gap-1.5">
                  <Wallet className="size-4" /> {formatNumber(job.salary_min, locale)}–
                  {formatNumber(job.salary_max, locale)} {t.common.sar}
                </span>
              )}
              {job.deadline && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" /> {L("Apply by", "قدّم قبل")}{" "}
                  {formatDate(job.deadline, locale)}
                </span>
              )}
            </div>
          </div>
          <CardBody className="flex flex-col gap-6">
            <p className="text-muted leading-relaxed">{pick(job, "description", locale)}</p>
            <section>
              <h2 className="mb-2 font-bold">{L("Responsibilities", "المسؤوليات")}</h2>
              <ul className="text-muted list-disc space-y-1 ps-5">
                {pickArray(job, "responsibilities", locale).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="mb-2 font-bold">{L("Qualifications", "المؤهلات")}</h2>
              <ul className="text-muted list-disc space-y-1 ps-5">
                {pickArray(job, "qualifications", locale).map((r) => (
                  <li key={r}>{r}</li>
                ))}
                {job.job_requirements.map((r) => (
                  <li key={r.id}>{pick(r, "text", locale)}</li>
                ))}
              </ul>
            </section>
            {task && <TaskPreviewCard task={task} locale={locale} />}
            <section>
              <h2 className="mb-2 font-bold">{L("About the organization", "عن الجهة")}</h2>
              {job.company && <CompanyIdentity company={job.company} locale={locale} />}
              {pick(job.company, "description", locale) && <p className="text-muted mt-3 text-sm">{pick(job.company, "description", locale)}</p>}
              {isPracticeListing(job) && (
                <p className="text-subtle mt-3 text-xs">
                  {L("Practice scenario — not an official vacancy.", "سيناريو تدريبي — وليس شاغرًا رسميًا.")}
                </p>
              )}
            </section>
          </CardBody>
        </Card>
      </div>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader
            title={L("How you match", "مدى مطابقتك")}
            description={L(
              "Based only on what your profile states and proves.",
              "مبنية فقط على ما يذكره ملفك ويثبته.",
            )}
          />
          <CardBody>
            <MatchExplanation match={match} t={t} locale={locale} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={L("Apply", "التقديم")} />
          <CardBody>
            {existing && existing.requires_task && !existing.completed_at && existing.task_assignment_id ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm font-semibold">
                  {L("Your application is waiting for the practical task.", "طلبك بانتظار إكمال المهمة العملية.")}
                </p>
                <p className="text-muted text-sm">
                  {L(
                    "Your application is complete once you submit the task. Saved answers are kept if you leave.",
                    "يكتمل طلبك عند تسليم المهمة. تُحفظ إجاباتك إذا غادرت.",
                  )}
                </p>
                <Button asChild>
                  <Link href={`/candidate/assessments/${existing.task_assignment_id}`}>
                    {L("Continue the practical task", "متابعة المهمة العملية")}
                  </Link>
                </Button>
              </div>
            ) : existing ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-muted text-sm">
                  {L("You applied to this job.", "لقد تقدّمت لهذه الوظيفة.")}
                </p>
                <StatusBadge status={existing.status as ApplicationStatus} t={t} />
                <Button asChild variant="outline">
                  <Link href={`/candidate/applications/${existing.id}`}>
                    {L("Track application", "تتبّع الطلب")}
                  </Link>
                </Button>
              </div>
            ) : closed ? (
              <p className="text-muted text-sm">
                {L("This job is no longer accepting applications.", "لم تعد هذه الوظيفة تستقبل طلبات.")}
              </p>
            ) : (
              <ApplyForm
                jobId={job.id}
                hasTask={!!task}
                cvs={(cvs ?? [])
                  .filter((c) => c.label !== "[archived]")
                  .map((c) => ({
                    id: c.id,
                    label: `${c.label || c.file_name} (v${c.version})`,
                    primary: c.is_primary,
                  }))}
                questions={job.job_application_questions
                  .sort((a, b) => a.position - b.position)
                  .map((q) => ({ id: q.id, text: pick(q, "question", locale), required: q.is_required }))}
              />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
