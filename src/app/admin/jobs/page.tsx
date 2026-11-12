import { JobStatusBadge } from "@/components/app/status-badge";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDate, formatNumber, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { exhibitionMode } from "@/lib/exhibition";
import { createClient } from "@/lib/supabase/server";
import { dateRange, pageOf, pageRange, searchTerm, validUuid, type AdminListParams } from "@/lib/admin-filters";
import { AdminFilterBar, AdminPager } from "../list-controls";

const JOB_STATUSES = ["draft", "published", "paused", "closed", "archived"] as const;

export default async function AdminJobs({ searchParams }: { searchParams: Promise<AdminListParams> }) {
  const sp = await searchParams;
  await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const page = pageOf(sp);
  const exhibition = exhibitionMode();
  let cq = supabase.from("company_profiles").select("id, name_en, name_ar").order("name_en");
  if (exhibition) cq = cq.not("registry_id", "is", null);
  const { data: companyRows } = await cq;
  let q = supabase
    .from("jobs")
    .select(
      `id, title_en, title_ar, status, city, published_at, created_at, ai_assisted, company:company_profiles${exhibition ? "!inner" : ""}(name_en, name_ar, registry_id), applications(count)`,
      { count: "exact" },
    );
  if (exhibition) q = q.not("company.registry_id", "is", null);
  const term = searchTerm(sp.q);
  if (term) q = q.or(`title_en.ilike.%${term}%,title_ar.ilike.%${term}%`);
  if (sp.status && (JOB_STATUSES as readonly string[]).includes(sp.status)) q = q.eq("status", sp.status as "draft");
  const company = validUuid(sp.company);
  if (company) q = q.eq("company_id", company);
  const range = dateRange(sp);
  if (range.gte) q = q.gte("created_at", range.gte);
  if (range.lt) q = q.lt("created_at", range.lt);
  const [from, to] = pageRange(page);
  const { data, count } = await q.order("created_at", { ascending: false }).range(from, to);
  return (
    <>
      <PageHeader title={t.admin.nav.jobs} description={`${count ?? 0} ${t.common.results}`} />
      <AdminFilterBar
        params={sp}
        locale={locale}
        searchPlaceholder={L("Job title…", "المسمى الوظيفي…")}
        status={{ label: t.common.status, options: JOB_STATUSES.map((v) => ({ value: v, label: t.jobStatus[v] })) }}
        companies={(companyRows ?? []).map((c) => ({ value: c.id, label: pick(c, "name", locale) }))}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="text-subtle text-xs">
              <tr className="border-b">
                <th className="p-4 text-start">{L("Job", "الوظيفة")}</th>
                <th className="p-4 text-start">{L("Company", "الشركة")}</th>
                <th className="p-4 text-start">{t.common.status}</th>
                <th className="p-4 text-start">{L("Applications", "الطلبات")}</th>
                <th className="p-4 text-start">{L("Published", "النشر")}</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((j) => (
                <tr key={j.id} className="border-b last:border-0">
                  <td className="p-4 font-semibold">
                    {pick(j, "title", locale)}
                    {j.ai_assisted && <span className="text-subtle ms-2 text-xs">AI-assisted</span>}
                  </td>
                  <td className="text-muted p-4">{pick(j.company, "name", locale)}</td>
                  <td className="p-4">
                    <JobStatusBadge status={j.status} t={t} />
                  </td>
                  <td className="ltr-nums p-4">
                    {formatNumber((j.applications as unknown as { count: number }[])[0]?.count ?? 0, locale)}
                  </td>
                  <td className="text-muted p-4">{formatDate(j.published_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data ?? []).length === 0 && (
            <p className="text-muted p-6 text-center text-sm">{L("No jobs match these filters", "لا توجد وظائف مطابقة")}</p>
          )}
        </div>
      </Card>
      <AdminPager params={sp} page={page} count={count ?? 0} locale={locale} />
    </>
  );
}
