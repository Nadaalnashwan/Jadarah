import Link from "next/link";
import { BarList, Columns, Donut } from "@/components/app/charts";
import { Card, CardBody, CardHeader, PageHeader, Stat } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { APPLICATION_STATUSES } from "@/lib/domain/application-status";
import { formatNumber, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type S = {
  users: number;
  candidates: number;
  companies: number;
  pending_companies: number;
  active_jobs: number;
  applications: number;
  interviews: number;
  hires: number;
  assessments_submitted: number;
  ai_requests_30d: number;
  active_users_30d: number;
  companies_by_status: Record<string, number>;
  applications_by_status: Record<string, number>;
  user_growth: { month: string; count: number }[];
  application_growth: { month: string; count: number }[];
};

export default async function AdminOverview() {
  await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_platform_stats");
  const s = data as unknown as S;
  const n = (v: number) => formatNumber(v, locale);
  return (
    <>
      <PageHeader
        eyebrow={t.roles.super_admin}
        title={L("Platform control center", "مركز التحكم بالمنصة")}
        description={L(
          "Every figure is a live database query.",
          "كل رقم هنا استعلام مباشر من قاعدة البيانات.",
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <Stat
            label={L("Users", "المستخدمون")}
            value={n(s.users)}
            hint={`${n(s.candidates)} ${L("candidates", "مرشح")}`}
          />
        </Card>
        <Card className="p-5">
          <Stat
            label={L("Companies", "الشركات")}
            value={n(s.companies)}
            hint={
              <Link
                href="/admin/companies?status=pending"
                className="text-primary dark:text-lavender font-semibold"
              >
                {n(s.pending_companies)} {L("awaiting review", "بانتظار المراجعة")}
              </Link>
            }
          />
        </Card>
        <Card className="p-5">
          <Stat
            label={L("Active jobs", "وظائف نشطة")}
            value={n(s.active_jobs)}
            hint={`${n(s.applications)} ${L("applications", "طلب")}`}
          />
        </Card>
        <Card className="p-5">
          <Stat
            label={L("Hires", "التعيينات")}
            value={n(s.hires)}
            hint={`${n(s.interviews)} ${L("interviews", "مقابلة")} · ${n(s.assessments_submitted)} ${L("assessments", "تقييم")}`}
          />
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title={L("Applications by stage", "الطلبات حسب المرحلة")} />
          <CardBody>
            <Donut
              centerLabel={L("applications", "طلب")}
              data={APPLICATION_STATUSES.filter((x) => s.applications_by_status[x]).map((x) => ({
                key: x,
                label: t.status[x],
                value: s.applications_by_status[x],
              }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={L("Companies by status", "الشركات حسب الحالة")} />
          <CardBody>
            <BarList
              data={Object.entries(s.companies_by_status).map(([k, v]) => ({
                key: k,
                label: t.companyStatus[k as keyof typeof t.companyStatus] ?? k,
                value: v,
              }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={L("User growth by month", "نمو المستخدمين شهريًا")} />
          <CardBody>
            <Columns
              name={L("Users", "المستخدمون")}
              data={s.user_growth.map((g) => ({ label: g.month, value: g.count }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={L("Engagement", "التفاعل")} />
          <CardBody className="grid grid-cols-2 gap-4">
            <Stat
              label={L("Active users (30d)", "مستخدمون نشطون (30 يومًا)")}
              value={n(s.active_users_30d)}
              hint={L("Users who read a notification", "مستخدمون قرأوا إشعارًا")}
            />
            <Stat
              label={L("AI requests (30d)", "طلبات الذكاء الاصطناعي (30 يومًا)")}
              value={n(s.ai_requests_30d)}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
