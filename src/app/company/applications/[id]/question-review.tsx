"use client";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, FileText, Sparkles, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { assessmentFileUrl } from "@/features/assessments/file-actions";
import { evaluateQuestionWithAI, reviewQuestion } from "@/features/assessments/question-evaluation-actions";
import type { RubricSource } from "@/lib/domain/question-evaluation";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";
import { formatBytes } from "@/lib/upload/rules";
import { cn } from "@/lib/utils";

export type ReviewCriterion = { key: string; name: string; max_points: number; description?: string | null };

export type AiEvaluationView = {
  id: string;
  status: "completed" | "no_submission" | "extraction_failed";
  rubric_source: RubricSource;
  criteria: {
    key: string;
    name: string;
    max_points: number;
    applicable?: boolean;
    score: number;
    evidence: string | null;
    evidence_verified: boolean;
    rationale: string;
  }[];
  requirements: { requirement: string; status: "fulfilled" | "partial" | "missing"; evidence: string | null; evidence_verified: boolean; note: string | null }[];
  strengths: string[];
  issues: string[];
  improvements: string[];
  concerns: string[];
  files: { file_id: string; file_name: string; method: string; status: string; chars: number; note: string | null; entries?: { name: string; size: number; status: string }[] }[];
  score: number | null;
  max_score: number;
  explanation: string | null;
  provider: string | null;
  model: string | null;
  created_at: string;
};

export type QuestionReviewView = {
  id: string;
  n: number;
  type: string;
  title: string;
  prompt: string;
  points: number;
  autoScored: boolean;
  deliverables: { name: string; format?: string | null; description?: string | null }[];
  rubricSource: RubricSource;
  /** Narrowed from an assessment-wide rubric with the builder's criterion → task mapping. */
  rubricMapped?: boolean;
  criteria: ReviewCriterion[];
  answerText: string | null;
  selected: { label: string; correct: boolean }[];
  autoPoints: number | null;
  files: { id: string; file_name: string; size_bytes: number; mime_type: string }[];
  ai: AiEvaluationView | null;
  aiRuns: number;
  review: {
    points: number;
    rubric_scores: Record<string, number>;
    comments: string | null;
    candidate_feedback: { strengths?: string; missing?: string; improvements?: string } | null;
    source: "human" | "ai_accepted" | "ai_adjusted";
    ai_evaluation_id: string | null;
    at: string;
    by: string | null;
  } | null;
  history: { action: string; points: number | null; previous_points: number | null; source: string | null; at: string }[];
};

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : String(Math.round(Number(n) * 100) / 100));

