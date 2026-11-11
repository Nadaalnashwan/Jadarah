import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, FileBarChart, Lock, Mail, MapPin } from "lucide-react";
import { MatchExplanation } from "@/components/app/match-explanation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireCompanyMember } from "@/lib/auth/session";
import { canCreateInterview, employerTargets, type ApplicationStatus } from "@/lib/domain/application-status";
import { formatDate, formatDateTime, formatNumber, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { assessmentFileUrl } from "@/features/assessments/file-actions";
import { SignedFileLink } from "@/features/assessments/file-download";
import { matchJob } from "@/services/candidate";
import { withSemantics } from "@/services/semantic";
import type { CandidateSkillRecord } from "@/lib/domain/matching";
import {
  AssignAssessmentForm,
  CvButton,
  EvaluateAnswerForm,
  InterviewForm,
  NoteForm,
  ShareFeedbackForm,
  ShortlistForInterviewButton,
  StatusForm,
} from "./panels";

export default async function CompanyApplicationDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ schedule?: string; scheduled?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const cid = s.activeMembership.company_id;
  const { data: app } = await supabase
    .from("applications")
    .select(
      "*, job:jobs(id, title_en, title_ar, min_years, assessment_id, job_skills(importance, min_level, skill:skills(id, name_en, name_ar))), candidate:profiles!applications_candidate_id_fkey(id, full_name, email), cv:candidate_documents(id, file_name, version), application_answers(answer, question:job_application_questions(question_en, question_ar))",
    )
    .eq("id", id)
    .eq("company_id", cid)
    .maybeSingle();
  if (!app) notFound();
  const candId = app.candidate_id;
  const [
    { data: cp },
    { data: skills },
    { data: exp },
    { data: edu },
    { data: projects },
    { data: history },
    { data: notes },
    { data: asg },
    { data: interviews },
    { data: members },
    { data: library },
  ] = await Promise.all([
    supabase
      .from("candidate_profiles")
      .select("headline, summary, city, years_experience")
      .eq("user_id", candId)
      .maybeSingle(),
    supabase
      .from("candidate_skills")
      .select("level, source, evidence, skill:skills(id, name_en, name_ar)")
      .eq("candidate_id", candId),
    supabase
      .from("candidate_experience")
      .select("title, company, start_date, end_date, is_current")
      .eq("candidate_id", candId)
      .order("start_date", { ascending: false }),
    supabase.from("candidate_education").select("degree, institution, end_date").eq("candidate_id", candId),
    supabase.from("candidate_projects").select("title, description").eq("candidate_id", candId),
    supabase
      .from("application_status_history")
      .select(
        "from_status, to_status, reason, candidate_message, created_at, actor:profiles!application_status_history_changed_by_fkey(full_name)",
      )
      .eq("application_id", id)
      .order("created_at"),
    supabase
      .from("application_notes")
      .select("id, body, created_at, author:profiles!application_notes_author_id_fkey(full_name)")
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("assessment_assignments")
      .select(
        "id, status, due_at, assessment:assessments(id, title_en, title_ar, assessment_questions(id, type, prompt_en, prompt_ar, points, config, rubric:assessment_rubrics(criteria))), submission:assessment_submissions(id, status, auto_score, manual_score, max_score, percentage, needs_review, candidate_feedback, feedback_shared, assessment_answers(question_id, text_answer, points_awarded, is_correct), assessment_evaluations(question_id, points, comments))",
      )
      .eq("application_id", id),
    supabase
      .from("interviews")
      .select("id, title, status, scheduled_at, timezone, type")
      .eq("application_id", id)
      .order("scheduled_at"),
    supabase
      .from("company_memberships")
      .select("user_id, role, profile:profiles!company_memberships_user_id_fkey(full_name)")
      .eq("company_id", cid)
      .eq("status", "active"),
    supabase
      .from("assessments")
      .select("id, title_en, title_ar, company_id")
      .eq("status", "published")
      .or(`company_id.is.null,company_id.eq.${cid}`)
      .order("title_en"),
  ]);
  // Submitted deliverables (file_upload answers). Separate query: if the files table is not available
  // yet, the rest of the page still renders.
  const submissionIds = (asg ?? []).map((x) => x.submission?.id).filter((x): x is string => Boolean(x));
  const { data: answerFiles } = submissionIds.length
    ? await supabase
        .from("assessment_answer_files")
        .select("id, submission_id, question_id, file_name, size_bytes")
        .in("submission_id", submissionIds)
        .order("created_at")
    : { data: [] as { id: string; submission_id: string; question_id: string; file_name: string; size_bytes: number }[] };
  const status = app.status as ApplicationStatus;
  const records: CandidateSkillRecord[] = (skills ?? [])
    .filter((x) => x.skill)
    .map((x) => ({ skill_id: x.skill!.id, level: x.level, source: x.source as "cv", evidence: x.evidence }));
  const match = await withSemantics(supabase, matchJob(app.job!, records, cp?.years_experience ?? null, locale), {
    candidateId: candId,
    jobId: app.job!.id,
    candidateSkillIds: records.map((r) => r.skill_id),
    locale,
    refreshJob: true,
  });
  const interviewAllowed = canCreateInterview({ status, was_shortlisted: app.was_shortlisted });
  const taskPending = app.requires_task && !app.completed_at;
  const canShortlist = !interviewAllowed && employerTargets(status, taskPending).includes("shortlisted");
  const openInterviews = (interviews ?? []).filter((iv) => iv.status !== "cancelled" && iv.status !== "completed");

  return (
    <>
      <PageHeader
        eyebrow={pick(app.job, "title", locale)}
        title={app.candidate?.full_name ?? "—"}
        description={cp?.headline ?? undefined}
        actions={
          <>
            <Button asChild size="sm" variant="soft">
              <Link href={`/company/applications/${id}/report`}>
                <FileBarChart /> {L("Final evaluation report", "تقرير التقييم النهائي")}
              </Link>
            </Button>
            {canShortlist && !taskPending && <ShortlistForInterviewButton applicationId={id} size="sm" />}
            <StatusBadge status={status} t={t} />
          </>
        }
      />
      {sp.scheduled && (
        <p className="bg-success-soft text-success mb-4 rounded-xl px-4 py-3 text-sm font-semibold">
          {L(
            "Interview scheduled. The candidate and the interviewers were notified.",
            "جُدولت المقابلة وأُبلغ المرشح والمُقابِلون.",
          )}{" "}
          <Link href={`/company/interviews/${sp.scheduled}`} className="underline">
            {L("Open interview", "فتح المقابلة")}
          </Link>
        </p>
      )}
      {taskPending && (
        <p className="bg-surface-2 text-muted mb-4 rounded-xl px-4 py-3 text-sm">
          {L(
            "This candidate applied and received the job's practical task automatically, but hasn't submitted it yet. The application becomes complete — and ready for your evaluation — when the task is submitted.",
            "تقدّم هذا المرشح واستلم المهمة العملية للوظيفة تلقائيًا، لكنه لم يسلّمها بعد. يكتمل الطلب ويصبح جاهزًا لتقييمك عند تسليم المهمة.",
          )}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title={L("Evidence match", "مطابقة الأدلة")}
              action={
                <Link
                  href={`/company/compare?ids=${id}`}
                  className="text-primary dark:text-lavender text-xs font-semibold"
                >
                  {L("Compare", "قارن")}
                </Link>
              }
            />
            <CardBody>
              <MatchExplanation match={match} t={t} locale={locale} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={L("Candidate profile", "ملف المرشح")} />
            <CardBody className="flex flex-col gap-4 text-sm">
              <div className="text-muted flex flex-wrap gap-x-4 gap-y-1">
                {cp?.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-4" /> {cp.city}
                  </span>
                )}
                {app.candidate?.email && (
                  <a
                    href={`mailto:${app.candidate.email}`}
                    className="hover:text-foreground flex items-center gap-1"
                    dir="ltr"
                  >
                    <Mail className="size-4" /> {app.candidate.email}
                  </a>
                )}
                {cp?.years_experience !== null && cp?.years_experience !== undefined && (
                  <span className="ltr-nums">
                    {cp.years_experience} {t.common.years}
                  </span>
                )}
              </div>
              {cp?.summary && <p className="leading-relaxed">{cp.summary}</p>}
              {app.cv && <CvButton applicationId={id} label={`${app.cv.file_name} (v${app.cv.version})`} />}
              {(exp ?? []).length > 0 && (
                <div>
                  <p className="mb-1 font-semibold">{L("Experience", "الخبرة")}</p>
                  <ul className="text-muted space-y-1">
                    {exp!.map((e, i) => (
                      <li key={i}>
                        {e.title} · {e.company}{" "}
                        <span className="text-xs">
                          ({formatDate(e.start_date, locale, { year: "numeric" })}–
                          {e.is_current
                            ? L("now", "الآن")
                            : formatDate(e.end_date, locale, { year: "numeric" })}
                          )
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(edu ?? []).length > 0 && (
                <div>
                  <p className="mb-1 font-semibold">{L("Education", "التعليم")}</p>
                  <ul className="text-muted space-y-1">
                    {edu!.map((e, i) => (
                      <li key={i}>
                        {e.degree} · {e.institution}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(projects ?? []).length > 0 && (
                <div>
                  <p className="mb-1 font-semibold">{L("Projects", "المشاريع")}</p>
                  <ul className="text-muted space-y-1">
                    {projects!.map((p, i) => (
                      <li key={i}>
                        <strong>{p.title}</strong> — {p.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {app.cover_letter && (
                <div>
                  <p className="mb-1 font-semibold">{L("Cover letter", "خطاب التقديم")}</p>
                  <p className="text-muted whitespace-pre-line">{app.cover_letter}</p>
                </div>
              )}
              {app.application_answers.map((a, i) => (
                <div key={i}>
                  <p className="mb-1 font-semibold">{pick(a.question, "question", locale)}</p>
                  <p className="text-muted">{a.answer}</p>
                </div>
              ))}
            </CardBody>
          </Card>
          {(asg ?? []).map((a) => {
            const sub = a.submission;
            return (
              <Card key={a.id}>
                <CardHeader
                  title={pick(a.assessment, "title", locale)}
                  description={
                    sub
                      ? sub.status === "in_progress"
                        ? L("In progress", "قيد التنفيذ")
                        : sub.needs_review
                          ? L(
                              "Open answers need your rubric review",
                              "الإجابات المفتوحة تحتاج مراجعتك وفق المعايير",
                            )
                          : L("Evaluated", "تم التقييم")
                      : L("Not started", "لم يبدأ")
                  }
                  action={
                    sub?.percentage !== null && sub?.percentage !== undefined ? (
                      <span className="ltr-nums text-2xl font-extrabold">
                        {formatNumber(sub.percentage, locale)}%
                      </span>
                    ) : undefined
                  }
                />
                {sub && sub.status !== "in_progress" && (
                  <CardBody className="flex flex-col gap-4">
                    <p className="ltr-nums text-subtle text-xs">
                      {L("Auto", "آلي")} {sub.auto_score} + {L("Reviewed", "مراجَع")} {sub.manual_score} /{" "}
                      {sub.max_score}
                    </p>
                    {(a.assessment?.assessment_questions ?? [])
                      .filter(
                        (q) =>
                          !["multiple_choice", "multiple_select", "true_false"].includes(q.type) &&
                          !(
                            q.type === "short_answer" &&
                            Array.isArray((q.config as { accepted_answers?: unknown })?.accepted_answers)
                          ),
                      )
                      .map((q) => {
                        const ans = sub.assessment_answers.find((x) => x.question_id === q.id);
                        const ev = sub.assessment_evaluations.find((x) => x.question_id === q.id);
                        return (
                          <div key={q.id} className="rounded-2xl border p-4">
                            <p className="text-sm font-semibold">{pick(q, "prompt", locale)}</p>
                            <pre
                              className="bg-surface-2 mt-2 max-h-60 overflow-auto rounded-xl p-3 font-mono text-xs whitespace-pre-wrap"
                              dir="auto"
                            >
                              {ans?.text_answer || (q.type === "file_upload" ? L("(no note)", "(بلا ملاحظة)") : L("(no answer)", "(بلا إجابة)"))}
                            </pre>
                            {q.type === "file_upload" && (
                              <div className="mt-2 flex flex-col gap-2">
                                {(answerFiles ?? []).filter((f) => f.submission_id === sub.id && f.question_id === q.id).length === 0 ? (
                                  <p className="text-subtle text-xs">{L("No files submitted.", "لم تُرفع ملفات.")}</p>
                                ) : (
                                  (answerFiles ?? [])
                                    .filter((f) => f.submission_id === sub.id && f.question_id === q.id)
                                    .map((f) => (
                                      <SignedFileLink key={f.id} name={f.file_name} size={f.size_bytes} getUrl={assessmentFileUrl.bind(null, f.id)} />
                                    ))
                                )}
                              </div>
                            )}
                            <EvaluateAnswerForm
                              applicationId={id}
                              submissionId={sub.id}
                              questionId={q.id}
                              max={q.points}
                              criteria={
                                (q.rubric?.criteria as {
                                  key: string;
                                  name_en: string;
                                  name_ar: string;
                                  max_points: number;
                                }[]) ?? []
                              }
                              existing={
                                ev ? { points: Number(ev.points), comments: ev.comments ?? "" } : null
                              }
                            />
                          </div>
                        );
                      })}
                    <ShareFeedbackForm
                      applicationId={id}
                      submissionId={sub.id}
                      current={sub.candidate_feedback ?? ""}
                      shared={sub.feedback_shared}
                    />
                  </CardBody>
                )}
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title={L("Decision", "القرار")}
              description={L(
                "Validated against the recruitment rules. The candidate sees only the message you choose to share.",
                "يُتحقق منه وفق قواعد التوظيف. لا يرى المرشح إلا الرسالة التي تختار مشاركتها.",
              )}
            />
            <CardBody>
              <StatusForm applicationId={id} targets={employerTargets(status, taskPending)} />
            </CardBody>
          </Card>
          <Card id="interviews" className="scroll-mt-24">
            <CardHeader title={L("Interviews", "المقابلات")} />
            <CardBody className="flex flex-col gap-3">
              {(interviews ?? []).map((iv) => (
                <Link
                  key={iv.id}
                  href={`/company/interviews/${iv.id}`}
                  className="hover:border-primary/40 flex items-center gap-3 rounded-xl border p-3"
                >
                  <CalendarClock className="text-primary dark:text-lavender size-4" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{iv.title}</span>
                    <span className="text-subtle text-xs">
                      {formatDateTime(iv.scheduled_at, locale, iv.timezone)}
                    </span>
                  </span>
                  <Badge
                    tone={
                      iv.status === "completed"
                        ? "positive"
                        : iv.status === "cancelled"
                          ? "muted"
                          : "progress"
                    }
                  >
                    {iv.status}
                  </Badge>
                </Link>
              ))}
              {interviewAllowed ? (
                <InterviewForm
                  applicationId={id}
                  defaultOpen={sp.schedule === "1" && openInterviews.length === 0}
                  context={{ candidate: app.candidate?.full_name ?? "—", job: pick(app.job, "title", locale) }}
                  members={(members ?? []).map((m) => ({
                    id: m.user_id,
                    name: `${m.profile?.full_name ?? "—"} · ${t.roles[m.role]}`,
                  }))}
                />
              ) : canShortlist && !taskPending ? (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-muted text-sm">
                    {L(
                      "Interviews require a shortlist first. One click does both: shortlist, then schedule here.",
                      "تتطلب المقابلة إضافة المرشح إلى القائمة المختصرة أولًا. بنقرة واحدة: ترشيح ثم جدولة هنا.",
                    )}
                  </p>
                  <ShortlistForInterviewButton applicationId={id} />
                </div>
              ) : (
                <p className="bg-surface-2 text-muted flex items-start gap-2 rounded-xl p-3 text-sm">
                  <Lock className="mt-0.5 size-4 shrink-0" />{" "}
                  {L(
                    "Shortlist this candidate before scheduling an interview.",
                    "أضف المرشح إلى القائمة المختصرة قبل جدولة مقابلة.",
                  )}
                </p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title={app.requires_task ? L("Assign an additional assessment", "إسناد تقييم إضافي") : L("Assign assessment", "إسناد تقييم")}
              description={
                app.requires_task
                  ? L(
                      "The job's practical task was assigned automatically when the candidate applied.",
                      "أُسندت المهمة العملية للوظيفة تلقائيًا عند التقديم.",
                    )
                  : undefined
              }
            />
            <CardBody>
              <AssignAssessmentForm
                applicationId={id}
                assessments={(library ?? []).map((a) => ({
                  id: a.id,
                  name: pick(a, "title", locale) + (a.company_id ? " ★" : ""),
                }))}
                defaultId={app.requires_task ? "" : (app.job?.assessment_id ?? "")}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title={L("Internal notes", "ملاحظات داخلية")}
              description={L(
                "Visible to your recruiters only — never to candidates or interviewers.",
                "مرئية لمسؤولي التوظيف فقط — لا للمرشحين ولا للمُقابِلين.",
              )}
            />
            <CardBody className="flex flex-col gap-3">
              <NoteForm applicationId={id} />
              {(notes ?? []).map((n) => (
                <div key={n.id} className="bg-surface-2 rounded-xl p-3 text-sm">
                  <p className="whitespace-pre-line">{n.body}</p>
                  <p className="text-subtle mt-1 text-xs">
                    {n.author?.full_name} · {formatDateTime(n.created_at, locale)}
                  </p>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={L("History", "السجل")} />
            <CardBody>
              <ol className="flex flex-col gap-3 text-sm">
                {(history ?? []).map((h, i) => (
                  <li key={i} className="border-primary/40 border-s-2 ps-3">
                    <p className="font-semibold">{t.status[h.to_status]}</p>
                    <p className="text-subtle text-xs">
                      {h.actor?.full_name ?? "—"} · {formatDateTime(h.created_at, locale)}
                    </p>
                    {h.reason && (
                      <p className="text-muted mt-1">
                        {L("Internal", "داخلي")}: {h.reason}
                      </p>
                    )}
                    {h.candidate_message && (
                      <p className="text-primary dark:text-lavender mt-1">
                        {L("Shared", "مُشارَك")}: {h.candidate_message}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
