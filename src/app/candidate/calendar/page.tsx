import { InterviewCalendar, type CalendarEvent } from "@/components/app/interview-calendar";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireCandidate } from "@/lib/auth/session";
import { DEFAULT_TZ, isoDaysAgo } from "@/lib/domain/calendar";
import { pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Candidate calendar: the candidate's interviews and the due dates of their practical tasks, read from their own
 * records (RLS) — no sample events. Times are shown in Riyadh time.
 */
export default async function CandidateCalendar() {
  const s = await requireCandidate();
  const { locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const since = isoDaysAgo(120);
  const [{ data: interviews }, { data: tasks }] = await Promise.all([
    supabase
      .from("interviews")
      .select(
        "id, title, status, scheduled_at, ends_at, candidate_confirmed_at, application:applications!inner(id, candidate_id, job:jobs(title_en, title_ar, company:company_profiles(name_en, name_ar)))",
      )
      .eq("application.candidate_id", s.userId)
      .gte("scheduled_at", since)
      .order("scheduled_at"),
    supabase
      .from("assessment_assignments")
      .select("id, status, due_at, assessment:assessments(title_en, title_ar)")
      .eq("candidate_id", s.userId)
      .not("due_at", "is", null)
      .gte("due_at", since)
      .order("due_at"),
  ]);
  const events: CalendarEvent[] = [
    ...(interviews ?? []).map((r) => ({
      id: r.id,
      title: pick(r.application?.job, "title", locale) ?? r.title,
      subtitle: pick(r.application?.job?.company, "name", locale),
      startUtc: r.scheduled_at,
      endUtc: r.ends_at,
      status: r.status as CalendarEvent["status"],
      confirmed: Boolean(r.candidate_confirmed_at),
      href: `/candidate/applications/${r.application?.id}`,
      kind: "interview" as const,
    })),
    ...(tasks ?? []).map((a) => {
      const due = Date.parse(a.due_at!);
      const done = a.status === "submitted" || a.status === "evaluated";
      return {
        id: `task-${a.id}`,
        title: `${L("Task due", "موعد تسليم المهمة")} · ${pick(a.assessment, "title", locale) ?? ""}`,
        subtitle: done ? L("Submitted", "سُلّمت") : L("Practical task", "مهمة عملية"),
        startUtc: new Date(due - 30 * 60_000).toISOString(),
        endUtc: a.due_at!,
        status: (done ? "completed" : a.status === "expired" || a.status === "cancelled" ? "cancelled" : "scheduled") as CalendarEvent["status"],
        href: `/candidate/assessments/${a.id}`,
        kind: "deadline" as const,
      };
    }),
  ];
  return (
    <>
      <PageHeader
        title={L("My calendar", "تقويمي")}
        description={L(
          "Your interviews and task deadlines, in Riyadh time",
          "مقابلاتك ومواعيد تسليم مهامك بتوقيت الرياض",
        )}
      />
      {events.length === 0 ? (
        <EmptyState
          title={L("Nothing scheduled yet", "لا توجد مواعيد بعد")}
          body={L(
            "Interviews and practical-task deadlines appear here as soon as they are set",
            "تظهر المقابلات ومواعيد تسليم المهام العملية هنا فور تحديدها",
          )}
        />
      ) : (
        <InterviewCalendar events={events} timeZone={DEFAULT_TZ} />
      )}
    </>
  );
}