export function QuestionReviewPanel({
  applicationId,
  submissionId,
  questions,
  unlinkedFiles,
  totals,
}: {
  applicationId: string;
  submissionId: string;
  questions: QuestionReviewView[];
  unlinkedFiles: { id: string; file_name: string; size_bytes: number; mime_type: string }[];
  totals: { auto: number; manual: number; max: number; percentage: number | null; pending: number };
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [active, setActive] = useState(() => Math.max(0, questions.findIndex((q) => !q.autoScored && !q.review)));
  const q = questions[active] ?? questions[0];
  if (!q) return null;
  return (
    <div className="flex flex-col gap-4">
      {/* Per-question overview: AI suggestion and human-approved score side by side */}
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <caption className="sr-only">{L("Results by question", "النتائج حسب السؤال")}</caption>
          <thead className="bg-surface-2 text-muted text-xs">
            <tr>
              <th scope="col" className="p-2 text-start">{L("Question", "السؤال")}</th>
              <th scope="col" className="p-2 text-start">{L("AI suggestion", "اقتراح الذكاء الاصطناعي")}</th>
              <th scope="col" className="p-2 text-start">{L("Approved score", "الدرجة المعتمدة")}</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((x, i) => (
              <tr key={x.id} className={cn("border-t", i === active && "bg-surface-violet")}>
                <td className="p-2">
                  <button type="button" className="text-start font-semibold underline-offset-2 hover:underline" onClick={() => setActive(i)}>
                    {L(`Q${x.n}`, `س${x.n}`)} · {x.title}
                  </button>
                </td>
                <td className="ltr-nums p-2">
                  {x.autoScored ? (
                    <span className="text-subtle">{L("n/a (automatic)", "لا ينطبق (آلي)")}</span>
                  ) : x.ai ? (
                    x.ai.status === "extraction_failed" ? (
                      <span className="text-warning">{L("files unreadable", "تعذّرت قراءة الملفات")}</span>
                    ) : (
                      `${fmt(x.ai.score)}/${x.points}`
                    )
                  ) : (
                    <span className="text-subtle">{L("not run", "لم يُشغَّل")}</span>
                  )}
                </td>
                <td className="ltr-nums p-2">
                  {x.review ? (
                    <span className="font-bold">{fmt(x.review.points)}/{x.points}</span>
                  ) : x.autoScored ? (
                    <span>
                      {fmt(x.autoPoints)}/{x.points} <span className="text-subtle text-xs">{L("auto", "آلي")}</span>
                    </span>
                  ) : (
                    <span className="text-warning text-xs font-semibold">{L("awaiting review", "بانتظار المراجعة")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t font-bold">
            <tr>
              <td className="p-2">{L("Total (weighted by points)", "الإجمالي (موزون بالنقاط)")}</td>
              <td className="p-2" />
              <td className="ltr-nums p-2">
                {fmt(totals.auto + totals.manual)}/{totals.max}
                {totals.percentage !== null ? ` · ${fmt(totals.percentage)}%` : ` · ${L(`${totals.pending} pending`, `${totals.pending} بانتظار المراجعة`)}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label={L("Questions", "الأسئلة")}>
        {questions.map((x, i) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setActive(i)}
            aria-current={i === active ? "step" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition",
              i === active ? "bg-primary text-primary-foreground border-transparent" : "hover:bg-surface-2",
            )}
          >
            {L(`Question ${x.n}`, `السؤال ${x.n}`)}
            {x.review ? " ✓" : ""}
          </button>
        ))}
      </nav>

      <QuestionPanel key={q.id} applicationId={applicationId} submissionId={submissionId} q={q} />

      <div className="flex justify-between">
        <Button variant="ghost" size="sm" disabled={active === 0} onClick={() => setActive((i) => i - 1)}>
          <ChevronLeft className="rtl:rotate-180" /> {L("Previous question", "السؤال السابق")}
        </Button>
        <Button variant="outline" size="sm" disabled={active >= questions.length - 1} onClick={() => setActive((i) => i + 1)}>
          {L("Next question", "السؤال التالي")} <ChevronRight className="rtl:rotate-180" />
        </Button>
      </div>

      {unlinkedFiles.length > 0 && (
        <div className="bg-warning-soft rounded-2xl p-4 text-sm">
          <p className="font-bold">{L("Files not linked to any question", "ملفات غير مرتبطة بأي سؤال")}</p>
          <p className="text-muted mt-1 text-xs">
            {L(
              "Attached to the whole task before per-question uploads existed. They are not evaluated as an answer to any question; open them if relevant",
              "أُرفقت بالمهمة كاملة قبل إتاحة الرفع لكل سؤال. لا تُقيَّم كإجابة عن أي سؤال؛ افتحها عند الحاجة",
            )}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {unlinkedFiles.map((f) => (
              <FileRow key={f.id} f={f} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FileRow({ f }: { f: { id: string; file_name: string; size_bytes: number; mime_type: string } }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [busy, setBusy] = useState(false);
  const open = async (inline: boolean) => {
    setBusy(true);
    const res = await assessmentFileUrl(f.id, inline);
    setBusy(false);
    if (!res.ok || !res.data) return toast.error(res.ok ? L("Could not open the file", "تعذّر فتح الملف") : res.error);
    if (inline) window.open(res.data.url, "_blank", "noopener,noreferrer");
    else window.location.assign(res.data.url);
  };
  const previewable = /^(application\/pdf|image\/(png|jpeg|webp)|text\/)/.test(f.mime_type);
  return (
    <li className="bg-surface-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm">
      <FileText className="text-primary-ink size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate" dir="auto">
        {f.file_name}
      </span>
      <span className="ltr-nums text-subtle text-xs">{formatBytes(f.size_bytes)}</span>
      {previewable && (
        <Button type="button" variant="ghost" size="icon" className="size-8" disabled={busy} onClick={() => open(true)} aria-label={L(`Preview ${f.file_name}`, `معاينة ${f.file_name}`)}>
          <Eye className="size-4" />
        </Button>
      )}
      <Button type="button" variant="ghost" size="icon" className="size-8" disabled={busy} onClick={() => open(false)} aria-label={L(`Download ${f.file_name}`, `تنزيل ${f.file_name}`)}>
        <Download className="size-4" />
      </Button>
    </li>
  );
}

function SourceBadge({ source, mapped }: { source: RubricSource; mapped?: boolean }) {
  const { locale } = useI18n();
  const L = tx(locale);
  if (source === "employer_question" && mapped)
    return (
      <Badge tone="positive">
        {L("Employer rubric: this task's criteria (from the task mapping)", "معايير صاحب العمل: معايير هذه المهمة (وفق ربط المهام)")}
      </Badge>
    );
  if (source === "employer_question") return <Badge tone="positive">{L("Employer rubric for this question", "معايير صاحب العمل لهذا السؤال")}</Badge>;
  if (source === "employer_shared") return <Badge tone="info">{L("Assessment-wide employer rubric", "معايير صاحب العمل للتقييم كاملًا")}</Badge>;
  return <Badge tone="progress">{L("No rubric: AI suggests criteria for your approval", "لا توجد معايير: يقترح الذكاء الاصطناعي معايير لاعتمادك")}</Badge>;
}

function QuestionPanel({ applicationId, submissionId, q }: { applicationId: string; submissionId: string; q: QuestionReviewView }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [running, start] = useTransition();
  const runAi = () =>
    start(async () => {
      const res = await evaluateQuestionWithAI(applicationId, submissionId, q.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(L("AI evaluation ready for your review", "التقييم الآلي جاهز لمراجعتك"));
      router.refresh();
    });
  const ai = q.ai;
  const reqCount = ai?.requirements.length ?? 0;
  const fulfilled = ai?.requirements.filter((r) => r.status === "fulfilled").length ?? 0;
  return (
    <article className="flex flex-col gap-4 rounded-2xl border p-4" aria-label={L(`Question ${q.n}`, `السؤال ${q.n}`)}>
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold">{L(`Question ${q.n}`, `السؤال ${q.n}`)}</h3>
        <Badge tone="muted">{q.type.replace("_", " ")}</Badge>
        <span className="ltr-nums text-subtle text-xs">
          {q.points} {L("points", "نقطة")}
        </span>
      </header>

      <details open className="bg-surface-2 rounded-xl p-3 text-sm">
        <summary className="cursor-pointer font-semibold">{L("Instructions", "التعليمات")}</summary>
        <p className="mt-2 whitespace-pre-wrap" dir="auto">
          {q.prompt}
        </p>
      </details>
      {q.deliverables.length > 0 && (
        <div className="text-sm">
          <p className="font-semibold">{L("Expected deliverables", "المخرجات المتوقعة")}</p>
          <ul className="text-muted mt-1 list-disc ps-5">
            {q.deliverables.map((d, i) => (
              <li key={i} dir="auto">
                {d.name}
                {d.format ? ` (${d.format})` : ""}
                {d.description ? `: ${d.description}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!q.autoScored && (
        <div className="text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{L("Grading criteria", "معايير التقييم")}</p>
            <SourceBadge source={q.rubricSource} mapped={q.rubricMapped} />
          </div>
          {q.criteria.length > 0 ? (
            <ul className="text-muted mt-1 list-disc ps-5">
              {q.criteria.map((c) => (
                <li key={c.key}>
                  {c.name} (<span className="ltr-nums">/{c.max_points}</span>)
                </li>
              ))}
            </ul>
          ) : (
            ai?.rubric_source === "ai_derived" && (
              <ul className="text-muted mt-1 list-disc ps-5">
                {ai.criteria.map((c) => (
                  <li key={c.key}>
                    {c.name} (<span className="ltr-nums">/{c.max_points}</span>) · {L("AI-suggested", "مقترح آليًا")}
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}

      <div className="text-sm">
        <p className="font-semibold">{L("Candidate's answer", "إجابة المرشح")}</p>
        {q.selected.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-1">
            {q.selected.map((o, i) => (
              <li key={i} className={cn("rounded-lg px-2 py-1", o.correct ? "bg-success-soft" : "bg-danger-soft")} dir="auto">
                {o.label}
              </li>
            ))}
          </ul>
        ) : (
          <pre className="bg-surface-2 mt-1 max-h-72 overflow-auto rounded-xl p-3 font-mono text-xs whitespace-pre-wrap" dir="auto">
            {q.answerText?.trim() || L("(no written answer)", "(بلا إجابة مكتوبة)")}
          </pre>
        )}
      </div>

      {!q.autoScored && (
        <div className="text-sm">
          <p className="font-semibold">{L("Files submitted for this question", "الملفات المسلَّمة لهذا السؤال")}</p>
          {q.files.length === 0 ? (
            <p className="text-subtle mt-1 text-xs">{L("No files were submitted for this question", "لم تُسلَّم ملفات لهذا السؤال")}</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-2">
              {q.files.map((f) => (
                <FileRow key={f.id} f={f} />
              ))}
            </ul>
          )}
        </div>
      )}

      {!q.autoScored && (
        <section className="bg-surface-violet rounded-2xl p-4" aria-label={L("AI assessment", "التقييم الآلي")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-bold">
              <Sparkles className="text-primary-ink size-4" /> {L("AI assessment (suggestion)", "التقييم الآلي (اقتراح)")}
            </p>
            <Button type="button" size="sm" variant="soft" loading={running} onClick={runAi}>
              {ai ? L("Re-evaluate this question", "إعادة تقييم هذا السؤال") : L("Evaluate this question with AI", "قيّم هذا السؤال بالذكاء الاصطناعي")}
            </Button>
          </div>
          <p className="text-muted mt-1 text-xs">
            {L(
              "Uses only this question's instructions, criteria, answer and files. It assists your review; it is not a hiring decision",
              "يستخدم تعليمات هذا السؤال ومعاييره وإجابته وملفاته فقط. يساعد مراجعتك ولا يُعدّ قرار توظيف",
            )}
          </p>
          {ai && (
            <div className="mt-3 flex flex-col gap-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="ltr-nums text-xl font-extrabold">
                  {fmt(ai.score)}/{ai.max_score}
                </span>
                {ai.status === "completed" && reqCount > 0 && (
                  <Badge tone={fulfilled === reqCount ? "positive" : "info"}>
                    <span className="ltr-nums">
                      {L(`Requirements fulfilled: ${fulfilled}/${reqCount}`, `المتطلبات المستوفاة: ${fulfilled}/${reqCount}`)}
                    </span>
                  </Badge>
                )}
                {ai.status === "no_submission" && <Badge tone="negative">{L("Nothing submitted", "لم يُسلَّم شيء")}</Badge>}
                {ai.status === "extraction_failed" && <Badge tone="negative">{L("Not evaluated: files unreadable", "لم يُقيَّم: تعذّرت قراءة الملفات")}</Badge>}
                <span className="text-subtle text-xs">
                  {[ai.model, new Date(ai.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "en-GB", { timeZone: "Asia/Riyadh" })].filter(Boolean).join(" · ")}
                  {q.aiRuns > 1 ? ` · ${L(`${q.aiRuns} runs kept`, `${q.aiRuns} تشغيلات محفوظة`)}` : ""}
                </span>
              </div>
              {ai.explanation && <p dir="auto">{ai.explanation}</p>}
              {ai.requirements.length > 0 && (
                <div className="grid gap-3 md:grid-cols-3">
                  {(["fulfilled", "partial", "missing"] as const).map((st) => {
                    const list = ai.requirements.filter((r) => r.status === st);
                    return (
                      <div key={st} className="bg-surface rounded-xl p-3">
                        <p className={cn("text-xs font-bold", st === "fulfilled" ? "text-success" : st === "partial" ? "text-warning" : "text-danger")}>
                          {st === "fulfilled" ? L("Fulfilled", "مستوفى") : st === "partial" ? L("Partially fulfilled", "مستوفى جزئيًا") : L("Missing", "ناقص")} ({list.length})
                        </p>
                        <ul className="mt-1 flex flex-col gap-1 text-xs">
                          {list.map((r, i) => (
                            <li key={i} dir="auto">
                              {r.requirement}
                              {r.note ? <span className="text-muted"> — {r.note}</span> : null}
                              {r.evidence ? <q className="text-subtle block italic">{r.evidence}</q> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
              {ai.criteria.length > 0 && (
                <table className="w-full text-xs">
                  <thead className="text-muted">
                    <tr>
                      <th scope="col" className="py-1 text-start">{L("Criterion", "المعيار")}</th>
                      <th scope="col" className="py-1 text-start">{L("Score", "الدرجة")}</th>
                      <th scope="col" className="py-1 text-start">{L("Evidence and rationale", "الدليل والتعليل")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ai.criteria.map((c) => (
                      <tr key={c.key} className="border-t align-top">
                        <td className="py-1 pe-2 font-semibold">{c.name}</td>
                        <td className="ltr-nums py-1 pe-2">{c.applicable === false ? L("n/a", "لا ينطبق") : `${fmt(c.score)}/${c.max_points}`}</td>
                        <td className="py-1" dir="auto">
                          {c.evidence && <q className="block italic">{c.evidence}</q>}
                          {!c.evidence_verified && c.score > 0 && (
                            <span className="text-warning flex items-center gap-1">
                              <AlertTriangle className="size-3" /> {L("No quote from the submission backs this score", "لا يدعم هذه الدرجة اقتباس من التسليم")}
                            </span>
                          )}
                          <span className="text-muted">{c.rationale}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <ListBlock title={L("Strengths", "نقاط القوة")} items={ai.strengths} />
              <ListBlock title={L("Technical or factual issues", "ملاحظات تقنية أو معرفية")} items={ai.issues} />
              <ListBlock title={L("Improvement recommendations", "توصيات للتحسين")} items={ai.improvements} />
              {ai.concerns.length > 0 && <ListBlock title={L("Points to check", "نقاط للتحقق")} items={ai.concerns} warn />}
              {ai.files.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-semibold">{L("What the evaluator read", "ما قرأه المُقيِّم")}</summary>
                  <ul className="mt-1 flex flex-col gap-1">
                    {ai.files.map((f) => (
                      <li key={f.file_id} dir="auto">
                        <span className="font-semibold">{f.file_name}</span>: {f.status} · {f.method} · <span className="ltr-nums">{f.chars}</span> {L("characters", "حرفًا")}
                        {f.note ? ` · ${f.note}` : ""}
                        {f.entries && f.entries.length > 0 && (
                          <ul className="text-muted ms-4 list-disc">
                            {f.entries.slice(0, 40).map((e) => (
                              <li key={e.name}>
                                {e.name} [{e.status}]
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </section>
      )}

      <ReviewForm applicationId={applicationId} submissionId={submissionId} q={q} />
    </article>
  );
}

function ListBlock({ title, items, warn }: { title: string; items: string[]; warn?: boolean }) {
  if (!items.length) return null;
  return (
    <div>
      <p className={cn("text-xs font-bold", warn && "text-warning")}>{title}</p>
      <ul className="mt-1 list-disc ps-5 text-xs">
        {items.map((x, i) => (
          <li key={i} dir="auto">
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewForm({ applicationId, submissionId, q }: { applicationId: string; submissionId: string; q: QuestionReviewView }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(reviewQuestion.bind(null, applicationId, submissionId, q.id), null);
  useEffect(() => {
    if (state?.ok) {
      if (state.message) toast.success(state.message);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const criteria = useMemo(
    () => (q.criteria.length ? q.criteria : q.ai?.rubric_source === "ai_derived" ? q.ai.criteria : []),
    [q.criteria, q.ai],
  );
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(criteria.map((c) => [c.key, q.review?.rubric_scores?.[c.key] !== undefined ? String(q.review.rubric_scores[c.key]) : ""])),
  );
  const [points, setPoints] = useState(q.review ? String(q.review.points) : q.autoScored ? fmt(q.autoPoints) : "");
  const fb = q.review?.candidate_feedback ?? {};
  const [strengths, setStrengths] = useState(fb.strengths ?? "");
  const [missing, setMissing] = useState(fb.missing ?? "");
  const [improve, setImprove] = useState(fb.improvements ?? "");
  const [aiId, setAiId] = useState<string>(q.review?.ai_evaluation_id ?? "");
  const [open, setOpen] = useState(!q.autoScored);

  const suggested = useMemo(() => {
    const filled = criteria.filter((c) => scores[c.key] !== "" && scores[c.key] !== undefined);
    const total = filled.reduce((s, c) => s + c.max_points, 0);
    if (!total) return null;
    return Math.round((filled.reduce((s, c) => s + Number(scores[c.key]), 0) / total) * q.points * 100) / 100;
  }, [criteria, scores, q.points]);

  const useAi = () => {
    const ai = q.ai!;
    setScores(Object.fromEntries(criteria.map((c) => {
      const a = ai.criteria.find((x) => x.key === c.key);
      return [c.key, a && a.applicable !== false ? String(a.score) : ""];
    })));
    if (ai.score !== null) setPoints(String(ai.score));
    setStrengths(ai.strengths.join("\n"));
    setMissing(ai.requirements.filter((r) => r.status !== "fulfilled").map((r) => r.requirement).join("\n"));
    setImprove(ai.improvements.join("\n"));
    setAiId(ai.id);
  };

  const sourceLabel = (s: string | null) =>
    s === "ai_accepted" ? L("AI suggestion accepted", "اعتُمد اقتراح الذكاء الاصطناعي") : s === "ai_adjusted" ? L("AI suggestion adjusted by reviewer", "عدّل المراجِع اقتراح الذكاء الاصطناعي") : L("Scored by reviewer", "قيّمه المراجِع");

  return (
    <section className="rounded-2xl border p-4" aria-label={L("Human review", "مراجعة بشرية")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold">
          <UserCheck className="size-4" /> {L("Reviewer's decision", "قرار المراجِع")}
        </p>
        {q.review && (
          <span className="flex items-center gap-1 text-xs">
            <CheckCircle2 className="text-success size-4" />
            <span className="ltr-nums font-bold">
              {fmt(q.review.points)}/{q.points}
            </span>{" "}
            · {sourceLabel(q.review.source)}
            {q.review.by ? ` · ${q.review.by}` : ""}
          </span>
        )}
      </div>
      {q.autoScored && !open ? (
        <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => setOpen(true)}>
          {L("Adjust the automatic score", "تعديل الدرجة الآلية")}
        </Button>
      ) : (
        <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="ai_evaluation_id" value={aiId} />
          {q.ai && q.ai.score !== null && (
            <div className="sm:col-span-2">
              <Button type="button" size="sm" variant="soft" onClick={useAi}>
                <Sparkles /> {L("Start from the AI suggestion", "ابدأ من اقتراح الذكاء الاصطناعي")}
              </Button>
            </div>
          )}
          {criteria.map((c) => (
            <Field key={c.key} label={`${c.name} (/${c.max_points})`} htmlFor={`r-${q.id}-${c.key}`}>
              <Input
                id={`r-${q.id}-${c.key}`}
                name={`rubric_${c.key}`}
                type="number"
                min={0}
                max={c.max_points}
                step={0.5}
                value={scores[c.key] ?? ""}
                onChange={(e) => setScores((x) => ({ ...x, [c.key]: e.target.value }))}
              />
            </Field>
          ))}
          <Field
            label={L(`Approved score (/${q.points})`, `الدرجة المعتمدة (/${q.points})`)}
            htmlFor={`p-${q.id}`}
            hint={suggested !== null ? L(`Criteria suggest ${suggested}`, `تقترح المعايير ${suggested}`) : undefined}
          >
            <Input id={`p-${q.id}`} name="points" type="number" min={0} max={q.points} step={0.5} required value={points} onChange={(e) => setPoints(e.target.value)} />
          </Field>
          <Field label={L("Private reviewer notes (not shared)", "ملاحظات خاصة بالمراجِع (لا تُشارَك)")} htmlFor={`c-${q.id}`} className="sm:col-span-2">
            <Textarea id={`c-${q.id}`} name="comments" rows={2} maxLength={2000} defaultValue={q.review?.comments ?? ""} />
          </Field>
          <p className="text-muted text-xs font-semibold sm:col-span-2">
            {L("Feedback for the candidate on this question (shared only when you share feedback)", "ملاحظات للمرشح على هذا السؤال (تُشارَك فقط عند مشاركة الملاحظات)")}
          </p>
          <Field label={L("What was done well", "ما أُنجز جيدًا")} htmlFor={`s-${q.id}`}>
            <Textarea id={`s-${q.id}`} name="fb_strengths" rows={3} maxLength={2000} value={strengths} onChange={(e) => setStrengths(e.target.value)} dir="auto" />
          </Field>
          <Field label={L("What was missing", "ما كان ناقصًا")} htmlFor={`m-${q.id}`}>
            <Textarea id={`m-${q.id}`} name="fb_missing" rows={3} maxLength={2000} value={missing} onChange={(e) => setMissing(e.target.value)} dir="auto" />
          </Field>
          <Field label={L("How to improve", "كيف يتحسّن")} htmlFor={`i-${q.id}`} className="sm:col-span-2">
            <Textarea id={`i-${q.id}`} name="fb_improvements" rows={2} maxLength={2000} value={improve} onChange={(e) => setImprove(e.target.value)} dir="auto" />
          </Field>
          {state && !state.ok && (
            <div className="sm:col-span-2">
              <FormMessage>{state.error}</FormMessage>
            </div>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" loading={pending}>
              {q.review ? L("Update approved score", "تحديث الدرجة المعتمدة") : L("Approve score for this question", "اعتماد درجة هذا السؤال")}
            </Button>
          </div>
        </form>
      )}
      {q.history.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-semibold">{L("Review history", "سجل المراجعة")}</summary>
          <ul className="text-muted mt-1 flex flex-col gap-1">
            {q.history.map((h, i) => (
              <li key={i} className="ltr-nums">
                {new Date(h.at).toLocaleString(locale === "ar" ? "ar-SA" : "en-GB", { timeZone: "Asia/Riyadh" })} · {h.action}
                {h.previous_points !== null ? ` · ${fmt(h.previous_points)} → ${fmt(h.points)}` : ` · ${fmt(h.points)}`} · {sourceLabel(h.source)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
