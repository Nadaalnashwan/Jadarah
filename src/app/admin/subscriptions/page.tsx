import Link from "next/link";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDate, formatNumber, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { ProvisionForm } from "../b2b-client";
import { exhibitionMode } from "@/lib/exhibition";

const SAR = (n: number, locale: "ar" | "en") => `${formatNumber(Math.round(n), locale)} ${locale === "ar" ? "ر.س" : "SAR"}`;

export default async function Subscriptions() {
  const exhibition = exhibitionMode();
  await requireSuperAdmin();
  const { locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const [{ data: companies }, { data: payments }] = await Promise.all([
    supabase
      .from("company_profiles")
      .select("id, name_en, name_ar, registry_id, sector_en, sector_ar, listed, is_demo, status, company_subscriptions(status, plan, price_sar, expires_on, assessment_credits, credits_used, payment_status, is_demo)")
      .order("listed", { ascending: false })
      .order("name_en")
      // Exhibition: only the supported registry organizations.
      .or(exhibitionMode() ? "registry_id.not.is.null" : "id.not.is.null"),
    supabase.from("company_payments").select("company_id, kind, amount_sar"),
  ]);
  const paid = new Map<string, number>();
  for (const p of payments ?? []) paid.set(p.company_id, (paid.get(p.company_id) ?? 0) + (p.kind === "refund" ? -1 : 1) * Number(p.amount_sar));
  const rows = (companies ?? []).map((c) => {
    const s = Array.isArray(c.company_subscriptions) ? c.company_subscriptions[0] : c.company_subscriptions;
    const contract = s && !s.is_demo && s.price_sar !== null ? Number(s.price_sar) : 0;
    const received = paid.get(c.id) ?? 0;
    const outstanding = s && !s.is_demo && s.payment_status !== "waived" ? Math.max(0, contract - received) : 0;
    return { c, s, contract, received, outstanding };
  });
  const totals = {
    revenue: rows.reduce((a, r) => a + r.received, 0),
    contract: rows.reduce((a, r) => a + r.contract, 0),
    outstanding: rows.reduce((a, r) => a + r.outstanding, 0),
    demo: rows.filter((r) => r.s?.is_demo).length,
    active: rows.filter((r) => r.s?.status === "active" && !r.s.is_demo).length,
  };
  const tone = (s?: string) => (s === "active" ? "positive" : s === "pending" ? "progress" : s ? "negative" : "neutral");
  return (
    <>
      <PageHeader title={L("Subscriptions", "الاشتراكات")} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [L("Recorded payments", "المدفوعات المسجّلة"), SAR(totals.revenue, locale)],
          [L("Contract value", "قيمة العقود"), SAR(totals.contract, locale)],
          [L("Outstanding", "المستحق"), SAR(totals.outstanding, locale)],
          [L("Paid subscriptions active", "اشتراكات مدفوعة نشطة"), formatNumber(totals.active, locale)],
          [exhibition ? L("Complimentary access", "وصول مجاني") : L("Demonstration access", "وصول تجريبي"), formatNumber(totals.demo, locale)],
        ].map(([k, v]) => (
          <Card key={k} className="p-4">
            <p className="text-subtle text-xs">{k}</p>
            <p className="ltr-nums mt-1 text-xl font-extrabold">{v}</p>
          </Card>
        ))}
      </div>
      <Card className="mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-subtle text-xs">
            <tr className="border-b">
              <th className="p-3 text-start">{L("Organization", "الجهة")}</th>
              <th className="p-3 text-start">{L("Subscription", "الاشتراك")}</th>
              <th className="p-3 text-start">{L("Valid until", "صالح حتى")}</th>
              <th className="p-3 text-end">{L("Credits", "الرصيد")}</th>
              <th className="p-3 text-end">{L("Contract", "العقد")}</th>
              <th className="p-3 text-end">{L("Paid", "المدفوع")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, s, contract, received }) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="p-3">
                  <Link href={`/admin/subscriptions/${c.id}`} className="font-semibold hover:underline">
                    {locale === "ar" ? c.name_ar : c.name_en}
                  </Link>
                  <p className="text-subtle text-xs">
                    {c.registry_id ?? (c.is_demo && !exhibition ? L("Fictional demo", "تجريبية وهمية") : "—")}
                    {c.listed ? ` · ${L("Listed", "ظاهرة")}` : ""}
                  </p>
                </td>
                <td className="p-3">
                  <Badge tone={tone(s?.status)}>{s?.status ?? L("none", "لا يوجد")}</Badge>{" "}
                  {s?.is_demo && !exhibition && <Badge tone="neutral">{L("demo", "تجريبي")}</Badge>}
                </td>
                <td className="ltr-nums p-3">{s?.expires_on ? formatDate(s.expires_on, locale) : "—"}</td>
                <td className="ltr-nums p-3 text-end">{s ? `${s.credits_used}/${s.assessment_credits ?? "∞"}` : "—"}</td>
                <td className="ltr-nums p-3 text-end">{contract ? SAR(contract, locale) : "—"}</td>
                <td className="ltr-nums p-3 text-end">{received ? SAR(received, locale) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card>
        <CardHeader title={L("Provision organization", "تهيئة جهة")} />
        <CardBody>
          <ProvisionForm />
        </CardBody>
      </Card>
    </>
  );
}
