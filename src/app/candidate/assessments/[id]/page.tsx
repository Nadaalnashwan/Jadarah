import { notFound } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, PageHeader, Progress } from "@/components/ui/primitives";
import { requireCandidate } from "@/lib/auth/session";
import { formatDateTime, formatNumber, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { AttemptGate } from "./attempt";

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
  questions: {
    id: string;
    type: string;
    prompt_en: string;
    prompt_ar: string;
    points: number;
    explanation_en: string | null;
    explanation_ar: string | null;
    options: { id: string; label_en: string; label_ar: string; is_correct: boolean }[];
    answer: {
      selected_option_ids: string[];
      text_answer: string | null;
      is_correct: boolean | null;
      points_awarded: number | null;
    } | null;
  }[];
};

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: asg } = await supabase
    .from("assessment_assignments")
    .select(
      "id, status, due_at, assessment:assessments(title_en, title_ar, description_en, description_ar, duration_minutes, passing_score, learning_outcomes_en, learning_outcomes_ar), assessment_submissions(status)",
    )
    .eq("id", id)
    .eq("candidate_id", session.userId)
    .maybeSingle();
  if (!asg) notFound();
  const submitted = asg.assessment_submissions && asg.assessment_submissions.status !== "in_progress";

  if (!submitted) {
    return (
      <AttemptGate
        assignmentId={asg.id}
        started={asg.status === "in_progress"}
        unavailable={asg.status === "expired" || asg.status === "cancelled"}
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
    );
  }

  const { data, error } = await supabase.rpc("get_assessment_result", { p_assignment: id });
  if (error || !data) notFound();
  const r = data as unknown as Result;
  const pct = r.submission.percentage;
  const passed = pct !== null && pct >= r.assessment.passing_score;
  return (
    <>
      <PageHeader
        eyebrow={L("Assessment results", "نتائج التقييم")}
        title={pick(r.assessment, "title", locale)}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden">
            <div className="bg-navy text-ivory p-6">
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
                    "Open answers are being reviewed by the company against the rubric.",
                    "تُراجع الشركة الإجابات المفتوحة وفق المعايير.",
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
              "Correct answers and explanations are revealed only after submission.",
              "تظهر الإجابات الصحيحة والشروح بعد التسليم فقط.",
            )}
          />
          <CardBody>
            <ol className="flex flex-col gap-5">
              {r.questions.map((q, i) => (
                <li key={q.id} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">
                      <span className="ltr-nums text-subtle">{i + 1}.</span> {pick(q, "prompt", locale)}
                    </p>
                    <span className="ltr-nums shrink-0 text-xs font-bold">
                      {q.answer?.points_awarded ?? "—"}/{q.points}
                    </span>
                  </div>
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
