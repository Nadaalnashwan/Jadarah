import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireCompanyMember } from "@/lib/auth/session";
import { pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/** Talent pool: candidates who opted in to discovery by approved companies (visibility = 'companies'). */
export default async function TalentPool({ searchParams }: { searchParams: Promise<{ skill?: string; q?: string }> }) {
  const sp = await searchParams;
  await requireCompanyMember(["company_admin", "recruiter"]);
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const [{ data: profiles }, { data: skills }] = await Promise.all([
    supabase.from("candidate_profiles").select("user_id, headline, city, years_experience, experience_level, open_to_work, profile:profiles!candidate_profiles_user_id_fkey(full_name), candidate_skills(level, source, skill:skills(slug, name_en, name_ar))").eq("visibility", "companies").eq("open_to_work", true).limit(200),
    supabase.from("skills").select("slug, name_en, name_ar").order("name_en"),
  ]);
  let rows = profiles ?? [];
  if (sp.skill) rows = rows.filter((p) => p.candidate_skills.some((s) => s.skill?.slug === sp.skill && s.level >= 3));
  if (sp.q) rows = rows.filter((p) => `${p.profile?.full_name} ${p.headline}`.toLowerCase().includes(sp.q!.toLowerCase()));
  return (
    <>
      <PageHeader title={t.company.nav.talent} description={L("Only candidates who chose to be discoverable by approved companies appear here.", "يظهر هنا فقط المرشحون الذين اختاروا أن تكتشفهم الشركات المعتمدة.")} />
      {profiles === null ? (
        <Card><EmptyState title={L("The talent pool is available once your company is approved.", "يتاح مجمّع المواهب بعد اعتماد شركتك.")} /></Card>
      ) : (
        <>
          <form className="surface-card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
            <Input name="q" defaultValue={sp.q} placeholder={L("Name or headline…", "الاسم أو العنوان…")} aria-label={t.common.search} />
            <Select name="skill" defaultValue={sp.skill ?? ""} aria-label={L("Skill (level 3+)", "مهارة (مستوى 3+)")}><option value="">{L("Any skill", "أي مهارة")}</option>{(skills ?? []).map((s) => <option key={s.slug} value={s.slug}>{pick(s, "name", locale)}</option>)}</Select>
            <Button type="submit">{t.common.filter}</Button>
          </form>
          {rows.length === 0 ? <Card><EmptyState title={L("No matching candidates", "لا يوجد مرشحون مطابقون")} /></Card> : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((p) => (
                <li key={p.user_id} className="surface-card p-5">
                  <p className="font-bold">{p.profile?.full_name}</p>
                  <p className="text-sm text-muted">{p.headline}</p>
                  <p className="ltr-nums mt-1 text-xs text-subtle">{p.city} · {p.years_experience ?? 0} {t.common.years}{p.experience_level ? ` · ${t.level[p.experience_level]}` : ""}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[...p.candidate_skills].sort((a, b) => b.level - a.level).slice(0, 6).map((s) => <Badge key={s.skill?.slug} tone={s.source === "self" ? "neutral" : "progress"}>{pick(s.skill, "name", locale)} · <span className="ltr-nums">{s.level}</span></Badge>)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
