import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { CompanyMark } from "@/components/app/company-mark";
import { MaterialLink } from "@/app/company/assessments/[id]/generated-client";
import { CheckCircle2, XCircle } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, PageHeader, Progress } from "@/components/ui/primitives";
import { requireCandidate } from "@/lib/auth/session";
import { formatDateTime, formatNumber, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { AttemptGate } from "./attempt";
import { SignedFileLink } from "@/features/assessments/file-download";
import { assessmentFileUrl } from "@/features/assessments/file-actions";

type Result = {
  assessment: {
    title_en: string;
    title_ar: string;
    passing_score: number;
    learning_outcomes_en: string[];
    learning_outcomes_ar: string[];
  };
  submission: {
    status: string;
    auto_score: number;
    manual_score: number;
    max_score: number;
    percentage: number | null;
    needs_review: boolean;
    submitted_at: string;
    feedback: string | null;
  };
  unlinked_files?: { id: string; file_name: string; size_bytes: number }[];
  questions: {
    id: string;
    type: string;
    prompt_en: string;
    prompt_ar: string;
    points: number;
    explanation_en: string | null;
    explanation_ar: string | null;
    options: { id: string; label_en: string; label_ar: string; is_correct: boolean }[];
    /** Migration 0033: per-question review state, shared feedback and the files submitted for the question. */
    auto_scored?: boolean;
    reviewed?: boolean;
    feedback?: { strengths?: string; missing?: string; improvements?: string } | null;
    files?: { id: string; file_name: string; size_bytes: number }[];
    answer: {
      selected_option_ids: string[];
      text_answer: string | null;
      is_correct: boolean | null;
      points_awarded: number | null;
    } | null;
  }[];
};

export default async function AssessmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ applied?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: asg } = await supabase
    .from("assessment_assignments")
    .select(
      "id, status, due_at, assessment_id, application:applications(id, requires_task, completed_at, status, job:jobs(title_en, title_ar), company:company_profiles(name_en, name_ar, sector_en, sector_ar, organization_type, company_brand_profiles(identity_status, usage_permission, logo_source_url, primary_hex), company_identity(logo_path, primary_hex, secondary_hex, accent_hex))), assessment:assessments(title_en, title_ar, description_en, description_ar, duration_minutes, passing_score, learning_outcomes_en, learning_outcomes_ar), assessment_submissions(status)",
    )
    .eq("id", id)
    .eq("candidate_id", session.userId)
    .maybeSingle();
  if (!asg) notFound();
  const submitted = asg.assessment_submissions && asg.assessment_submissions.status !== "in_progress";
  // Candidate-audience files only (RLS: assigned candidates never see assessor materials).
  const { data: materials } = await supabase
    .from("assessment_materials")
    .select("id, file_name, description")
    .eq("assessment_id", asg.assessment_id)
    .eq("audience", "candidate")
    .order("file_name");
  const app = asg.application;
  const company = app?.company;
  const jobTask = !!app?.requires_task;
  const brand = company ? (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-2.5">
        <CompanyMark company={company} size="sm" className="bg-white/10" />
        <span className="text-lavender text-sm font-semibold">{locale === "ar" ? company.name_ar : company.name_en}</span>
      </span>
      {app?.job && (
        <span className="text-sky/80 text-xs">
          {jobTask ? L("Practical task for", "المهمة العملية لوظيفة") : L("For", "لوظيفة")} {pick(app.job, "title", locale)}
        </span>
      )}
    </span>
  ) : undefined;
  const appliedBanner =
    sp.applied === "1" && jobTask ? (
      <p className="bg-success-soft text-success mb-4 rounded-xl px-4 py-3 text-sm font-semibold">
        {L(
          "Application received. Complete and submit the practical task to finish your application",
          "استلمنا طلبك. أكمل المهمة العملية وسلّمها لإتمام طلبك",
        )}
      </p>
    ) : null;
  const materialList = materials?.length ? (
    <div className="bg-surface-2 rounded-2xl p-4">
      <p className="mb-2 text-sm font-bold">{L("Materials", "المواد")}</p>
      <ul className="flex flex-col gap-1.5">
        {materials.map((m) => (
          <li key={m.id}>
            <MaterialLink id={m.id} name={m.file_name} />
            {m.description && <p className="text-subtle text-xs">{m.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  ) : undefined;

  if (!submitted) {
    return (
      <>
      {appliedBanner}
      <AttemptGate
        assignmentId={asg.id}
        started={asg.status === "in_progress"}
        unavailable={asg.status === "expired" || asg.status === "cancelled"}
        brand={brand}
        materials={materialList}
        intro={{
          title: pick(asg.assessment, "title", locale),
          description: pick(asg.assessment, "description", locale),
          minutes: asg.assessment?.duration_minutes ?? 0,
          due: asg.due_at ? formatDateTime(asg.due_at, locale) : null,
          outcomes:
            locale === "ar"
              ? (asg.assessment?.learning_outcomes_ar ?? [])
              : (asg.assessment?.learning_outcomes_en ?? []),
        }}
      />
      </>
    );
  }

  const { data, error } = await supabase.rpc("get_assessment_result", { p_assignment: id });
  if (error || !data) notFound();
  const r = data as unknown as Result;
  const pct = r.submission.percentage;
  // Files attached to the whole task before per-question uploads existed (not linked to any question).
  const solutionFiles = r.unlinked_files ?? [];
  const passed = pct !== null && pct >= r.assessment.passing_score;
  return (
    <>
      <PageHeader
        eyebrow={jobTask ? L("Practical task submitted", "سُلّمت المهمة العملية") : L("Assessment results", "نتائج التقييم")}
        title={pick(r.assessment, "title", locale)}
      />
      {jobTask && app && (
        <div className="bg-success-soft mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
          <div>
            <p className="text-success font-bold">{L("Your application is complete", "اكتمل طلبك")}</p>
            <p className="text-muted text-sm">
              {L(
                "The company now sees your profile, your CV (if shared) and this submission. People make the decision — you'll be notified of every update",
                "ترى الشركة الآن ملفك وسيرتك (إن أرفقتها) وهذا التسليم. القرار بيد أشخاص، وستصلك إشعارات بكل تحديث",
              )}
            </p>
          </div>
          <Link href={`/candidate/applications/${app.id}`} className={buttonVariants({ size: "sm" })}>
            {L("Track application", "تتبّع الطلب")}
          </Link>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden">
            <div className="ink p-6">
              <p className="text-sky/80 text-sm">
                {r.submission.needs_review
                  ? L("Objective score so far", "الدرجة الموضوعية حتى الآن")
                  : L("Final score", "الدرجة النهائية")}
              </p>
              <p className="ltr-nums mt-1 text-6xl font-extrabold">
                {pct !== null
                  ? `${formatNumber(pct, locale)}%`
                  : `${formatNumber(r.submission.auto_score, locale)}`}
              </p>
              <p className="ltr-nums text-sky/70 mt-1 text-xs">
                {formatNumber(Number(r.submission.auto_score) + Number(r.submission.manual_score), locale)} /{" "}
                {formatNumber(r.submission.max_score, locale)} {t.common.points}
              </p>
              {pct !== null && <Progress value={pct} className="mt-4 bg-white/10" />}
            </div>
            <CardBody className="text-sm">
              {r.submission.needs_review ? (
                <Badge tone="progress">
                  {L(
                    "Open answers are being reviewed by the company against the rubric",
                    "تُراجع الشركة الإجابات المفتوحة وفق المعايير",
                  )}
                </Badge>
              ) : (
                <Badge tone={passed ? "positive" : "neutral"}>
                  {passed
                    ? L("Above the passing score", "فوق درجة النجاح")
                    : L("Below the passing score", "دون درجة النجاح")}{" "}
                  (<span className="ltr-nums">{r.assessment.passing_score}%</span>)
                </Badge>
              )}
            </CardBody>
          </Card>
          {solutionFiles.length > 0 && (
            <Card>
              <CardHeader
                title={L("Files not linked to a question", "ملفات غير مرتبطة بسؤال")}
                description={`${L("Submitted", "سُلّمت")} ${formatDateTime(r.submission.submitted_at, locale)}`}
              />
              <CardBody className="flex flex-col gap-2">
                {solutionFiles.map((f) => (
                  <SignedFileLink key={f.id} name={f.file_name} size={f.size_bytes} getUrl={assessmentFileUrl.bind(null, f.id)} />
                ))}
              </CardBody>
            </Card>
          )}
          {r.submission.feedback && (
            <Card>
              <CardHeader title={L("Feedback shared with you", "ملاحظات مُشارَكة معك")} />
              <CardBody className="text-sm">{r.submission.feedback}</CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title={L("Learning outcomes", "مخرجات التعلّم")} />
            <CardBody>
              <ul className="text-muted list-disc space-y-1 ps-5 text-sm">
                {(locale === "ar"
                  ? r.assessment.learning_outcomes_ar
                  : r.assessment.learning_outcomes_en
                ).map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader
            title={L("Your answers", "إجاباتك")}
            description={L(
              "Correct answers and explanations are revealed only after submission",
              "تظهر الإجابات الصحيحة والشروح بعد التسليم فقط",
            )}
          />
          <CardBody>
            <ol className="flex flex-col gap-5">
              {r.questions.map((q, i) => (
                <li key={q.id} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">
                      <span className="ltr-nums text-subtle">{i + 1}</span> {pick(q, "prompt", locale)}
                    </p>
                    <span className="ltr-nums shrink-0 text-xs font-bold">
                      {q.auto_scored || q.reviewed || q.reviewed === undefined ? (q.answer?.points_awarded ?? "—") : "—"}/{q.points}
                    </span>
                  </div>
                  {q.reviewed !== undefined && (
                    <p className="mt-2">
                      {q.auto_scored ? (
                        <Badge tone="muted">{L("Scored automatically", "صُحّح آليًا")}</Badge>
                      ) : q.reviewed ? (
                        <Badge tone="positive">{L("Reviewed by the company", "راجعته الشركة")}</Badge>
                      ) : (
                        <Badge tone="progress">{L("Awaiting review", "بانتظار المراجعة")}</Badge>
                      )}
                    </p>
                  )}
                  {(q.files?.length ?? 0) > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      <p className="text-muted text-xs font-semibold">{L("Your files for this question", "ملفاتك لهذا السؤال")}</p>
                      {q.files!.map((f) => (
                        <SignedFileLink key={f.id} name={f.file_name} size={f.size_bytes} getUrl={assessmentFileUrl.bind(null, f.id)} />
                      ))}
                    </div>
                  )}
                  {q.options.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {q.options.map((o) => {
                        const chosen = q.answer?.selected_option_ids?.includes(o.id);
                        return (
                          <li
                            key={o.id}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                              o.is_correct
                                ? "bg-success-soft"
                                : chosen
                                  ? "bg-danger-soft"
                                  : "bg-surface-2/60",
                            )}
                          >
                            {o.is_correct ? (
                              <CheckCircle2 className="text-success size-4" />
                            ) : chosen ? (
                              <XCircle className="text-danger size-4" />
                            ) : (
                              <span className="size-4" />
                            )}
                            {pick(o, "label", locale)}{" "}
                            {chosen && (
                              <span className="text-subtle ms-auto text-xs">
                                {L("your choice", "اختيارك")}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {q.answer?.text_answer && (
                    <pre
                      className="bg-surface-2 mt-3 rounded-lg p-3 font-mono text-xs whitespace-pre-wrap"
                      dir="auto"
                    >
                      {q.answer.text_answer}
                    </pre>
                  )}
                  {q.feedback && (q.feedback.strengths || q.feedback.missing || q.feedback.improvements) && (
                    <div className="bg-surface-violet mt-3 grid gap-2 rounded-xl p-3 text-sm">
                      {q.feedback.strengths && (
                        <div>
                          <p className="text-success text-xs font-bold">{L("What you did well", "ما أحسنت فيه")}</p>
                          <p className="whitespace-pre-wrap" dir="auto">{q.feedback.strengths}</p>
                        </div>
                      )}
                      {q.feedback.missing && (
                        <div>
                          <p className="text-danger text-xs font-bold">{L("What was missing", "ما كان ناقصًا")}</p>
                          <p className="whitespace-pre-wrap" dir="auto">{q.feedback.missing}</p>
                        </div>
                      )}
                      {q.feedback.improvements && (
                        <div>
                          <p className="text-primary-ink text-xs font-bold">{L("How to improve", "كيف تتحسّن")}</p>
                          <p className="whitespace-pre-wrap" dir="auto">{q.feedback.improvements}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {pick(q, "explanation", locale) && (
                    <p className="text-muted mt-3 text-sm">💡 {pick(q, "explanation", locale)}</p>
                  )}
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
