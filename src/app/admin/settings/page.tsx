import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { aiStatus } from "@/services/ai/provider";
import { SettingForm } from "../admin-client";

export default async function AdminSettings() {
  await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("*").order("key");
  const ai = aiStatus();
  const integrations = [
    {
      name: "Supabase Auth",
      ok: true,
      note: L(
        "Email confirmation enabled; default SMTP (rate-limited)",
        "تأكيد البريد مفعّل؛ SMTP الافتراضي (محدود)",
      ),
    },
    {
      name: "Supabase Storage",
      ok: true,
      note: L("6 private buckets with object policies", "6 حاويات خاصة بسياسات"),
    },
    {
      name: "AI provider",
      ok: ai.configured,
      note: ai.configured
        ? `${ai.provider} · ${ai.model}`
        : L("Not configured — rule-based fallbacks active", "غير مضبوط — البدائل المبنية على قواعد مفعّلة"),
    },
    {
      name: "Transactional email",
      ok: false,
      note: L(
        "Platform notification emails are not sent until an email provider is configured",
        "لا تُرسل رسائل الإشعارات حتى يُضبط مزوّد بريد",
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title={t.admin.nav.settings}
        description={L(
          "Secrets are never stored here — only non-sensitive configuration",
          "لا تُخزّن الأسرار هنا — فقط الإعدادات غير الحساسة",
        )}
      />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title={L("Settings (JSON values)", "الإعدادات (قيم JSON)")} />
          <CardBody className="flex flex-col gap-3">
            {(data ?? []).map((s) => (
              <SettingForm
                key={s.key}
                k={s.key}
                value={JSON.stringify(s.value)}
                description={s.description}
              />
            ))}
            <div className="border-t pt-3">
              <p className="mb-2 text-sm font-semibold">{L("Add setting", "إضافة إعداد")}</p>
              <SettingForm />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={L("Integration status", "حالة التكاملات")} />
          <CardBody>
            <ul className="space-y-3 text-sm">
              {integrations.map((i) => (
                <li key={i.name} className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${i.ok ? "bg-success" : "bg-warning"}`}
                  />
                  <span>
                    <span className="font-semibold">{i.name}</span>
                    <br />
                    <span className="text-muted">{i.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
