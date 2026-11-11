import { PageHeader } from "@/components/ui/primitives";
import { requireCompanyMember } from "@/lib/auth/session";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { JobEditor } from "../editor";
import { loadJobFormOptions } from "../load";

export default async function NewJob() {
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const { locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const opts = await loadJobFormOptions(supabase, s.activeMembership.company_id, locale);
  return (
    <>
      <PageHeader
        title={L("New job", "وظيفة جديدة")}
        description={L(
          "Jobs are saved as drafts. Publish when ready — publishing requires an approved company.",
          "تُحفظ الوظائف كمسودات. انشر عندما تكون جاهزًا — يتطلب النشر شركة معتمدة.",
        )}
      />
      <JobEditor
        jobId={null}
        {...opts}
        initial={{
          title_en: "",
          title_ar: "",
          description_en: "",
          description_ar: "",
          responsibilities_en: "",
          responsibilities_ar: "",
          qualifications_en: "",
          qualifications_ar: "",
          category_id: "",
          experience_level: "mid",
          min_years: 0,
          city: "",
          work_mode: "onsite",
          employment_type: "full_time",
          salary_min: "",
          salary_max: "",
          salary_visible: false,
          education_level: "",
          openings: 1,
          deadline: "",
          questions_en: "",
          questions_ar: "",
          skills: [{ skill_id: "", importance: "required", min_level: 3 }],
        }}
      />
    </>
  );
}
