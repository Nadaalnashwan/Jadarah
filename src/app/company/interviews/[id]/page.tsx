import Link from "next/link";
import { notFound } from "next/navigation";
import { Video } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { canRecruit, requireCompanyMember } from "@/lib/auth/session";
import { formatDateTime, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { EvaluationForm, FeedbackForm, FeedbackShareToggle, InterviewControls, QuestionSuggester } from "./interview-client";

export default async function InterviewDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireCompanyMember();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: iv } = await supabase
    .from("interviews")
    .select("*, application:applications(id, status, job:jobs(title_en, title_ar), candidate:profiles!applications_candidate_id_fkey(full_name)), interview_participants(user_id, role, profile:profiles!interview_participants_user_id_fkey(full_name)), interview_questions(id, question, kind, position, ai_generated), interview_evaluations(*, interviewer:profiles!interview_evaluations_interviewer_id_fkey(full_name)), interview_feedback(id, body, shared_with_candidate, created_at, author:profiles!interview_feedback_author_id_fkey(full_name))")
    .eq("id", id)
    .maybeSingle();
  if (!iv) notFound();
  const recruiter = canRecruit(s);
  const isParticipant = iv.interview_participants.some((p) => p.user_id === s.userId);
  const mine = iv.interview_evaluations.find((e) => e.interviewer_id === s.userId);
  const questions = [...iv.interview_questions].sort((a, b) => a.position - b.position);
  return (
    <>
      <PageHeader
        eyebrow={pick(iv.application?.job, "title", locale)}
        title={`${iv.application?.candidate?.full_name ?? "—"} · ${iv.title}`}
        description={`${formatDateTime(iv.scheduled_at, locale, iv.timezone)} (${iv.timezone}) · ${iv.duration_minutes} ${t.common.minutes}`}
        actions={<Badge tone={iv.status === "completed" ? "positive" : iv.status === "cancelled" ? "muted" : "progress"}>{iv.status}</Badge>}
      />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={L("Questions", "الأسئلة")} />
            <CardBody className="flex flex-col gap-3">
              {questions.length === 0 && <p className="text-sm text-subtle">{L("No questions yet.", "لا توجد أسئلة بعد.")}</p>}
              <ol className="flex flex-col gap-2">
                {questions.map((q, i) => <li key={q.id} className="rounded-xl border p-3 text-sm"><span className="ltr-nums text-subtle">{i + 1}.</span> {q.question} <Badge tone="neutral" className="ms-2">{q.kind}</Badge>{q.ai_generated && <Badge tone="progress" className="ms-1">AI</Badge>}</li>)}
              </ol>
              {recruiter && <QuestionSuggester interviewId={iv.id} />}
            </CardBody>
          </Card>
          {(isParticipant || mine) && (
            <Card>
              <CardHeader title={L("Your evaluation", "تقييمك")} description={L("Confidential: visible to your company's recruiters, never to the candidate.", "سري: يراه مسؤولو التوظيف في شركتك ولا يراه المرشح أبدًا.")} />
              <CardBody><EvaluationForm interviewId={iv.id} existing={mine ? { recommendation: mine.recommendation, ratings: mine.ratings as Record<string, number>, strengths: mine.strengths ?? "", concerns: mine.concerns ?? "", comments: mine.comments ?? "" } : null} /></CardBody>
            </Card>
          )}
          {recruiter && (
            <Card>
              <CardHeader title={L("All evaluations", "جميع التقييمات")} />
              <CardBody className="flex flex-col gap-3">
                {iv.interview_evaluations.length === 0 && <p className="text-sm text-subtle">{L("No evaluations submitted yet.", "لم تُرسل تقييمات بعد.")}</p>}
                {iv.interview_evaluations.map((e) => (
                  <div key={e.id} className="rounded-xl border p-4 text-sm">
                    <div className="flex justify-between"><span className="font-semibold">{e.interviewer?.full_name}</span><Badge tone={e.recommendation.includes("yes") ? "positive" : e.recommendation.includes("no") ? "negative" : "neutral"}>{e.recommendation.replace("_", " ")}</Badge></div>
                    <p className="ltr-nums mt-2 text-xs text-subtle">{Object.entries(e.ratings as Record<string, number>).map(([k, v]) => `${k}: ${v}/5`).join(" · ")}</p>
                    {e.strengths && <p className="mt-2"><strong>{L("Strengths", "نقاط القوة")}:</strong> {e.strengths}</p>}
                    {e.concerns && <p className="mt-1"><strong>{L("Concerns", "المخاوف")}:</strong> {e.concerns}</p>}
                    {e.comments && <p className="mt-1 text-muted">{e.comments}</p>}
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={L("Logistics", "التفاصيل")} />
            <CardBody className="flex flex-col gap-2 text-sm">
              {iv.meeting_url && <a href={iv.meeting_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-primary dark:text-lavender"><Video className="size-4" /> {L("Meeting link", "رابط الاجتماع")}</a>}
              {iv.location && <p>{iv.location}</p>}
              {iv.instructions && <p className="text-muted">{iv.instructions}</p>}
              <p className="mt-2 font-semibold">{L("Interviewers", "المُقابِلون")}</p>
              <ul className="text-muted">{iv.interview_participants.map((p) => <li key={p.user_id}>{p.profile?.full_name}</li>)}</ul>
              {recruiter && iv.application && <Link href={`/company/applications/${iv.application.id}`} className="mt-2 text-xs font-semibold text-primary dark:text-lavender">{L("Open application", "فتح الطلب")}</Link>}
            </CardBody>
          </Card>
          {recruiter && iv.status === "scheduled" && <Card><CardHeader title={L("Manage", "الإدارة")} /><CardBody><InterviewControls interviewId={iv.id} timezone={iv.timezone} /></CardBody></Card>}
          <Card>
            <CardHeader title={L("Feedback", "الملاحظات")} description={L("Share selected feedback with the candidate explicitly.", "شارك ملاحظات محددة مع المرشح بشكل صريح.")} />
            <CardBody className="flex flex-col gap-3">
              {iv.interview_feedback.map((f) => (
                <div key={f.id} className="rounded-xl bg-surface-2 p-3 text-sm">
                  <p>{f.body}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-subtle"><span>{f.author?.full_name}</span>{recruiter ? <FeedbackShareToggle interviewId={iv.id} feedbackId={f.id} shared={f.shared_with_candidate} /> : <span>{f.shared_with_candidate ? L("Shared", "مُشارَكة") : L("Private", "خاصة")}</span>}</div>
                </div>
              ))}
              {(recruiter || isParticipant) && iv.application && <FeedbackForm interviewId={iv.id} applicationId={iv.application.id} />}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
