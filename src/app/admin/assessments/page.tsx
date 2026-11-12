import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatNumber, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { dateRange, pageOf, pageRange, searchTerm, validUuid, type AdminListParams } from "@/lib/admin-filters";
import { AdminFilterBar, AdminPager } from "../list-controls";

const ASSESSMENT_STATUSES = ["draft", "published", "archived"] as const;

export default async function AdminAssessments({ searchParams }: { searchParams: Promise<AdminListParams> }) {
  const sp = await searchParams;
  await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const page = pageOf(sp);
  const { data: companyRows } = await supabase.from("company_profiles").select("id, name_en, name_ar").order("name_en");
  let q = supabase
    .from("assessments")
    .select(
      "id, title_en, title_ar, status, category, difficulty, duration_minutes, ai_generated, created_at, company:company_profiles(name_en, name_ar), assessment_questions(count), assessment_assignments(count)",
      { count: "exact" },
    );
  const term = searchTerm(sp.q);
  if (term) q = q.or(`title_en.ilike.%${term}%,title_ar.ilike.%${term}%`);
  if (sp.status && (ASSESSMENT_STATUSES as readonly string[]).includes(sp.status)) q = q.eq("status", sp.status as "draft");
  if (sp.company === "library") q = q.is("company_id", null);
  else if (validUuid(sp.company)) q = q.eq("company_id", sp.company!);
  const range = dateRange(sp);
  if (range.gte) q = q.gte("created_at", range.gte);
  if (range.lt) q = q.lt("created_at", range.lt);
  const [from, to] = pageRange(page);
  const { data, count } = await q
    .order("company_id", { nullsFirst: true })
    .order("title_en")
    .range(from, to);
  return (
    <>
      <PageHeader title={t.admin.nav.assessments} description={`${count ?? 0} ${t.common.results}`} />
      <AdminFilterBar
        params={sp}
        locale={locale}
        searchPlaceholder={L("Assessment title…", "عنوان التقييم…")}
        status={{
          label: t.common.status,
          options: [
            { value: "draft", label: L("Draft", "مسودة") },
            { value: "published", label: L("Published", "منشور") },
            { value: "archived", label: L("Archived", "مؤرشف") },
          ],
        }}
        companies={[
          { value: "library", label: L("Platform library", "مكتبة المنصة") },
          ...(companyRows ?? []).map((c) => ({ value: c.id, label: pick(c, "name", locale) })),
        ]}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="text-subtle text-xs">
              <tr className="border-b">
                <th className="p-4 text-start">{L("Assessment", "التقييم")}</th>
                <th className="p-4 text-start">{L("Owner", "المالك")}</th>
                <th className="p-4 text-start">{t.common.status}</th>
                <th className="p-4 text-start">{L("Questions", "الأسئلة")}</th>
                <th className="p-4 text-start">{L("Assigned", "المُسند")}</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="p-4">
                    <p className="font-semibold">{pick(a, "title", locale)}</p>
                    <p className="text-subtle text-xs">
                      {a.category} · {a.difficulty} · {a.duration_minutes} {t.common.minutes}
                    </p>
                  </td>
                  <td className="text-muted p-4">
                    {a.company ? pick(a.company, "name", locale) : L("Platform library", "مكتبة المنصة")}
                  </td>
                  <td className="p-4">
                    <Badge tone={a.status === "published" ? "positive" : "neutral"}>{a.status}</Badge>
                    {a.ai_generated && (
                      <Badge tone="progress" className="ms-1">
                        AI
                      </Badge>
                    )}
                  </td>
                  <td className="ltr-nums p-4">
                    {formatNumber(
                      (a.assessment_questions as unknown as { count: number }[])[0]?.count ?? 0,
                      locale,
                    )}
                  </td>
                  <td className="ltr-nums p-4">
                    {formatNumber(
                      (a.assessment_assignments as unknown as { count: number }[])[0]?.count ?? 0,
                      locale,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data ?? []).length === 0 && (
            <p className="text-muted p-6 text-center text-sm">{L("No assessments match these filters", "لا توجد تقييمات مطابقة")}</p>
          )}
        </div>
      </Card>
      <AdminPager params={sp} page={page} count={count ?? 0} locale={locale} />
    </>
  );
}
