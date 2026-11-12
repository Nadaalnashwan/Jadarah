import { Card, CardBody, CardHeader, PageHeader, Stat } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatNumber, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { DemoResetForm } from "../admin-client";

export default async function AdminDemo() {
  await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const [{ data: env }, users, companies, jobs, apps, interviews] = await Promise.all([
    supabase.from("platform_settings").select("value").eq("key", "environment").maybeSingle(),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_demo", true),
    supabase.from("company_profiles").select("id", { count: "exact", head: true }).eq("is_demo", true),
    supabase
      .from("jobs")
      .select("id, company:company_profiles!inner(is_demo)", { count: "exact", head: true })
      .eq("company.is_demo", true),
    supabase.from("applications").select("id", { count: "exact", head: true }),
    supabase.from("interviews").select("id", { count: "exact", head: true }),
  ]);
  const n = (v: number | null) => formatNumber(v ?? 0, locale);
  const environment = String(env?.value ?? "unset");
  return (
    <>
      <PageHeader
        title={t.admin.nav.demo}
        description={L(
          "Demo records are flagged and fictional. Reset refuses to run unless the environment flag is demo or local",
          "السجلات التجريبية موسومة وخيالية. يرفض الحذف العمل ما لم تكن البيئة demo أو local",
        )}
      />
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <Card className="p-5">
          <Stat label={L("Environment", "البيئة")} value={environment} />
        </Card>
        <Card className="p-5">
          <Stat label={L("Demo identities", "هويات تجريبية")} value={n(users.count)} />
        </Card>
        <Card className="p-5">
          <Stat label={L("Demo companies", "شركات تجريبية")} value={n(companies.count)} />
        </Card>
        <Card className="p-5">
          <Stat label={L("Demo jobs", "وظائف تجريبية")} value={n(jobs.count)} />
        </Card>
        <Card className="p-5">
          <Stat label={L("Applications (all)", "الطلبات (الكل)")} value={n(apps.count)} />
        </Card>
        <Card className="p-5">
          <Stat label={L("Interviews (all)", "المقابلات (الكل)")} value={n(interviews.count)} />
        </Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={L("Re-seed", "إعادة التعبئة")} />
          <CardBody className="text-muted text-sm">
            <p>
              {L(
                "Seeding runs from a privileged connection, never from the browser:",
                "تعمل التعبئة من اتصال مميّز وليس من المتصفح:",
              )}
            </p>
            <pre className="bg-surface-2 mt-2 rounded-xl p-3 font-mono text-xs" dir="ltr">
              npm run seed:generate{"\n"}npm run demo:seed
            </pre>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title={L("Reset demo data", "حذف البيانات التجريبية")}
            description={L(
              "Deletes demo companies and demo identities (including the demo admin account) with all their records",
              "يحذف الشركات والهويات التجريبية (بما فيها حساب المدير التجريبي) وكل سجلاتها",
            )}
          />
          <CardBody>
            <DemoResetForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
