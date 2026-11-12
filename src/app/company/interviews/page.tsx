import Link from "next/link";
import { GroupTabs } from "@/components/shell/group-tabs";
import { CalendarClock } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireCompanyMember } from "@/lib/auth/session";
import { splitInterviews, type InterviewPhase } from "@/lib/domain/calendar";
import { formatDateTime, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getInterviewRubric } from "@/services/interview-rubric";
import { InterviewRubricEditor } from "./rubric-editor";

export default async function InterviewsPage() {
  const s = await requireCompanyMember();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  // RLS returns all company interviews for recruiters and only assigned ones for interviewers.
  const { data } = await supabase
    .from("interviews")
    .select(
      "id, title, type, status, scheduled_at, ends_at, timezone, application:applications(job:jobs(title_en, title_ar), candidate:profiles!applications_candidate_id_fkey(full_name)), interview_evaluations(interviewer_id)",
    )
    .eq("company_id", s.activeMembership.company_id)
    .order("scheduled_at", { ascending: false });
  const rows = data ?? [];
  // Classified by real start/end instants, not by status alone: a past interview whose outcome was never recorded
  // moves to history as "awaiting update" instead of staying under Upcoming.
  const { current: upcoming, history: past } = splitInterviews(rows);
  const phaseLabel: Record<InterviewPhase, string> = {
    upcoming: L("Scheduled", "مجدولة"),
    in_progress: L("In progress", "جارية الآن"),
    awaiting_update: L("Outcome not recorded", "بانتظار تحديث النتيجة"),
    completed: L("Completed", "مكتملة"),
    cancelled: L("Cancelled", "ملغاة"),
  };
  const Row = ({ r, phase }: { r: (typeof rows)[number]; phase: InterviewPhase }) => {
    const mine = r.interview_evaluations.some((e) => e.interviewer_id === s.userId);
    return (
      <li>
        <Link
          href={`/company/interviews/${r.id}`}
          className="hover:border-primary/40 flex flex-wrap items-center gap-4 rounded-2xl border p-4 transition"
        >
          <span className="bg-accent-soft text-primary flex size-11 items-center justify-center rounded-xl">
            <CalendarClock className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {r.application?.candidate?.full_name} · {pick(r.application?.job, "title", locale)}
            </span>
            <span className="text-subtle text-xs">
              {r.title} · {formatDateTime(r.scheduled_at, locale, r.timezone)}
            </span>
          </span>
          {s.activeMembership.role === "interviewer" && (
            <Badge tone={mine ? "positive" : "progress"}>
              {mine ? L("Evaluated", "تم التقييم") : L("Evaluation due", "التقييم مطلوب")}
            </Badge>
          )}
          <Badge
            tone={
              phase === "completed"
                ? "positive"
                : phase === "cancelled"
                  ? "muted"
                  : phase === "awaiting_update"
                    ? "negative"
                    : "progress"
            }
          >
            {phaseLabel[phase]}
          </Badge>
        </Link>
      </li>
    );
  };
  return (
    <>
      <GroupTabs group="company-interviews" />
      <PageHeader
        title={t.company.nav.interviews}
        description={L(
          "Interviews can only be created for shortlisted candidates",
          "لا يمكن إنشاء مقابلات إلا للمرشحين في القائمة المختصرة",
        )}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState title={L("No interviews yet", "لا توجد مقابلات بعد")} />
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 font-bold">{L("Upcoming", "القادمة")}</h2>
            {upcoming.length ? (
              <ul className="flex flex-col gap-2">
                {upcoming.map(({ row, phase }) => (
                  <Row key={row.id} r={row} phase={phase} />
                ))}
              </ul>
            ) : (
              <p className="text-subtle text-sm">—</p>
            )}
          </section>
          <section>
            <h2 className="mb-3 font-bold">{L("History", "السجل")}</h2>
            <ul className="flex flex-col gap-2">
              {past.map(({ row, phase }) => (
                <Row key={row.id} r={row} phase={phase} />
              ))}
            </ul>
          </section>
        </div>
      )}
      {["company_admin", "recruiter"].includes(s.activeMembership.role) && (
        <Card className="mt-8 p-5">
          <h2 className="font-bold">{L("Structured interview rubric", "معايير المقابلة المنظّمة")}</h2>
          <p className="text-muted mb-4 text-sm">
            {L("Used by every interviewer in your company and by the Final Candidate Evaluation Report", "يستخدمها كل المُقابِلين في شركتك وتقرير التقييم النهائي للمرشح")}
          </p>
          <InterviewRubricEditor initial={await getInterviewRubric(supabase, s.activeMembership.company_id)} />
        </Card>
      )}
    </>
  );
}
