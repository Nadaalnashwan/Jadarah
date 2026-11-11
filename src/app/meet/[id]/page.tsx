import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { requireSession } from "@/lib/auth/session";
import { formatDateTime, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { MeetingRoom } from "./room";

export const metadata = { title: "Interview · JADARAH", robots: { index: false } };

/**
 * Built-in video interview. Access is decided by the database (interview_video_access):
 * only the application's candidate and assigned interviewers get past this point.
 */
export default async function MeetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession(`/meet/${id}`);
  const { locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("interview_video_access", { p_interview: id });
  if (error || !data?.[0]) notFound();
  const v = data[0];
  const role = v.access_role as "candidate" | "interviewer";
  const back = role === "candidate" ? "/candidate/interviews" : `/company/interviews/${id}`;
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="flex items-center gap-4 border-b px-4 py-3 sm:px-6">
        <Logo className="h-8" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{locale === "ar" ? v.job_title_ar : v.job_title_en}</p>
          <p className="text-subtle ltr-nums truncate text-xs">
            {locale === "ar" ? v.company_name_ar : v.company_name_en} · {formatDateTime(v.scheduled_at, locale, v.timezone)} ({v.timezone})
          </p>
        </div>
        <span className="bg-accent-soft text-primary dark:text-lavender hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline">
          {role === "candidate" ? L("Candidate", "مرشح") : L("Interviewer", "مُقابِل")}
        </span>
      </header>
      <MeetingRoom interviewId={id} role={role} backHref={back} startsAt={v.scheduled_at} />
    </div>
  );
}
