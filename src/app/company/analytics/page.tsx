import Link from "next/link";
import { PageHeader } from "@/components/ui/primitives";
import { RecruitmentView } from "@/features/monitoring/recruitment-view";
import { requireCompanyMember } from "@/lib/auth/session";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { parsePeriod, type MonitoringParams } from "@/lib/monitoring/period";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { interviewAttendance, recruitmentMonitoring } from "@/services/monitoring";

const RANGES: [string, string, string][] = [
  ["7d", "7 days", "7 أيام"],
  ["30d", "30 days", "30 يومًا"],
  ["90d", "90 days", "90 يومًا"],
];

/** Company-scoped recruitment analytics: always filtered to the active company, and RLS enforces it again. */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<MonitoringParams> }) {
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const sp = await searchParams;
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const period = parsePeriod({
    range: sp.range && ["7d", "30d", "90d"].includes(sp.range) ? sp.range : "90d",
  });
  const d = await recruitmentMonitoring(supabase, period, { companyId: s.activeMembership.company_id });
  const att = await interviewAttendance(supabase, d.interviews.ids);
  return (
    <>
      <PageHeader
        title={t.company.nav.analytics}
        description={L("Your organization's recruitment figures only", "أرقام التوظيف الخاصة بجهتك فقط")}
        actions={
          <nav aria-label={L("Period", "الفترة")} className="flex gap-1.5">
            {RANGES.map(([v, en, ar]) => (
              <Link
                key={v}
                href={`/company/analytics?range=${v}`}
                aria-current={period.range === v ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold",
                  period.range === v
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-surface hover:bg-surface-2",
                )}
              >
                {L(en, ar)}
              </Link>
            ))}
          </nav>
        }
      />
      <RecruitmentView d={d} att={att} period={period} locale={locale} />
    </>
  );
}
