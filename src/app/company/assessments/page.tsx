import Link from "next/link";
import { Copy, Sparkles, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { cloneAssessment } from "@/features/assessments/company-actions";
import { requireCompanyMember } from "@/lib/auth/session";
import { pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { NewAssessmentForm } from "./new-form";

export default async function CompanyAssessments() {
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const cid = s.activeMembership.company_id;
  const [{ data: own }, { data: library }] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, title_en, title_ar, status, duration_minutes, ai_generated, assessment_questions(count)")
      .eq("company_id", cid)
      .order("updated_at", { ascending: false }),
    supabase
      .from("assessments")
      .select(
        "id, title_en, title_ar, description_en, description_ar, category, difficulty, duration_minutes, assessment_questions(count)",
      )
      .is("company_id", null)
      .eq("status", "published")
      .order("title_en"),
  ]);
  const qc = (x: { assessment_questions: unknown }) =>
    (x.assessment_questions as { count: number }[])[0]?.count ?? 0;
  return (
    <>
      <PageHeader
        title={t.company.nav.assessments}
        actions={
          <Button asChild size="sm">
            <Link href="/company/assessments/builder">
              <Sparkles /> {L("Assessment Builder", "منشئ التقييمات")}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader title={L("Your assessments", "تقييماتك")} />
          <CardBody>
            {(own ?? []).length === 0 ? (
              <p className="text-subtle text-sm">
                {L(
                  "None yet — create one or copy from the library.",
                  "لا يوجد بعد — أنشئ واحدًا أو انسخ من المكتبة.",
                )}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {own!.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/company/assessments/${a.id}`}
                      className="hover:border-primary/40 flex items-center justify-between gap-3 rounded-xl border p-3"
                    >
                      <span className="font-semibold">{pick(a, "title", locale)}</span>
                      <span className="flex items-center gap-2">
                        <span className="ltr-nums text-subtle text-xs">
                          {qc(a)} {L("questions", "أسئلة")}
                        </span>
                        {a.ai_generated && <Badge tone="progress">AI</Badge>}
                        <Badge tone={a.status === "published" ? "positive" : "neutral"}>{a.status}</Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={L("New assessment", "تقييم جديد")} />
          <CardBody>
            <NewAssessmentForm />
          </CardBody>
        </Card>
      </div>
      <h2 className="mt-10 mb-4 text-lg font-bold">{L("Platform library", "مكتبة المنصة")}</h2>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(library ?? []).map((a) => (
          <li key={a.id} className="surface-card flex flex-col p-5">
            <div className="flex items-center justify-between">
              <Badge tone="info">{a.category}</Badge>
              <span className="ltr-nums text-subtle flex items-center gap-1 text-xs">
                <Timer className="size-3.5" /> {a.duration_minutes} {t.common.minutes} · {qc(a)} Q
              </span>
            </div>
            <p className="mt-3 font-bold">{pick(a, "title", locale)}</p>
            <p className="text-muted mt-1 flex-1 text-sm">{pick(a, "description", locale)}</p>
            <form action={cloneAssessment.bind(null, a.id)} className="mt-4">
              <Button size="sm" variant="outline">
                <Copy /> {L("Copy & customise", "نسخ وتخصيص")}
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
