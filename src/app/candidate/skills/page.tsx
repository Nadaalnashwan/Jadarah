import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireCandidate } from "@/lib/auth/session";
import { pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getCandidateSkills } from "@/services/candidate";
import { SkillsExplorer } from "./skills-client";

export default async function SkillsPage() {
  const session = await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const [skills, { data: taxonomy }, { data: goal }] = await Promise.all([
    getCandidateSkills(supabase, session.userId),
    supabase.from("skills").select("id, slug, name_en, name_ar, category:skill_categories(slug, name_en, name_ar)").order("name_en"),
    supabase.from("development_plans").select("required_skill_slugs, title_en, title_ar").eq("candidate_id", session.userId).eq("status", "active").maybeSingle(),
  ]);
  return (
    <>
      <PageHeader eyebrow={t.candidate.nav.skills} title={L("Your skill intelligence", "ذكاء مهاراتك")} description={L("Each skill shows where its evidence comes from. Assessments and reviewed CV extraction carry more weight than self-declarations.", "تُظهر كل مهارة مصدر دليلها. التقييمات واستخراج السيرة المراجَع أثقل وزنًا من التصريح الذاتي.")} />
      <Card>
        <CardHeader title={L("Skill map", "خريطة المهارات")} description={goal ? `${L("Compared with your target:", "مقارنةً بهدفك:")} ${pick(goal, "title", locale)}` : undefined} />
        <CardBody>
          <SkillsExplorer
            skills={skills.filter((s) => s.skill).map((s) => ({ id: s.id, skill_id: s.skill!.id, slug: s.skill!.slug, name: pick(s.skill, "name", locale), category: pick(s.skill!.category, "name", locale) || "—", level: s.level, source: s.source as "self", evidence: s.evidence }))}
            taxonomy={(taxonomy ?? []).map((s) => ({ id: s.id, slug: s.slug, name: pick(s, "name", locale), category: pick(s.category, "name", locale) }))}
            targetSlugs={goal?.required_skill_slugs ?? []}
          />
        </CardBody>
      </Card>
    </>
  );
}
