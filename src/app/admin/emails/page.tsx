import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDateTime, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { hasServerKey } from "@/lib/server-env";
import { createClient } from "@/lib/supabase/server";
import { emailConfig } from "@/services/email/provider";
import { RetryEmailButton } from "./retry";

const STATUSES = ["queued", "sending", "sent", "failed", "suppressed", "cancelled"] as const;

/** Outbound email delivery (Super Admin only; RLS on email_outbox allows nobody else). */
export default async function EmailDeliveryPage() {
  await requireSuperAdmin();
  const { locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const counts = await Promise.all(
    STATUSES.map(async (st) => {
      const { count, error } = await supabase.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", st);
      return { st, count: error ? null : (count ?? 0) };
    }),
  );
  const available = counts.every((c) => c.count !== null);
  const { data: recent } = await supabase
    .from("email_outbox")
    .select("id, template, status, attempts, max_attempts, last_error, provider, created_at, updated_at, sent_at, locale")
    .order("created_at", { ascending: false })
    .limit(40);
  const cfg = emailConfig();
  const label: Record<string, [string, string]> = {
    queued: ["Queued", "في الانتظار"],
    sending: ["Sending", "قيد الإرسال"],
    sent: ["Sent", "أُرسلت"],
    failed: ["Failed", "فشلت"],
    suppressed: ["Suppressed (test addresses)", "محجوبة (عناوين تجريبية)"],
    cancelled: ["Cancelled", "أُلغيت"],
  };
  const tone = (st: string) => (st === "sent" ? "positive" : st === "failed" ? "negative" : st === "queued" || st === "sending" ? "progress" : "muted");
  return (
    <>
      <PageHeader
        title={L("Email delivery", "تسليم البريد")}
        description={L(
          "Every email is queued once, retried with backoff on temporary errors, and never sent twice. Recipient addresses are not shown here.",
          "تُضاف كل رسالة مرة واحدة، وتُعاد المحاولة عند الأخطاء المؤقتة، ولا تُرسل مرتين. لا تُعرض عناوين المستلمين هنا.",
        )}
      />
      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold">{L("Provider", "المزوّد")}:</span>
          {cfg.configured ? (
            <Badge tone="positive">{cfg.provider === "log" ? L("Log only (testing)", "تسجيل فقط (اختبار)") : cfg.provider.toUpperCase()}</Badge>
          ) : (
            <Badge tone="negative">{L("Not configured", "غير مُهيّأ")} · {cfg.reason}</Badge>
          )}
          <span className="font-semibold">{L("Server key", "مفتاح الخادم")}:</span>
          <Badge tone={hasServerKey() ? "positive" : "negative"}>{hasServerKey() ? L("Configured", "مُهيّأ") : L("Missing", "مفقود")}</Badge>
          {!cfg.configured && (
            <span className="text-muted">
              {L("Emails stay queued until a provider is configured (see DEPLOYMENT.md).", "تبقى الرسائل في الانتظار حتى يُهيّأ مزوّد (راجع DEPLOYMENT.md).")}
            </span>
          )}
        </CardBody>
      </Card>
      {!available ? (
        <EmptyState
          title={L("Email delivery isn't enabled in this database yet", "تسليم البريد غير مُفعّل في قاعدة البيانات بعد")}
          body={L("Apply migration 0029 to enable the outbox.", "طبّق الترحيل 0029 لتفعيل صندوق الإرسال.")}
        />
      ) : (
        <>
          <ul className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {counts.map((c) => (
              <li key={c.st}>
                <Card className="p-4">
                  <p className="text-subtle text-xs">{locale === "ar" ? label[c.st][1] : label[c.st][0]}</p>
                  <p className="ltr-nums mt-1 text-2xl font-extrabold">{c.count}</p>
                </Card>
              </li>
            ))}
          </ul>
          <Card>
            <CardHeader title={L("Recent emails", "أحدث الرسائل")} />
            <CardBody>
              {(recent ?? []).length === 0 ? (
                <p className="text-subtle text-sm">—</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-sm">
                    <thead className="text-subtle text-xs">
                      <tr className="text-start">
                        <th className="p-2 text-start">{L("Created", "الإنشاء")}</th>
                        <th className="p-2 text-start">{L("Template", "القالب")}</th>
                        <th className="p-2 text-start">{L("Status", "الحالة")}</th>
                        <th className="p-2 text-start">{L("Attempts", "المحاولات")}</th>
                        <th className="p-2 text-start">{L("Last error", "آخر خطأ")}</th>
                        <th className="p-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {recent!.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="ltr-nums p-2">{formatDateTime(r.created_at, locale)}</td>
                          <td className="p-2">{r.template === "company_invitation" ? L("Team invitation", "دعوة فريق") : L("Notification", "إشعار")}</td>
                          <td className="p-2">
                            <Badge tone={tone(r.status)}>{locale === "ar" ? label[r.status]?.[1] : label[r.status]?.[0]}</Badge>
                          </td>
                          <td className="ltr-nums p-2">
                            {r.attempts}/{r.max_attempts}
                          </td>
                          <td className="text-subtle p-2 font-mono text-xs">{r.last_error ?? "—"}</td>
                          <td className="p-2 text-end">{r.status === "failed" && <RetryEmailButton id={r.id} />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </>
  );
}
