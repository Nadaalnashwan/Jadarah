import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, CalendarDays, MapPin, Wallet } from "lucide-react";
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
import { ApplyForm } from "./apply-form";
import { SaveJobButton } from "../save-button";

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("*, company:company_profiles(id, name_en, name_ar, description_en, description_ar, industry, city, size_range), job_skills(importance, min_level, skill:skills(id, slug, name_en, name_ar)), job_requirements(*), job_application_questions(*), assessment:assessments(title_en, title_ar, duration_minutes)")
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();
  const [skills, { data: cp }, { data: cvs }, { data: existing }, { data: saved }] = await Promise.all([
    getCandidateSkills(supabase, session.userId),
    supabase.from("candidate_profiles").select("years_experience").eq("user_id", session.userId).maybeSingle(),
    supabase.from("candidate_documents").select("id, file_name, label, version, is_primary").eq("candidate_id", session.userId).eq("kind", "cv").is("deleted_at", null).order("is_primary", { ascending: false }),
    supabase.from("applications").select("id, status").eq("job_id", id).eq("candidate_id", session.userId).maybeSingle(),
    supabase.from("saved_jobs").select("job_id").eq("job_id", id).eq("candidate_id", session.userId).maybeSingle(),
  ]);
  const match = matchJob(job, toSkillRecords(skills), cp?.years_experience ?? null, locale);
  const closed = job.status !== "published" || (job.deadline !== null && job.deadline < new Date().toISOString().slice(0, 10));

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-6">
        <Card className="overflow-hidden">
          <div className="relative bg-navy p-6 text-ivory sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm text-sky/90"><Building2 className="size-4" /> {pick(job.company, "name", locale)}</p>
                <h1 className="editorial mt-2 text-3xl font-extrabold sm:text-4xl">{pick(job, "title", locale)}</h1>
              </div>
              <div className="rounded-full bg-white/10"><SaveJobButton jobId={job.id} saved={!!saved} /></div>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-sky/90">
              <span className="flex items-center gap-1.5"><MapPin className="size-4" /> {job.city} · {t.workMode[job.work_mode]}</span>
              <span>{t.employmentType[job.employment_type]} · {t.level[job.experience_level]}</span>
              {job.salary_visible && job.salary_min && (
                <span className="ltr-nums flex items-center gap-1.5"><Wallet className="size-4" /> {formatNumber(job.salary_min, locale)}–{formatNumber(job.salary_max, locale)} {t.common.sar}</span>
              )}
              {job.deadline && <span className="flex items-center gap-1.5"><CalendarDays className="size-4" /> {L("Apply by", "قدّم قبل")} {formatDate(job.deadline, locale)}</span>}
            </div>
          </div>
          <CardBody className="flex flex-col gap-6">
            <p className="leading-relaxed text-muted">{pick(job, "description", locale)}</p>
            <section>
              <h2 className="mb-2 font-bold">{L("Responsibilities", "المسؤوليات")}</h2>
              <ul className="list-disc space-y-1 ps-5 text-muted">{pickArray(job, "responsibilities", locale).map((r) => <li key={r}>{r}</li>)}</ul>
            </section>
            <section>
              <h2 className="mb-2 font-bold">{L("Qualifications", "المؤهلات")}</h2>
              <ul className="list-disc space-y-1 ps-5 text-muted">
                {pickArray(job, "qualifications", locale).map((r) => <li key={r}>{r}</li>)}
                {job.job_requirements.map((r) => <li key={r.id}>{pick(r, "text", locale)}</li>)}
              </ul>
            </section>
            {job.assessment && (
              <p className="rounded-2xl bg-sky-soft p-4 text-sm">
                {L("This role uses a practical assessment:", "تستخدم هذه الوظيفة تقييمًا عمليًا:")} <strong>{pick(job.assessment, "title", locale)}</strong>
                <span className="ltr-nums"> · {job.assessment.duration_minutes} {t.common.minutes}</span>
              </p>
            )}
            <section>
              <h2 className="mb-2 font-bold">{L("About the company", "عن الشركة")}</h2>
              <p className="text-sm text-muted">{pick(job.company, "description", locale)}</p>
            </section>
          </CardBody>
        </Card>
      </div>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title={L("How you match", "مدى مطابقتك")} description={L("Based only on what your profile states and proves.", "مبنية فقط على ما يذكره ملفك ويثبته.")} />
          <CardBody>
            <MatchExplanation match={match} t={t} locale={locale} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={L("Apply", "التقديم")} />
          <CardBody>
            {existing ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted">{L("You applied to this job.", "لقد تقدّمت لهذه الوظيفة.")}</p>
                <StatusBadge status={existing.status as ApplicationStatus} t={t} />
                <Button asChild variant="outline"><Link href={`/candidate/applications/${existing.id}`}>{L("Track application", "تتبّع الطلب")}</Link></Button>
              </div>
            ) : closed ? (
              <p className="text-sm text-muted">{L("This job is no longer accepting applications.", "لم تعد هذه الوظيفة تستقبل طلبات.")}</p>
            ) : (
              <ApplyForm
                jobId={job.id}
                cvs={(cvs ?? []).filter((c) => c.label !== "[archived]").map((c) => ({ id: c.id, label: `${c.label || c.file_name} (v${c.version})`, primary: c.is_primary }))}
                questions={job.job_application_questions.sort((a, b) => a.position - b.position).map((q) => ({ id: q.id, text: pick(q, "question", locale), required: q.is_required }))}
              />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
