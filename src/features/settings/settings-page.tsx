import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { LanguageSwitcher, ThemeToggle } from "@/components/shell/preference-toggles";
import { requestDeactivation } from "@/features/candidate/actions";
import { saveNotificationPreferences } from "@/features/notifications/actions";
import { requireSession } from "@/lib/auth/session";
import { formatDate, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export async function SettingsPage({ candidate }: { candidate?: boolean }) {
  const session = await requireSession();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", session.userId)
    .maybeSingle();
  return (
    <>
      <PageHeader title={t.common.settings} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={L("Language & appearance", "اللغة والمظهر")} />
          <CardBody className="flex items-center gap-2">
            <LanguageSwitcher className="border" />
            <ThemeToggle className="border" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title={t.common.notifications}
            description={L(
              "Email is sent only when an email provider is configured for the platform",
              "يُرسل البريد فقط عند ضبط مزوّد بريد للمنصة",
            )}
          />
          <CardBody>
            <form action={saveNotificationPreferences} className="flex flex-col gap-3">
              <label className="flex items-center gap-3 text-sm">
                <Checkbox name="in_app" defaultChecked={prefs?.in_app_enabled ?? true} />{" "}
                {L("In-app notifications", "إشعارات داخل المنصة")}
              </label>
              <label className="flex items-center gap-3 text-sm">
                <Checkbox name="email" defaultChecked={prefs?.email_enabled ?? true} />{" "}
                {L("Email notifications", "إشعارات البريد")}
              </label>
              <div>
                <Button size="sm" type="submit">
                  {t.common.save}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={L("Account", "الحساب")} />
          <CardBody className="text-muted text-sm">
            <p dir="ltr" className="text-start">
              {session.email}
            </p>
            <p className="mt-1">
              {L("Member since", "عضو منذ")} {formatDate(session.profile.created_at, locale)}
            </p>
            <p className="mt-1">
              {L("Consent recorded", "تاريخ الموافقة")}:{" "}
              {formatDate(session.profile.consent_accepted_at, locale)}
            </p>
          </CardBody>
        </Card>
        {candidate && (
          <Card>
            <CardHeader
              title={L("Privacy & data", "الخصوصية والبيانات")}
              description={L(
                "Deactivation hides your profile from discovery immediately and asks the platform team to delete your data",
                "يؤدي التعطيل إلى إخفاء ملفك من الاكتشاف فورًا وطلب حذف بياناتك من فريق المنصة",
              )}
            />
            <CardBody>
              {session.profile.deactivation_requested_at ? (
                <p className="text-muted text-sm">
                  {L("Deactivation requested on", "طُلب التعطيل في")}{" "}
                  {formatDate(session.profile.deactivation_requested_at, locale)}
                </p>
              ) : (
                <form action={requestDeactivation}>
                  <Button variant="danger" size="sm" type="submit">
                    {L("Request deactivation & deletion", "طلب التعطيل والحذف")}
                  </Button>
                </form>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
