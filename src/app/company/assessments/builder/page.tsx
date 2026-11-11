import { PageHeader } from "@/components/ui/primitives";
import { requireCompanyMember } from "@/lib/auth/session";
import { pick, pickArray, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { BuilderForm } from "./builder-form";

export default async function AssessmentBuilderPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const sp = await searchParams;
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const { locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title_en, title_ar, experience_level, description_en, description_ar, responsibilities_en, responsibilities_ar, job_skills(importance, skill:skills(name_en, name_ar))")
    .eq("company_id", s.activeMembership.company_id)
    .in("status", ["draft", "published", "paused"])
    .order("created_at", { ascending: false });
  const options = (jobs ?? []).map((j) => ({
    id: j.id,
    title: pick(j, "title", locale) ?? j.title_en,
    seniority: j.experience_level,
    description: pick(j, "description", locale) ?? "",
    responsibilities: (pickArray(j, "responsibilities", locale) ?? []).join("\n"),
    required: j.job_skills.filter((x) => x.importance === "required").map((x) => (locale === "ar" ? x.skill?.name_ar : x.skill?.name_en) ?? "").filter(Boolean),
    preferred: j.job_skills.filter((x) => x.importance !== "required").map((x) => (locale === "ar" ? x.skill?.name_ar : x.skill?.name_en) ?? "").filter(Boolean),
  }));
  return (
    <>
      <PageHeader title={L("Assessment Builder", "منشئ التقييمات")} />
      <BuilderForm jobs={options} initialJob={sp.job} />
    </>
  );
}
