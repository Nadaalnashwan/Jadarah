import Link from "next/link";
import { Plus } from "lucide-react";
import { ListingBadge } from "@/components/app/company-mark";
import { JobStatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireCompanyMember } from "@/lib/auth/session";
import { formatDate, formatNumber, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { JobStatusActions } from "./status-actions";

export default async function CompanyJobs({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  let q = supabase
    .from("jobs")
    .select("id, title_en, title_ar, status, listing_type, city, deadline, published_at, updated_at, applications(count)")
    .eq("company_id", s.activeMembership.company_id);
  if (sp.status) q = q.eq("status", sp.status as "draft");
  const { data } = await q.order("updated_at", { ascending: false });
  const jobs = data ?? [];
  return (
    <>
      <PageHeader
        title={t.company.nav.jobs}
        actions={
          <Button asChild>
            <Link href="/company/jobs/new">
              <Plus /> {L("New job", "وظيفة جديدة")}
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {["", "draft", "published", "paused", "closed", "archived"].map((st) => (
          <Link
            key={st}
            href={st ? `?status=${st}` : "?"}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${sp.status === st || (!sp.status && !st) ? "bg-navy text-ivory dark:bg-royal" : "bg-surface-2"}`}
          >
            {st ? t.jobStatus[st as keyof typeof t.jobStatus] : t.common.all}
          </Link>
        ))}
      </div>
      <Card>
        {jobs.length === 0 ? (
          <EmptyState
            title={L("No jobs yet", "لا توجد وظائف بعد")}
            action={
              <Button asChild>
                <Link href="/company/jobs/new">{L("Create a job", "أنشئ وظيفة")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="text-subtle text-xs">
                <tr className="border-b">
                  <th className="p-4 text-start">{L("Title", "المسمى")}</th>
                  <th className="p-4 text-start">{t.common.status}</th>
                  <th className="p-4 text-start">{L("Applicants", "المتقدمون")}</th>
                  <th className="p-4 text-start">{L("Deadline", "الموعد النهائي")}</th>
                  <th className="p-4 text-end">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-surface-2/50 border-b last:border-0">
                    <td className="p-4">
                      <Link
                        href={`/company/jobs/${j.id}`}
                        className="hover:text-primary dark:hover:text-lavender font-semibold"
                      >
                        {pick(j, "title", locale)}
                      </Link>{" "}
                      <ListingBadge type={j.listing_type} locale={locale} />
                      <p className="text-subtle text-xs">{j.city}</p>
                    </td>
                    <td className="p-4">
                      <JobStatusBadge status={j.status} t={t} />
                    </td>
                    <td className="ltr-nums p-4">
                      <Link
                        href={`/company/applications?job=${j.id}`}
                        className="font-semibold hover:underline"
                      >
                        {formatNumber(
                          (j.applications as unknown as { count: number }[])[0]?.count ?? 0,
                          locale,
                        )}
                      </Link>
                    </td>
                    <td className="text-muted p-4">{formatDate(j.deadline, locale)}</td>
                    <td className="p-4">
                      <div className="flex justify-end">
                        <JobStatusActions jobId={j.id} status={j.status} />
                      </div>
                    </td>
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
