import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, PageHeader } from "@/components/ui/primitives";
import { requireCompanyMember } from "@/lib/auth/session";
import { pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { jobTaskLocked } from "@/features/company/job-task";
import { TaskCreationPaths, type TemplateOption } from "../task-client";

/** Step 2 of "Save & create practical task": choose how to create the job's task. */
export default async function JobTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ replace?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const { locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const cid = s.activeMembership.company_id;
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title_en, title_ar, status, assessment_id, experience_level, job_skills(importance, skill:skills(name_en, name_ar))")
    .eq("id", id)
    .eq("company_id", cid)
    .maybeSingle();
  if (!job) notFound();
  // A task already exists (e.g. the page was refreshed after creating one): continue with it instead of duplicating.
  if (job.assessment_id && sp.replace !== "1") redirect(`/company/jobs/${id}`);
  if (job.assessment_id && (await jobTaskLocked(supabase, id))) redirect(`/company/jobs/${id}`);

  const { data: tpl } = await supabase
    .from("assessments")
    .select("id, title_en, title_ar, description_en, description_ar, duration_minutes, company_id, assessment_questions(count)")
    .eq("status", "published")
    .or(`company_id.is.null,company_id.eq.${cid}`)
    .order("company_id", { ascending: true, nullsFirst: false })
    .order("title_en");
  const templates: TemplateOption[] = (tpl ?? []).map((a) => ({
    id: a.id,
    title: pick(a, "title", locale),
    description: pick(a, "description", locale) ?? null,
    minutes: a.duration_minutes,
    questions: (a.assessment_questions as unknown as { count: number }[])[0]?.count ?? 0,
    own: a.company_id === cid,
  }));
  const skills = job.job_skills
    .filter((x) => x.importance === "required")
    .map((x) => (locale === "ar" ? x.skill?.name_ar : x.skill?.name_en))
    .filter(Boolean);
  const Back = locale === "ar" ? ArrowRight : ArrowLeft;
  return (
    <>
      <PageHeader
        title={L("Create the practical task", "إنشاء المهمة العملية")}
        description={L(
          "Linked to the job below. The job stays a draft — nothing is published until you choose to.",
          "مرتبطة بالوظيفة أدناه. تبقى الوظيفة مسودة، ولا يُنشر شيء حتى تقرر ذلك.",
        )}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href={`/company/jobs/${id}`}>
              <Back /> {L("Back to job", "العودة إلى الوظيفة")}
            </Link>
          </Button>
        }
      />
      <div className="surface-card mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span className="font-bold">{pick(job, "title", locale)}</span>
        <Badge tone={job.status === "published" ? "positive" : "neutral"}>{job.status}</Badge>
        {skills.length > 0 && (
          <span className="text-muted">
            {L("Required skills", "المهارات المطلوبة")}: {skills.join("، ")}
          </span>
        )}
      </div>
      <TaskCreationPaths jobId={id} templates={templates} />
    </>
  );
}
