import { Card, CardBody, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDateTime, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { ReportButton } from "../admin-client";

export default async function AdminReports() {
  await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("id, title, data, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  return (
    <>
      <PageHeader
        title={t.admin.nav.reports}
        description={L(
          "Snapshots store the platform statistics at a point in time for trend comparison",
          "تحفظ اللقطات إحصاءات المنصة في لحظة معينة للمقارنة",
        )}
        actions={<ReportButton />}
      />
      {(data ?? []).length === 0 ? (
        <Card>
          <EmptyState title={L("No reports yet", "لا توجد تقارير بعد")} />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {data!.map((r) => {
            const d = r.data as Record<string, number>;
            return (
              <Card key={r.id}>
                <CardBody>
                  <div className="flex justify-between">
                    <p className="font-bold">{r.title}</p>
                    <p className="text-subtle text-xs">{formatDateTime(r.created_at, locale)}</p>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    {[
                      "users",
                      "companies",
                      "active_jobs",
                      "applications",
                      "interviews",
                      "hires",
                      "assessments_submitted",
                      "ai_requests_30d",
                    ].map((k) => (
                      <div key={k}>
                        <dt className="text-subtle text-xs">{k.replace(/_/g, " ")}</dt>
                        <dd className="ltr-nums text-xl font-extrabold">{d[k] ?? "—"}</dd>
                      </div>
                    ))}
                  </dl>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
