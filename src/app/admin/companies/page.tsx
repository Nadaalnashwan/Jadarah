import Link from "next/link";
import { CompanyStatusBadge } from "@/components/app/status-badge";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDate, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function AdminCompanies({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  let q = supabase
    .from("company_profiles")
    .select(
      "id, name_en, name_ar, industry, city, status, created_at, is_demo, jobs(count), company_memberships(count)",
    )
    .order("created_at", { ascending: false });
  if (sp.status === "pending") q = q.in("status", ["pending", "info_requested"]);
  else if (sp.status) q = q.eq("status", sp.status as "approved");
  const { data } = await q;
  return (
    <>
      <PageHeader title={t.admin.nav.companies} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {["", "pending", "approved", "rejected", "suspended"].map((st) => (
          <Link
            key={st}
            href={st ? `?status=${st}` : "?"}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${(sp.status ?? "") === st ? "bg-foreground text-background" : "bg-surface-2"}`}
          >
            {st ? t.companyStatus[st as keyof typeof t.companyStatus] : t.common.all}
          </Link>
        ))}
      </div>
      <Card>
        {(data ?? []).length === 0 ? (
          <EmptyState title={t.common.emptyTitle} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead className="text-subtle text-xs">
                <tr className="border-b">
                  <th className="p-4 text-start">{L("Company", "الشركة")}</th>
                  <th className="p-4 text-start">{L("Industry", "القطاع")}</th>
                  <th className="p-4 text-start">{t.common.status}</th>
                  <th className="p-4 text-start">{L("Jobs / members", "الوظائف / الأعضاء")}</th>
                  <th className="p-4 text-start">{L("Registered", "التسجيل")}</th>
                </tr>
              </thead>
              <tbody>
                {data!.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-2/50 border-b last:border-0">
                    <td className="p-4">
                      <Link
                        href={`/admin/companies/${c.id}`}
                        className="hover:text-primary font-semibold"
                      >
                        {locale === "ar" ? c.name_ar : c.name_en}
                      </Link>
                      {c.is_demo && <span className="text-subtle ms-2 text-xs">demo</span>}
                    </td>
                    <td className="text-muted p-4">
                      {c.industry} · {c.city}
                    </td>
                    <td className="p-4">
                      <CompanyStatusBadge status={c.status} t={t} />
                    </td>
                    <td className="ltr-nums p-4">
                      {(c.jobs as unknown as { count: number }[])[0]?.count ?? 0} /{" "}
                      {(c.company_memberships as unknown as { count: number }[])[0]?.count ?? 0}
                    </td>
                    <td className="text-muted p-4">{formatDate(c.created_at, locale)}</td>
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
