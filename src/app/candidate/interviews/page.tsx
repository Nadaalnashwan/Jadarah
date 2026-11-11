import Link from "next/link";
import { GroupTabs } from "@/components/shell/group-tabs";
import { CalendarClock, CheckCircle2, MapPin, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InterviewCalendar, type CalendarEvent } from "@/components/app/interview-calendar";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireCandidate } from "@/lib/auth/session";
import { notEnded } from "@/lib/domain/calendar";
import { formatDateTime, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { ConfirmAttendance } from "./confirm";
import { InterviewAttachments } from "@/features/interviews/attachments";

export default async function CandidateInterviews() {
  const s = await requireCandidate();
  const { locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  // RLS: a candidate reads only interviews attached to their own applications (no internal notes).
  const { data } = await supabase
    .from("interviews")
    .select(
      "id, company_id, title, type, status, scheduled_at, ends_at, timezone, location, instructions, candidate_confirmed_at, application:applications!inner(id, candidate_id, job:jobs(title_en, title_ar, company:company_profiles(name_en, name_ar)))",
    )
    .eq("application.candidate_id", s.userId)
    .order("scheduled_at");
  const rows = data ?? [];
  const events: CalendarEvent[] = rows.map((r) => ({
    id: r.id,
    title: pick(r.application?.job, "title", locale) ?? r.title,
    subtitle: pick(r.application?.job?.company, "name", locale),
    startUtc: r.scheduled_at,
    endUtc: r.ends_at,
    status: r.status as CalendarEvent["status"],
    confirmed: Boolean(r.candidate_confirmed_at),
    href: `/candidate/applications/${r.application?.id}`,
  }));
  const upcoming = rows.filter((r) => r.status === "scheduled" && notEnded(r.ends_at));
  return (
    <>
      <GroupTabs group="candidate-applications" />
      <PageHeader
        title={L("My interviews", "مقابلاتي")}
        description={L(
          "Times are shown in Riyadh time. Confirm your attendance so the team knows you'll be there.",
          "تُعرض الأوقات بتوقيت الرياض. أكّد حضورك ليعلم الفريق بقدومك.",
        )}
      />
      {upcoming.length > 0 && (
        <ul className="mb-6 grid gap-4 lg:grid-cols-2">
          {upcoming.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  <span className="bg-navy text-lavender flex size-11 shrink-0 items-center justify-center rounded-xl">
                    <CalendarClock className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{pick(r.application?.job, "title", locale)}</p>
                    <p className="text-muted text-sm">{pick(r.application?.job?.company, "name", locale)}</p>
                    <p className="ltr-nums mt-1 text-sm font-semibold">
                      {formatDateTime(r.scheduled_at, locale, r.timezone)}{" "}
                      <span className="text-subtle text-xs font-normal">({r.timezone})</span>
                    </p>
                  </div>
                  {r.candidate_confirmed_at ? (
                    <Badge tone="positive">
                      <CheckCircle2 className="size-3.5" /> {L("Confirmed", "مؤكَّدة")}
                    </Badge>
                  ) : (
                    <Badge tone="progress">{L("Awaiting your confirmation", "بانتظار تأكيدك")}</Badge>
                  )}
                </div>
                {r.location && (
                  <p className="text-muted flex items-center gap-1.5 text-sm">
                    <MapPin className="size-4" /> {r.location}
                  </p>
                )}
                {r.instructions && <p className="bg-surface-2 rounded-xl p-3 text-sm">{r.instructions}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {!r.candidate_confirmed_at && <ConfirmAttendance interviewId={r.id} />}
                  {["video", "technical", "behavioral", "panel"].includes(r.type) && (
                    <Button asChild size="sm" variant={r.candidate_confirmed_at ? "primary" : "soft"}>
                      <Link href={`/meet/${r.id}`}>
                        <Video /> {L("Interview room", "غرفة المقابلة")}
                      </Link>
                    </Button>
                  )}
                  <Link href={`/candidate/applications/${r.application?.id}`} className="text-primary text-sm font-semibold">
                    {L("View application", "عرض الطلب")}
                  </Link>
                </div>
                <details className="bg-surface-2 rounded-xl p-3">
                  <summary className="cursor-pointer text-sm font-semibold">{L("Interview documents", "مستندات المقابلة")}</summary>
                  <div className="mt-3">
                    <InterviewAttachments
                      interviewId={r.id}
                      companyId={r.company_id}
                      viewer="candidate"
                      canUpload={r.status === "scheduled"}
                      currentUserId={s.userId}
                    />
                  </div>
                </details>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {rows.length === 0 ? (
        <EmptyState
          title={L("No interviews yet", "لا توجد مقابلات بعد")}
          body={L(
            "When a company shortlists you and schedules an interview, it appears here.",
            "عندما تضعك شركة في القائمة المختصرة وتجدول مقابلة، ستظهر هنا.",
          )}
        />
      ) : (
        <InterviewCalendar events={events} />
      )}
    </>
  );
}
