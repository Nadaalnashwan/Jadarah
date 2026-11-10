import { CompanyStatusBadge } from "@/components/app/status-badge";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireCompanyMember } from "@/lib/auth/session";
import { formatDate, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { VerificationForm } from "./verification-form";

export default async function VerificationPage() {
  const s = await requireCompanyMember(["company_admin"]);
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const cid = s.activeMembership.company_id;
  const [{ data: company }, { data: requests }] = await Promise.all([
    supabase.from("company_profiles").select("status, status_reason").eq("id", cid).single(),
    supabase.from("company_verification_requests").select("*").eq("company_id", cid).order("created_at", { ascending: false }),
  ]);
  const status = company?.status ?? "pending";
  return (
    <>
      <PageHeader title={L("Company verification", "التحقق من الشركة")} actions={<CompanyStatusBadge status={status} t={t} />} description={company?.status_reason ? `${L("Reviewer note", "ملاحظة المراجِع")}: ${company.status_reason}` : undefined} />
      <div className="grid gap-6 lg:grid-cols-2">
        {status !== "approved" && status !== "suspended" && (
          <Card>
            <CardHeader title={L("Submit verification", "إرسال طلب التحقق")} description={L("Commercial registration and supporting documents (PDF or image, private).", "السجل التجاري والمستندات الداعمة (PDF أو صورة، خاصة).")} />
            <CardBody><VerificationForm companyId={cid} /></CardBody>
          </Card>
        )}
        <Card>
          <CardHeader title={L("History", "السجل")} />
          <CardBody>
            {(requests ?? []).length === 0 ? <p className="text-sm text-subtle">{L("No submissions yet.", "لا توجد طلبات بعد.")}</p> : (
              <ul className="flex flex-col gap-3">
                {requests!.map((r) => (
                  <li key={r.id} className="rounded-xl border p-3 text-sm">
                    <div className="flex justify-between"><span className="font-semibold">{r.status}</span><span className="text-xs text-subtle">{formatDate(r.created_at, locale)}</span></div>
                    {r.commercial_registration && <p className="ltr-nums mt-1 text-muted">CR: {r.commercial_registration}</p>}
                    <p className="ltr-nums text-xs text-subtle">{r.document_paths.length} {L("documents", "مستندات")}</p>
                    {r.reviewer_notes && <p className="mt-1 text-muted">{r.reviewer_notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
