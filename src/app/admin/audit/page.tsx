import Link from "next/link";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDateTime, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAudit({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const sp = await searchParams;
  await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const page = Math.max(1, Number(sp.page ?? 1));
  let q = supabase
    .from("audit_logs")
    .select(
      "id, action, entity_type, entity_id, metadata, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name), company:company_profiles(name_en, name_ar)",
      { count: "exact" },
    );
  if (sp.action) q = q.ilike("action", `%${sp.action.replace(/[%,]/g, "")}%`);
  const { data, count } = await q
    .order("created_at", { ascending: false })
    .range((page - 1) * 50, page * 50 - 1);
  return (
    <>
      <PageHeader title={t.admin.nav.audit} description={`${count ?? 0} ${t.common.results}`} />
      <form className="mb-4 flex gap-2">
        <Input
          name="action"
          defaultValue={sp.action}
          placeholder={L("Filter by action, e.g. company.approve", "تصفية حسب الإجراء، مثل company.approve")}
          dir="ltr"
        />
        <Button type="submit">{t.common.filter}</Button>
      </form>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="text-subtle text-xs">
              <tr className="border-b">
                <th className="p-3 text-start">{L("When", "الوقت")}</th>
                <th className="p-3 text-start">{L("Actor", "المنفّذ")}</th>
                <th className="p-3 text-start">{L("Action", "الإجراء")}</th>
                <th className="p-3 text-start">{L("Entity", "الكيان")}</th>
                <th className="p-3 text-start">{L("Details", "التفاصيل")}</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((a) => (
                <tr key={a.id} className="border-b align-top last:border-0">
                  <td className="text-subtle p-3 text-xs">{formatDateTime(a.created_at, locale)}</td>
                  <td className="p-3">{a.actor?.full_name ?? L("system", "النظام")}</td>
                  <td className="p-3 font-mono text-xs">{a.action}</td>
                  <td className="p-3 text-xs">
                    {a.entity_type}
                    {a.company && ` · ${locale === "ar" ? a.company.name_ar : a.company.name_en}`}
                  </td>
                  <td className="text-subtle max-w-xs truncate p-3 font-mono text-xs" dir="ltr">
                    {JSON.stringify(a.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="mt-4 flex justify-center gap-2">
        {page > 1 && (
          <Button asChild variant="outline" size="sm">
            <Link href={`?page=${page - 1}${sp.action ? `&action=${sp.action}` : ""}`}>
              {t.common.previous}
            </Link>
          </Button>
        )}
        {(count ?? 0) > page * 50 && (
          <Button asChild variant="outline" size="sm">
            <Link href={`?page=${page + 1}${sp.action ? `&action=${sp.action}` : ""}`}>{t.common.next}</Link>
          </Button>
        )}
      </div>
    </>
  );
}
