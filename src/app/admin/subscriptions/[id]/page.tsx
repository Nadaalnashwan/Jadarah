import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDate, formatNumber, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { BrandForm, PaymentForm, SubscriptionForm } from "../../b2b-client";

export default async function SubscriptionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSuperAdmin();
  const { locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const [{ data: c }, { data: sub }, { data: brand }, { data: payments }, { data: usage }] = await Promise.all([
    supabase.from("company_profiles").select("id, name_en, name_ar, registry_id, listed, accepts_access_requests, sector_en, sector_ar").eq("id", id).maybeSingle(),
    supabase.from("company_subscriptions").select("*").eq("company_id", id).maybeSingle(),
    supabase.from("company_brand_profiles").select("*").eq("company_id", id).maybeSingle(),
    supabase.from("company_payments").select("id, kind, amount_sar, paid_on, reference").eq("company_id", id).order("paid_on", { ascending: false }),
    supabase.rpc("company_dashboard_stats", { p_company: id }),
  ]);
  if (!c) notFound();
  const u = (usage ?? {}) as { applications_by_status?: Record<string, number>; jobs_by_status?: Record<string, number>; upcoming_interviews?: number };
  const sum = (o?: Record<string, number>) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHeader eyebrow={c.registry_id ?? undefined} title={locale === "ar" ? c.name_ar : c.name_en} description={locale === "ar" ? (c.sector_ar ?? "") : (c.sector_en ?? "")} />
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          [L("Jobs", "الوظائف"), sum(u.jobs_by_status)],
          [L("Applications", "الطلبات"), sum(u.applications_by_status)],
          [L("Upcoming interviews", "مقابلات قادمة"), u.upcoming_interviews ?? 0],
          [L("Assessments used", "التقييمات المستخدمة"), sub?.credits_used ?? 0],
        ].map(([k, v]) => (
          <Card key={String(k)} className="p-4">
            <p className="text-subtle text-xs">{k}</p>
            <p className="ltr-nums mt-1 text-xl font-extrabold">{formatNumber(Number(v), locale)}</p>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title={L("Subscription", "الاشتراك")} />
          <CardBody>
            <SubscriptionForm companyId={c.id} sub={sub} listed={c.listed} acceptsRequests={c.accepts_access_requests} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={L("Payments", "المدفوعات")} />
          <CardBody className="flex flex-col gap-4">
            {(payments ?? []).length > 0 && (
              <ul className="divide-y rounded-2xl border text-sm">
                {payments!.map((p) => (
                  <li key={p.id} className="flex justify-between p-3">
                    <span>{p.kind === "refund" ? L("Refund", "استرداد") : L("Payment", "دفعة")} · {p.reference ?? "—"}</span>
                    <span className="ltr-nums">{formatNumber(Number(p.amount_sar), locale)} · {formatDate(p.paid_on, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
            {sub?.is_demo ? (
              <p className="text-muted text-sm">{L("Demonstration access — no payments recorded.", "وصول تجريبي — لا تُسجَّل مدفوعات.")}</p>
            ) : (
              <PaymentForm companyId={c.id} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={L("Brand profile", "الهوية")} />
          <CardBody>
            <BrandForm companyId={c.id} brand={brand} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
