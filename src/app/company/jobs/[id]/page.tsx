import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { JobStatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
import { requireCompanyMember } from "@/lib/auth/session";
import { pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { JobEditor } from "../editor";
import { loadJobFormOptions } from "../load";
import { JobStatusActions } from "../status-actions";

export default async function EditJob({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: j } = await supabase
    .from("jobs")
    .select(
      "*, job_skills(skill_id, importance, min_level), job_application_questions(question_en, question_ar, position)",
    )
    .eq("id", id)
    .eq("company_id", s.activeMembership.company_id)
    .maybeSingle();
  if (!j) notFound();
  const opts = await loadJobFormOptions(supabase, s.activeMembership.company_id, locale);
  const qs = [...j.job_application_questions].sort((a, b) => a.position - b.position);
  return (
    <>
      <PageHeader
        title={pick(j, "title", locale)}
        actions={
          <>
            <JobStatusBadge status={j.status} t={t} />
            <JobStatusActions jobId={j.id} status={j.status} />
            {j.status === "published" && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/jobs/${j.id}`} target="_blank">
                  <Eye /> {L("Public preview", "معاينة عامة")}
                </Link>
              </Button>
            )}
          </>
        }
      />
      <JobEditor
        jobId={j.id}
        {...opts}
        initial={{
          title_en: j.title_en,
          title_ar: j.title_ar,
          description_en: j.description_en,
          description_ar: j.description_ar,
          responsibilities_en: j.responsibilities_en.join("\n"),
          responsibilities_ar: j.responsibilities_ar.join("\n"),
          qualifications_en: j.qualifications_en.join("\n"),
          qualifications_ar: j.qualifications_ar.join("\n"),
          category_id: j.category_id ?? "",
          experience_level: j.experience_level,
          min_years: j.min_years,
          city: j.city,
          work_mode: j.work_mode,
          employment_type: j.employment_type,
          salary_min: j.salary_min?.toString() ?? "",
          salary_max: j.salary_max?.toString() ?? "",
          salary_visible: j.salary_visible,
          education_level: j.education_level ?? "",
          openings: j.openings,
          deadline: j.deadline ?? "",
          assessment_id: j.assessment_id ?? "",
          questions_en: qs.map((q) => q.question_en).join("\n"),
          questions_ar: qs.map((q) => q.question_ar).join("\n"),
          skills: j.job_skills.map((x) => ({
            skill_id: x.skill_id,
            importance: x.importance as "required",
            min_level: x.min_level,
          })),
        }}
      />
    </>
  );
}
