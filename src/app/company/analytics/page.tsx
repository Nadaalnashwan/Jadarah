import { BarList, Columns, Donut } from "@/components/app/charts";
import { Card, CardBody, CardHeader, PageHeader, Stat } from "@/components/ui/primitives";
import { requireCompanyMember } from "@/lib/auth/session";
import { formatNumber, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function AnalyticsPage() {
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const cid = s.activeMembership.company_id;
  const [{ data: apps }, { data: subs }, { data: ivs }] = await Promise.all([
    supabase.from("applications").select("status, submitted_at, decided_at, match_score, was_shortlisted, job:jobs(title_en, title_ar)").eq("company_id", cid),
    supabase.from("assessment_assignments").select("assessment:assessments(title_en, title_ar), submission:assessment_submissions(percentage)").eq("company_id", cid),
    supabase.from("interviews").select("status, type").eq("company_id", cid),
  ]);
  const rows = apps ?? [];
  const hired = rows.filter((a) => a.status === "hired");
  const daysToHire = hired.filter((a) => a.decided_at).map((a) => (new Date(a.decided_at!).getTime() - new Date(a.submitted_at).getTime()) / 86400000);
  const avgDays = daysToHire.length ? Math.round(daysToHire.reduce((a, b) => a + b, 0) / daysToHire.length) : null;
  const scored = (subs ?? []).filter((x) => x.submission?.percentage !== null && x.submission?.percentage !== undefined);
  const byAssessment = new Map<string, number[]>();
  scored.forEach((x) => { const k = pick(x.assessment, "title", locale); byAssessment.set(k, [...(byAssessment.get(k) ?? []), Number(x.submission!.percentage)]); });
  const matchBuckets = [0, 20, 40, 60, 80].map((lo) => ({ label: `${lo}–${lo + 19}`, value: rows.filter((a) => a.match_score !== null && Number(a.match_score) >= lo && Number(a.match_score) < lo + 20 + (lo === 80 ? 1 : 0)).length }));
  const hiredMatch = hired.filter((a) => a.match_score !== null).map((a) => Number(a.match_score));
  return (
    <>
      <PageHeader title={t.company.nav.analytics} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5"><Stat label={L("Hires", "التعيينات")} value={formatNumber(hired.length, locale)} /></Card>
        <Card className="p-5"><Stat label={L("Avg. days to hire", "متوسط أيام التوظيف")} value={avgDays !== null ? formatNumber(avgDays, locale) : "—"} /></Card>
        <Card className="p-5"><Stat label={L("Shortlist rate", "نسبة القائمة المختصرة")} value={rows.length ? `${formatNumber(Math.round((rows.filter((a) => a.was_shortlisted).length / rows.length) * 100), locale)}%` : "—"} /></Card>
        <Card className="p-5"><Stat label={L("Avg. match of hires", "متوسط مطابقة المعيّنين")} value={hiredMatch.length ? formatNumber(Math.round(hiredMatch.reduce((a, b) => a + b, 0) / hiredMatch.length), locale) : "—"} /></Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card><CardHeader title={L("Match score distribution", "توزيع درجات المطابقة")} /><CardBody><Columns name={L("Applications", "الطلبات")} data={matchBuckets} /></CardBody></Card>
        <Card><CardHeader title={L("Average assessment score", "متوسط درجات التقييم")} /><CardBody><BarList data={[...byAssessment.entries()].map(([k, v]) => ({ key: k, label: k, value: Math.round(v.reduce((a, b) => a + b, 0) / v.length) }))} /></CardBody></Card>
        <Card><CardHeader title={L("Interviews by outcome", "المقابلات حسب الحالة")} /><CardBody><Donut centerLabel={L("interviews", "مقابلة")} data={["scheduled", "completed", "cancelled"].map((k) => ({ key: k, label: k === "scheduled" ? L("Scheduled", "مجدولة") : k === "completed" ? L("Completed", "مكتملة") : L("Cancelled", "ملغاة"), value: (ivs ?? []).filter((i) => i.status === k).length })).filter((d) => d.value)} /></CardBody></Card>
        <Card><CardHeader title={L("Hiring outcomes by job", "نتائج التوظيف حسب الوظيفة")} /><CardBody><BarList data={[...new Set(rows.map((a) => pick(a.job, "title", locale)))].map((j) => ({ key: j, label: j, value: hired.filter((a) => pick(a.job, "title", locale) === j).length }))} /></CardBody></Card>
      </div>
    </>
  );
}
