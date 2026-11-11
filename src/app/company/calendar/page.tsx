import Link from "next/link";
import { Clock } from "lucide-react";
import { InterviewCalendar, type CalendarEvent } from "@/components/app/interview-calendar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
import { requireCompanyMember } from "@/lib/auth/session";
import { DEFAULT_TZ, isoDaysAgo } from "@/lib/domain/calendar";
import { pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function CompanyCalendar() {
  const s = await requireCompanyMember();
  const { locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const since = isoDaysAgo(120);
  // RLS: recruiters/admins see all company interviews; interviewers only the ones assigned to them.
  const { data } = await supabase
    .from("interviews")
    .select(
      "id, title, status, scheduled_at, ends_at, timezone, candidate_confirmed_at, application:applications(job:jobs(title_en, title_ar), candidate:profiles!applications_candidate_id_fkey(full_name))",
    )
    .eq("company_id", s.activeMembership.company_id)
    .gte("scheduled_at", since)
    .order("scheduled_at");
  const events: CalendarEvent[] = (data ?? []).map((r) => ({
    id: r.id,
    title: r.application?.candidate?.full_name ?? r.title,
    subtitle: pick(r.application?.job, "title", locale),
    startUtc: r.scheduled_at,
    endUtc: r.ends_at,
    status: r.status as CalendarEvent["status"],
    confirmed: Boolean(r.candidate_confirmed_at),
    href: `/company/interviews/${r.id}`,
  }));
  const isRecruiter = ["company_admin", "recruiter"].includes(s.activeMembership.role);
  return (
    <>
      <PageHeader
        title={L("Interview calendar", "تقويم المقابلات")}
        description={
          isRecruiter
            ? L(
                "All interviews for your company. Conflicts are prevented automatically for every interviewer.",
                "كل مقابلات شركتك. يُمنع التعارض تلقائيًا لكل مُقابِل.",
              )
            : L("Interviews assigned to you.", "المقابلات المسندة إليك.")
        }
        actions={
          <Button asChild variant="soft" size="sm">
            <Link href="/company/availability">
              <Clock /> {L("My availability", "أوقات توفّري")}
            </Link>
          </Button>
        }
      />
      <InterviewCalendar events={events} timeZone={DEFAULT_TZ} />
    </>
  );
}
