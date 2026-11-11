import Link from "next/link";
import { GitCompareArrows } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireCompanyMember } from "@/lib/auth/session";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/domain/application-status";
import { formatDate, formatNumber, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { CompareSelector } from "./compare-selector";

type SP = { job?: string; status?: string; q?: string; sort?: string; page?: string };
const PAGE = 20;

export default async function CompanyApplications({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const cid = s.activeMembership.company_id;
  let q = supabase
    .from("applications")
    .select(
      "id, status, match_score, submitted_at, updated_at, job_id, job:jobs(title_en, title_ar), candidate:profiles!applications_candidate_id_fkey(full_name)",
      { count: "exact" },
    )
    .eq("company_id", cid);
  if (sp.job) q = q.eq("job_id", sp.job);
  if (sp.status) q = q.eq("status", sp.status as ApplicationStatus);
  const order = sp.sort === "recent" ? "submitted_at" : "match_score";
  const page = Math.max(1, Number(sp.page ?? 1));
  const [{ data, count }, { data: jobs }] = await Promise.all([
    q.order(order, { ascending: false, nullsFirst: false }).range((page - 1) * PAGE, page * PAGE - 1),
    supabase
      .from("jobs")
      .select("id, title_en, title_ar")
      .eq("company_id", cid)
      .order("created_at", { ascending: false }),
  ]);
  let rows = data ?? [];
  if (sp.q) rows = rows.filter((r) => r.candidate?.full_name?.toLowerCase().includes(sp.q!.toLowerCase()));
  const qs = (patch: Partial<SP>) =>
    `?${new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <PageHeader
        title={t.company.nav.applications}
      />
      <form className="surface-card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5" role="search">
        <Input
          name="q"
          defaultValue={sp.q}
          placeholder={L("Candidate name…", "اسم المرشح…")}
          aria-label={t.common.search}
        />
        <Select name="job" defaultValue={sp.job ?? ""} aria-label={L("Job", "الوظيفة")}>
          <option value="">{L("All jobs", "كل الوظائف")}</option>
          {(jobs ?? []).map((j) => (
            <option key={j.id} value={j.id}>
              {pick(j, "title", locale)}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={sp.status ?? ""} aria-label={t.common.status}>
          <option value="">{L("All stages", "كل المراحل")}</option>
          {APPLICATION_STATUSES.map((st) => (
            <option key={st} value={st}>
              {t.status[st]}
            </option>
          ))}
        </Select>
        <Select name="sort" defaultValue={sp.sort ?? ""} aria-label={L("Sort", "الترتيب")}>
          <option value="">{L("Highest match", "الأعلى مطابقة")}</option>
          <option value="recent">{L("Most recent", "الأحدث")}</option>
        </Select>
        <Button type="submit">{t.common.filter}</Button>
      </form>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title={L("No applications match", "لا توجد طلبات مطابقة")} />
        ) : (
          <CompareSelector>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-sm">
                <thead className="text-subtle text-xs">
                  <tr className="border-b">
                    <th className="w-10 p-4" />
                    <th className="p-4 text-start">{L("Candidate", "المرشح")}</th>
                    <th className="p-4 text-start">{L("Job", "الوظيفة")}</th>
                    <th className="p-4 text-start">{t.match.score}</th>
                    <th className="p-4 text-start">{t.common.status}</th>
                    <th className="p-4 text-start">{L("Applied", "التقديم")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-2/50 border-b last:border-0">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          name="compare"
                          value={r.id}
                          className="size-4 accent-[var(--royal)]"
                          aria-label={L("Select to compare", "اختر للمقارنة")}
                        />
                      </td>
                      <td className="p-4">
                        <Link
                          href={`/company/applications/${r.id}`}
                          className="hover:text-primary dark:hover:text-lavender font-semibold"
                        >
                          {r.candidate?.full_name ?? "—"}
                        </Link>
                      </td>
                      <td className="text-muted p-4">{pick(r.job, "title", locale)}</td>
                      <td className="p-4">
                        <span className="ltr-nums inline-flex items-center gap-2 font-bold">
                          <span className="bg-surface-2 h-1.5 w-12 overflow-hidden rounded-full">
                            <span
                              className="bg-primary block h-full rounded-full"
                              style={{ width: `${r.match_score ?? 0}%` }}
                            />
                          </span>
                          {r.match_score !== null ? formatNumber(Number(r.match_score), locale) : "—"}
                        </span>
                      </td>
                      <td className="p-4">
                        <StatusBadge status={r.status as ApplicationStatus} t={t} />
                      </td>
                      <td className="text-muted p-4">{formatDate(r.submitted_at, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CompareSelector>
        )}
      </Card>
      {(count ?? 0) > PAGE && (
        <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Pagination">
          <Button
            asChild
            variant="outline"
            size="sm"
            className={page <= 1 ? "pointer-events-none opacity-40" : ""}
          >
            <Link href={qs({ page: String(page - 1) })}>{t.common.previous}</Link>
          </Button>
          <span className="ltr-nums text-muted text-sm">
            {page} / {Math.ceil((count ?? 0) / PAGE)}
          </span>
          <Button
            asChild
            variant="outline"
            size="sm"
            className={page * PAGE >= (count ?? 0) ? "pointer-events-none opacity-40" : ""}
          >
            <Link href={qs({ page: String(page + 1) })}>{t.common.next}</Link>
          </Button>
        </nav>
      )}
      <p className="text-subtle mt-4 flex items-center gap-2 text-xs">
        <GitCompareArrows className="size-4" />{" "}
        {L(
          "Tick 2–4 applications for the same job to compare evidence side by side.",
          "حدّد 2–4 طلبات للوظيفة نفسها لمقارنة الأدلة جنبًا إلى جنب.",
        )}
      </p>
    </>
  );
}
