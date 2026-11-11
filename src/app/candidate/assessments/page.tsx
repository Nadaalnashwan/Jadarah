import Link from "next/link";
import { ClipboardCheck, Timer } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireCandidate } from "@/lib/auth/session";
import { formatDateTime, formatNumber, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function AssessmentsPage() {
  const session = await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessment_assignments")
    .select(
      "id, status, due_at, created_at, assessment:assessments(title_en, title_ar, duration_minutes, difficulty, category), company:company_profiles(name_en, name_ar), assessment_submissions(percentage, status, needs_review)",
    )
    .eq("candidate_id", session.userId)
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  const label = (s: string) =>
    ({
      assigned: L("To do", "مطلوب"),
      in_progress: L("In progress", "قيد التنفيذ"),
      submitted: L("Awaiting review", "بانتظار المراجعة"),
      evaluated: L("Evaluated", "تم التقييم"),
      expired: L("Expired", "منتهي"),
      cancelled: L("Cancelled", "ملغى"),
    })[s] ?? s;
  return (
    <>
      <PageHeader
        eyebrow={t.candidate.nav.assessments}
        title={L("Practical assessments", "التقييمات العملية")}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title={L("No assessments assigned yet", "لم تُسند إليك تقييمات بعد")}
            body={L("Companies assign assessments after you apply.", "تُسند الشركات التقييمات بعد تقديمك.")}
          />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const sub = r.assessment_submissions;
            return (
              <li key={r.id}>
                <Link
                  href={`/candidate/assessments/${r.id}`}
                  className="surface-card group hover:border-primary/40 flex h-full flex-col p-5 transition hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="bg-accent-soft text-primary dark:text-lavender flex size-10 items-center justify-center rounded-xl">
                      <ClipboardCheck className="size-5" />
                    </span>
                    <Badge
                      tone={
                        r.status === "evaluated"
                          ? "positive"
                          : r.status === "expired" || r.status === "cancelled"
                            ? "muted"
                            : "progress"
                      }
                    >
                      {label(r.status)}
                    </Badge>
                  </div>
                  <p className="group-hover:text-primary dark:group-hover:text-lavender mt-4 text-lg font-bold">
                    {pick(r.assessment, "title", locale)}
                  </p>
                  <p className="text-subtle text-xs">{pick(r.company, "name", locale)}</p>
                  <div className="mt-auto flex items-center justify-between pt-5 text-sm">
                    <span className="ltr-nums text-muted flex items-center gap-1.5">
                      <Timer className="size-4" /> {r.assessment?.duration_minutes} {t.common.minutes}
                    </span>
                    {sub?.percentage !== null && sub?.percentage !== undefined ? (
                      <span className="ltr-nums text-xl font-extrabold">
                        {formatNumber(sub.percentage, locale)}%
                      </span>
                    ) : r.due_at ? (
                      <span className="text-subtle text-xs">
                        {L("Due", "الموعد")} {formatDateTime(r.due_at, locale)}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
