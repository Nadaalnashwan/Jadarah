import { notFound } from "next/navigation";
import { CompanyStatusBadge, JobStatusBadge } from "@/components/app/status-badge";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDate, formatDateTime, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { DocLink, ReviewForm } from "../../admin-client";

export default async function AdminCompanyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("company_profiles")
    .select(
      "*, company_verification_requests(*), company_memberships(role, status, profile:profiles!company_memberships_user_id_fkey(full_name, email)), jobs(id, title_en, title_ar, status)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();
  const { data: audit } = await supabase
    .from("audit_logs")
    .select("action, created_at, metadata, actor:profiles!audit_logs_actor_id_fkey(full_name)")
    .eq("company_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  return (
    <>
      <PageHeader
        eyebrow={c.industry}
        title={pick(c, "name", locale)}
        description={pick(c, "description", locale)}
        actions={<CompanyStatusBadge status={c.status} t={t} />}
      />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={L("Verification requests", "طلبات التحقق")} />
            <CardBody className="flex flex-col gap-3">
              {c.company_verification_requests.length === 0 && (
                <p className="text-subtle text-sm">
                  {L("No verification submitted yet", "لم يُرسل طلب تحقق بعد")}
                </p>
              )}
              {c.company_verification_requests.map((r) => (
                <div key={r.id} className="rounded-2xl border p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="font-semibold">{r.status}</span>
                    <span className="text-subtle text-xs">{formatDate(r.created_at, locale)}</span>
                  </div>
                  <p className="ltr-nums mt-1">CR: {r.commercial_registration ?? "—"}</p>
                  {r.notes && <p className="text-muted mt-1">{r.notes}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.document_paths.map((p) => (
                      <DocLink key={p} path={p} />
                    ))}
                  </div>
                  {r.reviewer_notes && (
                    <p className="text-subtle mt-2 text-xs">
                      {L("Reviewer", "المراجِع")}: {r.reviewer_notes}
                    </p>
                  )}
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={L("Jobs", "الوظائف")} />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {c.jobs.map((j) => (
                  <li key={j.id} className="flex justify-between">
                    {pick(j, "title", locale)} <JobStatusBadge status={j.status} t={t} />
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={L("Review history", "سجل المراجعة")} />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {(audit ?? []).map((a, i) => (
                  <li key={i}>
                    <span className="font-semibold">{a.action}</span> · {a.actor?.full_name ?? "—"} ·{" "}
                    <span className="text-subtle text-xs">{formatDateTime(a.created_at, locale)}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={L("Decision", "القرار")} description={c.status_reason ?? undefined} />
            <CardBody>
              <ReviewForm companyId={c.id} status={c.status} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={L("Details", "التفاصيل")} />
            <CardBody className="text-muted space-y-1 text-sm">
              <p>
                {c.city} · {c.size_range}
              </p>
              {c.website && <p dir="ltr">{c.website}</p>}
              {c.contact_email && <p dir="ltr">{c.contact_email}</p>}
              {c.contact_phone && <p dir="ltr">{c.contact_phone}</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={L("Members", "الأعضاء")} />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {c.company_memberships.map((m, i) => (
                  <li key={i}>
                    {m.profile?.full_name} · {t.roles[m.role]} {m.status !== "active" && `(${m.status})`}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
