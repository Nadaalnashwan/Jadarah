import { JobStatusBadge } from "@/components/app/status-badge";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDate, formatNumber, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function AdminJobs() {
  await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select("id, title_en, title_ar, status, city, published_at, ai_assisted, company:company_profiles(name_en, name_ar), applications(count)").order("created_at", { ascending: false }).limit(300);
  return (
    <>
      <PageHeader title={t.admin.nav.jobs} description={L("Oversight of all jobs across companies.", "إشراف على جميع الوظائف في الشركات.")} />
      <Card><div className="overflow-x-auto"><table className="w-full min-w-[44rem] text-sm">
        <thead className="text-xs text-subtle"><tr className="border-b"><th className="p-4 text-start">{L("Job", "الوظيفة")}</th><th className="p-4 text-start">{L("Company", "الشركة")}</th><th className="p-4 text-start">{t.common.status}</th><th className="p-4 text-start">{L("Applications", "الطلبات")}</th><th className="p-4 text-start">{L("Published", "النشر")}</th></tr></thead>
        <tbody>{(data ?? []).map((j) => <tr key={j.id} className="border-b last:border-0"><td className="p-4 font-semibold">{pick(j, "title", locale)}{j.ai_assisted && <span className="ms-2 text-xs text-subtle">AI-assisted</span>}</td><td className="p-4 text-muted">{pick(j.company, "name", locale)}</td><td className="p-4"><JobStatusBadge status={j.status} t={t} /></td><td className="ltr-nums p-4">{formatNumber((j.applications as unknown as { count: number }[])[0]?.count ?? 0, locale)}</td><td className="p-4 text-muted">{formatDate(j.published_at, locale)}</td></tr>)}</tbody>
      </table></div></Card>
    </>
  );
}
