import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, MessageSquareQuote, Video } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { FormMessage, Textarea } from "@/components/ui/form";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { withdrawApplication } from "@/features/candidate/actions";
import { requireCandidate } from "@/lib/auth/session";
import { canWithdraw, PIPELINE_STAGES, type ApplicationStatus } from "@/lib/domain/application-status";
import { formatDate, formatDateTime, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function ApplicationDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const session = await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: app } = await supabase
    .from("applications")
    .select(
      "id, status, submitted_at, cover_letter, candidate_id, job:jobs(id, title_en, title_ar, company:company_profiles(name_en, name_ar)), cv:candidate_documents(file_name, version)",
    )
    .eq("id", id)
    .eq("candidate_id", session.userId)
    .maybeSingle();
  if (!app) notFound();
  const [{ data: timeline }, { data: interviews }, { data: feedback }, { data: assignments }] =
    await Promise.all([
      supabase.rpc("get_application_timeline", { p_app: id }),
      supabase
        .from("interviews")
        .select(
          "id, title, type, status, scheduled_at, duration_minutes, timezone, location, meeting_url, instructions",
        )
        .eq("application_id", id)
        .order("scheduled_at"),
      supabase
        .from("interview_feedback")
        .select("id, body, shared_at")
        .eq("application_id", id)
        .eq("shared_with_candidate", true),
      supabase
        .from("assessment_assignments")
        .select("id, status, due_at, assessment:assessments(title_en, title_ar)")
        .eq("application_id", id),
    ]);
  const status = app.status as ApplicationStatus;
  const reached = new Set((timeline ?? []).map((h) => h.to_status));
  const terminalNegative = status === "rejected" || status === "withdrawn";
  const messages = (timeline ?? []).filter((h) => h.candidate_message);

  return (
    <>
      {sp.submitted && (
        <div className="mb-4">
          <FormMessage tone="success">
            {L(
              "Application submitted. You'll be notified at every step.",
              "تم إرسال طلبك. سنبلغك في كل خطوة.",
            )}
          </FormMessage>
        </div>
      )}
      {sp.error && (
        <div className="mb-4">
          <FormMessage>{sp.error}</FormMessage>
        </div>
      )}
      <PageHeader
        eyebrow={pick(app.job?.company, "name", locale)}
        title={pick(app.job, "title", locale)}
        description={`${L("Applied", "تاريخ التقديم")} ${formatDate(app.submitted_at, locale)}`}
        actions={<StatusBadge status={status} t={t} />}
      />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={L("Progress", "مسار الطلب")} />
            <CardBody>
              <ol className="relative flex flex-col gap-0">
                {PIPELINE_STAGES.map((s, i) => {
                  const done = reached.has(s);
                  const current = s === status;
                  return (
                    <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < PIPELINE_STAGES.length - 1 && (
                        <span
                          className={cn(
                            "absolute start-[0.9rem] top-8 bottom-0 w-px",
                            done ? "bg-primary" : "bg-border",
                          )}
                          aria-hidden
                        />
                      )}
                      <span
                        className={cn(
                          "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs",
                          done
                            ? "border-primary bg-primary text-white"
                            : "border-border-strong bg-surface text-subtle",
                          current && "ring-primary/20 ring-4",
                        )}
                      >
                        {done ? <CheckCircle2 className="size-4" /> : i + 1}
                      </span>
                      <div className="pt-0.5">
                        <p className={cn("text-sm font-semibold", !done && "text-subtle")}>{t.status[s]}</p>
                        {done && (
                          <p className="text-subtle text-xs">
                            {formatDate(
                              (timeline ?? []).find((h) => h.to_status === s)?.created_at ?? null,
                              locale,
                            )}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
              {terminalNegative && (
                <p className="bg-surface-2 mt-4 rounded-xl p-3 text-sm">
                  <StatusBadge status={status} t={t} />
                </p>
              )}
            </CardBody>
          </Card>
          {messages.length > 0 && (
            <Card>
              <CardHeader title={L("Messages from the company", "رسائل من الشركة")} />
              <CardBody className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <blockquote key={i} className="bg-accent-soft/50 rounded-2xl p-4 text-sm">
                    <MessageSquareQuote className="text-primary dark:text-lavender mb-2 size-4" />
                    {m.candidate_message}
                    <footer className="text-subtle mt-2 text-xs">
                      {t.status[m.to_status]} · {formatDate(m.created_at, locale)}
                    </footer>
                  </blockquote>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
        <div className="flex flex-col gap-6">
          {(assignments ?? []).length > 0 && (
            <Card>
              <CardHeader title={t.candidate.nav.assessments} />
              <CardBody className="flex flex-col gap-2">
                {assignments!.map((a) => (
                  <Link
                    key={a.id}
                    href={`/candidate/assessments/${a.id}`}
                    className="hover:border-primary/40 flex items-center justify-between rounded-xl border p-3"
                  >
                    <span className="text-sm font-semibold">{pick(a.assessment, "title", locale)}</span>
                    <Badge
                      tone={a.status === "evaluated" || a.status === "submitted" ? "positive" : "progress"}
                    >
                      {a.status === "assigned"
                        ? L("To do", "مطلوب")
                        : a.status === "in_progress"
                          ? L("In progress", "قيد التنفيذ")
                          : L("Submitted", "تم التسليم")}
                    </Badge>
                  </Link>
                ))}
              </CardBody>
            </Card>
          )}
          {(interviews ?? []).length > 0 && (
            <Card>
              <CardHeader title={L("Interviews", "المقابلات")} />
              <CardBody className="flex flex-col gap-3">
                {interviews!.map((iv) => (
                  <div key={iv.id} className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{iv.title}</p>
                      <Badge
                        tone={
                          iv.status === "scheduled"
                            ? "progress"
                            : iv.status === "completed"
                              ? "positive"
                              : "muted"
                        }
                      >
                        {iv.status === "scheduled"
                          ? L("Scheduled", "مجدولة")
                          : iv.status === "completed"
                            ? L("Completed", "مكتملة")
                            : L("Cancelled", "ملغاة")}
                      </Badge>
                    </div>
                    <p className="text-muted mt-2 flex items-center gap-2 text-sm">
                      <CalendarClock className="size-4" />{" "}
                      {formatDateTime(iv.scheduled_at, locale, iv.timezone)}{" "}
                      <span className="ltr-nums text-xs">
                        ({iv.timezone}, {iv.duration_minutes} {t.common.minutes})
                      </span>
                    </p>
                    {iv.meeting_url && iv.status === "scheduled" && (
                      <a
                        href={iv.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary dark:text-lavender mt-2 inline-flex items-center gap-1.5 text-sm font-semibold"
                      >
                        <Video className="size-4" /> {L("Join link", "رابط الانضمام")}
                      </a>
                    )}
                    {iv.location && <p className="text-muted mt-1 text-sm">{iv.location}</p>}
                    {iv.instructions && <p className="mt-2 text-sm">{iv.instructions}</p>}
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
          {(feedback ?? []).length > 0 && (
            <Card>
              <CardHeader
                title={L("Shared feedback", "ملاحظات مُشارَكة")}
                description={L("The company chose to share this with you.", "اختارت الشركة مشاركة هذا معك.")}
              />
              <CardBody className="flex flex-col gap-3">
                {feedback!.map((f) => (
                  <p key={f.id} className="bg-surface-2 rounded-xl p-3 text-sm">
                    {f.body}
                  </p>
                ))}
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title={L("Your submission", "ما قدّمته")} />
            <CardBody className="text-muted text-sm">
              <p>
                {L("CV", "السيرة الذاتية")}:{" "}
                {app.cv ? `${app.cv.file_name} (v${app.cv.version})` : L("None", "لا يوجد")}
              </p>
              {app.cover_letter && <p className="mt-2 whitespace-pre-line">{app.cover_letter}</p>}
            </CardBody>
          </Card>
          {canWithdraw(status) && (
            <Card>
              <CardHeader
                title={L("Withdraw application", "سحب الطلب")}
                description={L(
                  "The company will be notified. This cannot be undone.",
                  "سيتم إبلاغ الشركة. لا يمكن التراجع.",
                )}
              />
              <CardBody>
                <form action={withdrawApplication.bind(null, app.id)} className="flex flex-col gap-3">
                  <Textarea
                    name="reason"
                    placeholder={L(
                      "Reason (optional, shared with the company)",
                      "السبب (اختياري، يُشارك مع الشركة)",
                    )}
                    maxLength={500}
                    rows={2}
                    aria-label={L("Reason", "السبب")}
                  />
                  <Button type="submit" variant="danger">
                    {L("Withdraw", "سحب")}
                  </Button>
                </form>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
