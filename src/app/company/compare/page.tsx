import Link from "next/link";
import { CheckCircle2, CircleDashed, CircleHelp, CircleSlash } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardBody, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireCompanyMember } from "@/lib/auth/session";
import type { ApplicationStatus } from "@/lib/domain/application-status";
import type { CandidateSkillRecord, MatchStatus } from "@/lib/domain/matching";
import { formatNumber, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { matchJob } from "@/services/candidate";

const ICON: Record<MatchStatus, React.ReactNode> = {
  matched: <CheckCircle2 className="text-success mx-auto size-5" />,
  partial: <CircleDashed className="text-warning mx-auto size-5" />,
  unverified: <CircleHelp className="text-primary dark:text-lavender mx-auto size-5" />,
  missing: <CircleSlash className="text-danger mx-auto size-5" />,
};

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids = "" } = await searchParams;
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const list = ids
    .split(",")
    .filter((x) => /^[0-9a-f-]{36}$/.test(x))
    .slice(0, 4);
  const { data: apps } = await supabase
    .from("applications")
    .select(
      "id, status, candidate_id, job_id, job:jobs(title_en, title_ar, min_years, job_skills(importance, min_level, skill:skills(id, name_en, name_ar))), candidate:profiles!applications_candidate_id_fkey(full_name)",
    )
    .in("id", list.length ? list : ["00000000-0000-0000-0000-000000000000"])
    .eq("company_id", s.activeMembership.company_id);
  if (!apps || apps.length === 0)
    return (
      <>
        <PageHeader title={L("Compare candidates", "مقارنة المرشحين")} />
        <Card>
          <EmptyState
            title={L(
              "Select applications to compare from the Applications page.",
              "اختر الطلبات للمقارنة من صفحة الطلبات.",
            )}
          />
        </Card>
      </>
    );
  const jobId = apps[0].job_id;
  const sameJob = apps.filter((a) => a.job_id === jobId);
  const rows = await Promise.all(
    sameJob.map(async (a) => {
      const [{ data: sk }, { data: cp }, { data: edu }, { data: certs }, { data: proj }, { data: asg }] =
        await Promise.all([
          supabase
            .from("candidate_skills")
            .select("level, source, evidence, skill:skills(id)")
            .eq("candidate_id", a.candidate_id),
          supabase
            .from("candidate_profiles")
            .select("years_experience")
            .eq("user_id", a.candidate_id)
            .maybeSingle(),
          supabase.from("candidate_education").select("degree").eq("candidate_id", a.candidate_id),
          supabase.from("candidate_certifications").select("name").eq("candidate_id", a.candidate_id),
          supabase.from("candidate_projects").select("title").eq("candidate_id", a.candidate_id),
          supabase
            .from("assessment_assignments")
            .select("submission:assessment_submissions(percentage)")
            .eq("application_id", a.id),
        ]);
      const recs: CandidateSkillRecord[] = (sk ?? [])
        .filter((x) => x.skill)
        .map((x) => ({
          skill_id: x.skill!.id,
          level: x.level,
          source: x.source as "cv",
          evidence: x.evidence,
        }));
      const match = matchJob(a.job!, recs, cp?.years_experience ?? null, locale);
      const scores = (asg ?? [])
        .map((x) => x.submission?.percentage)
        .filter((p): p is number => p !== null && p !== undefined);
      return {
        a,
        match,
        years: cp?.years_experience,
        edu: (edu ?? []).map((e) => e.degree),
        certs: (certs ?? []).length,
        projects: (proj ?? []).length,
        assessment: scores.length ? Math.max(...scores) : null,
        evidence: recs.filter((r) => r.source !== "self").length,
      };
    }),
  );
  const reqs = rows[0].match.requirements;
  return (
    <>
      <PageHeader
        eyebrow={L("Compare candidates", "مقارنة المرشحين")}
        title={pick(apps[0].job, "title", locale)}
      />
      {sameJob.length < apps.length && (
        <p className="text-warning mb-4 text-sm">
          {L("Only applications for the same job are compared.", "تُقارن طلبات الوظيفة نفسها فقط.")}
        </p>
      )}
      <Card>
        <CardBody className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-subtle p-3 text-start text-xs font-semibold">
                  {L("Requirement", "المتطلب")}
                </th>
                {rows.map((r) => (
                  <th key={r.a.id} className="p-3 text-center">
                    <Link
                      href={`/company/applications/${r.a.id}`}
                      className="hover:text-primary dark:hover:text-lavender font-bold"
                    >
                      {r.a.candidate?.full_name}
                    </Link>
                    <div className="mt-1">
                      <StatusBadge status={r.a.status as ApplicationStatus} t={t} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-accent-soft/40 border-b">
                <td className="p-3 font-semibold">{t.match.score}</td>
                {rows.map((r) => (
                  <td key={r.a.id} className="ltr-nums p-3 text-center text-2xl font-extrabold">
                    {r.match.score}
                  </td>
                ))}
              </tr>
              {reqs.map((req, i) => (
                <tr key={req.skill_id} className="border-b">
                  <td className="p-3">
                    {req.name}{" "}
                    <span className="text-subtle text-xs">
                      · {req.importance === "required" ? L("required", "مطلوبة") : L("preferred", "مفضّلة")} ·
                      L{req.required_level}
                    </span>
                  </td>
                  {rows.map((r) => {
                    const x = r.match.requirements[i];
                    return (
                      <td
                        key={r.a.id}
                        className="p-3 text-center"
                        title={`${t.match[x.status]}${x.candidate_level ? ` · L${x.candidate_level}` : ""}${x.source ? ` · ${t.match.source[x.source]}` : ""}`}
                      >
                        {ICON[x.status]}
                        <span className="ltr-nums text-subtle text-[0.65rem]">
                          {x.candidate_level ? `L${x.candidate_level}` : ""}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-b">
                <td className="p-3">{L("Relevant experience", "الخبرة ذات الصلة")}</td>
                {rows.map((r) => (
                  <td key={r.a.id} className="ltr-nums p-3 text-center">
                    {r.years ?? "—"} / {rows[0].match.experience.required}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="p-3">{L("Assessment", "التقييم")}</td>
                {rows.map((r) => (
                  <td key={r.a.id} className="ltr-nums p-3 text-center font-semibold">
                    {r.assessment !== null ? `${formatNumber(r.assessment, locale)}%` : "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="p-3">{L("Evidence-backed skills", "مهارات مدعومة بأدلة")}</td>
                {rows.map((r) => (
                  <td key={r.a.id} className="ltr-nums p-3 text-center">
                    {r.evidence}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="p-3">{L("Education", "التعليم")}</td>
                {rows.map((r) => (
                  <td key={r.a.id} className="p-3 text-center text-xs">
                    {r.edu.join(", ") || "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="p-3">{L("Projects / certifications", "المشاريع / الشهادات")}</td>
                {rows.map((r) => (
                  <td key={r.a.id} className="ltr-nums p-3 text-center">
                    {r.projects} / {r.certs}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3">{L("Missing requirements", "المتطلبات المفقودة")}</td>
                {rows.map((r) => (
                  <td key={r.a.id} className="text-danger p-3 text-center text-xs">
                    {r.match.requirements
                      .filter((x) => x.status === "missing")
                      .map((x) => x.name)
                      .join(", ") || "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}
