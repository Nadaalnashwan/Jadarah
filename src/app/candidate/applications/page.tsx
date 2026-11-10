import Link from "next/link";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireCandidate } from "@/lib/auth/session";
import type { ApplicationStatus } from "@/lib/domain/application-status";
import { formatDate, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function ApplicationsPage() {
  const session = await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select("id, status, submitted_at, updated_at, job:jobs(id, title_en, title_ar, city, company:company_profiles(name_en, name_ar))")
    .eq("candidate_id", session.userId)
    .order("updated_at", { ascending: false });
  const apps = data ?? [];
  return (
    <>
      <PageHeader eyebrow={t.candidate.nav.applications} title={L("Your applications", "طلباتك")} description={L("Every status change is recorded. Feedback appears here only when a company chooses to share it.", "كل تغيير في الحالة مُسجَّل. تظهر الملاحظات هنا فقط عندما تختار الشركة مشاركتها.")} />
      <Card>
        {apps.length === 0 ? (
          <EmptyState title={t.candidate.noApplications} action={<Button asChild><Link href="/candidate/jobs">{t.candidate.browseJobs}</Link></Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-xs text-subtle">
                <tr className="border-b">
                  <th className="p-4 text-start font-semibold">{L("Role", "الوظيفة")}</th>
                  <th className="p-4 text-start font-semibold">{L("Company", "الشركة")}</th>
                  <th className="p-4 text-start font-semibold">{t.common.status}</th>
                  <th className="p-4 text-start font-semibold">{L("Applied", "تاريخ التقديم")}</th>
                  <th className="p-4 text-start font-semibold">{L("Last update", "آخر تحديث")}</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-surface-2/60">
                    <td className="p-4 font-semibold"><Link href={`/candidate/applications/${a.id}`} className="hover:text-primary dark:hover:text-lavender">{pick(a.job, "title", locale)}</Link></td>
                    <td className="p-4 text-muted">{pick(a.job?.company, "name", locale)}</td>
                    <td className="p-4"><StatusBadge status={a.status as ApplicationStatus} t={t} /></td>
                    <td className="p-4 text-muted">{formatDate(a.submitted_at, locale)}</td>
                    <td className="p-4 text-muted">{formatDate(a.updated_at, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
