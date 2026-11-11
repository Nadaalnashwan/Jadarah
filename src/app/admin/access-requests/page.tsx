import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDateTime, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AccessRequestActions } from "../b2b-client";

export default async function AccessRequests() {
  await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_access_requests")
    .select(
      "id, status, job_title, requested_role, granted_role, decision_note, created_at, reviewed_at, user:profiles!company_access_requests_user_id_fkey(full_name, email, is_demo), company:company_profiles!company_access_requests_company_id_fkey(name_en, name_ar)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []).sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
  const tone = (s: string) => (s === "approved" ? "positive" : s === "rejected" ? "negative" : s === "pending" ? "progress" : "neutral");
  return (
    <>
      <PageHeader title={L("Access requests", "طلبات الانضمام")} />
      {rows.length === 0 ? (
        <EmptyState title={L("No requests", "لا توجد طلبات")} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-subtle text-xs">
              <tr className="border-b">
                <th className="p-3 text-start">{L("Employee", "الموظف")}</th>
                <th className="p-3 text-start">{L("Organization", "الجهة")}</th>
                <th className="p-3 text-start">{L("Job title", "المسمى")}</th>
                <th className="p-3 text-start">{L("Role", "الدور")}</th>
                <th className="p-3 text-start">{L("Status", "الحالة")}</th>
                <th className="p-3 text-start" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 align-top">
                  <td className="p-3">
                    <p className="font-semibold">{r.user?.full_name}</p>
                    <p className="text-subtle text-xs" dir="ltr">{r.user?.email}</p>
                  </td>
                  <td className="p-3">{locale === "ar" ? r.company?.name_ar : r.company?.name_en}</td>
                  <td className="p-3">{r.job_title}</td>
                  <td className="p-3">{t.roles[(r.granted_role ?? r.requested_role) as "recruiter"]}</td>
                  <td className="p-3">
                    <Badge tone={tone(r.status)}>{r.status}</Badge>
                    <p className="text-subtle ltr-nums mt-1 text-[11px]">{formatDateTime(r.reviewed_at ?? r.created_at, locale)}</p>
                    {r.decision_note && <p className="text-muted mt-1 text-xs">{r.decision_note}</p>}
                  </td>
                  <td className="p-3">{r.status === "pending" && <AccessRequestActions id={r.id} requestedRole={r.requested_role} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
