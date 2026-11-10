import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatNumber, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAssessments() {
  await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data } = await supabase.from("assessments").select("id, title_en, title_ar, status, category, difficulty, duration_minutes, ai_generated, company:company_profiles(name_en, name_ar), assessment_questions(count), assessment_assignments(count)").order("company_id", { nullsFirst: true }).order("title_en");
  return (
    <>
      <PageHeader title={t.admin.nav.assessments} description={L("Platform library (no company) and company-owned assessments.", "مكتبة المنصة (بلا شركة) والتقييمات المملوكة للشركات.")} />
      <Card><div className="overflow-x-auto"><table className="w-full min-w-[44rem] text-sm">
        <thead className="text-xs text-subtle"><tr className="border-b"><th className="p-4 text-start">{L("Assessment", "التقييم")}</th><th className="p-4 text-start">{L("Owner", "المالك")}</th><th className="p-4 text-start">{t.common.status}</th><th className="p-4 text-start">{L("Questions", "الأسئلة")}</th><th className="p-4 text-start">{L("Assigned", "المُسند")}</th></tr></thead>
        <tbody>{(data ?? []).map((a) => <tr key={a.id} className="border-b last:border-0"><td className="p-4"><p className="font-semibold">{pick(a, "title", locale)}</p><p className="text-xs text-subtle">{a.category} · {a.difficulty} · {a.duration_minutes} {t.common.minutes}</p></td><td className="p-4 text-muted">{a.company ? pick(a.company, "name", locale) : L("Platform library", "مكتبة المنصة")}</td><td className="p-4"><Badge tone={a.status === "published" ? "positive" : "neutral"}>{a.status}</Badge>{a.ai_generated && <Badge tone="progress" className="ms-1">AI</Badge>}</td><td className="ltr-nums p-4">{formatNumber((a.assessment_questions as unknown as { count: number }[])[0]?.count ?? 0, locale)}</td><td className="ltr-nums p-4">{formatNumber((a.assessment_assignments as unknown as { count: number }[])[0]?.count ?? 0, locale)}</td></tr>)}</tbody>
      </table></div></Card>
    </>
  );
}
