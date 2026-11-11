import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, BadgeCheck, Brain, ClipboardCheck, FileText, Lock, Sparkles, UserRound, Users } from "lucide-react";
import { SkillRadar } from "@/components/app/charts";
import { MatchExplanation } from "@/components/app/match-explanation";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireCompanyMember } from "@/lib/auth/session";
import type { ApplicationStatus } from "@/lib/domain/application-status";
import { formatDate, formatDateTime, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { loadFinalReport } from "@/services/final-evaluation";
import {
  CommentBox,
  DecisionPanel,
  GenerateAiButton,
  PrintButton,
  ScoreRing,
  ShareFeedback,
  SummaryEditor,
} from "./report-client";

type Src = "verified_fact" | "cv_extraction" | "semantic_match" | "practical_assessment" | "interviewer_judgment" | "ai_inference";
const SRC_STYLE: Record<Src, string> = {
  verified_fact: "bg-success/12 text-success border-success/30",
  cv_extraction: "bg-sky-soft text-navy border-sky dark:text-sky",
  semantic_match: "bg-accent-soft text-primary border-lavender dark:text-lavender",
  practical_assessment: "bg-primary/10 text-primary border-primary/30 dark:text-lavender",
  interviewer_judgment: "bg-navy text-lavender border-navy",
  ai_inference: "bg-warning/12 text-warning border-warning/30",
};

function SourceChip({ k, label }: { k: Src; label: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold", SRC_STYLE[k])}>{label}</span>
  );
}

export default async function FinalReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const r = await loadFinalReport(supabase, id, s.activeMembership.company_id, locale);
  if (!r) notFound();
  const fe = r.final;
  const locked = fe?.status === "finalized";
  const ai = fe?.ai_report as
    | {
        summary: string;
        strengths: { point: string; evidence: string; source: Src }[];
        gaps: { point: string; evidence: string; source: Src }[];
        verify_next: string[];
        development: string[];
        recommendation: { stance: string; confidence: string; basis: string };
      }
    | null
    | undefined;
  const srcLabel = (k: Src) =>
    ({
      verified_fact: L("Verified fact", "حقيقة موثّقة"),
      cv_extraction: L("CV extraction", "مستخرج من السيرة"),
      semantic_match: L("Semantic match (inference)", "مطابقة دلالية (استنتاج)"),
      practical_assessment: L("Practical assessment", "التقييم العملي"),
      interviewer_judgment: L("Interviewer judgment", "تقدير المُقابِل"),
      ai_inference: L("AI inference", "استنتاج آلي"),
    })[k];
  const chip = (k: Src) => <SourceChip k={k} label={srcLabel(k)} />;
  const compLabel = { match: L("CV & match", "السيرة والمطابقة"), assessment: L("Practical assessment", "التقييم العملي"), interview: L("Structured interview", "المقابلة المنظّمة") };
  const stanceLabel: Record<string, string> = {
    advance: L("Advance", "المضي قدمًا"),
    hold: L("Hold", "التريّث"),
    do_not_advance: L("Do not advance", "عدم المتابعة"),
    insufficient_evidence: L("Insufficient evidence", "أدلة غير كافية"),
  };
  const decisionLabel: Record<string, string> = { hire: L("Hire", "توظيف"), reject: L("Do not proceed", "عدم المتابعة"), hold: L("Hold", "تعليق") };
  const recLabel: Record<string, string> = {
    strong_yes: L("Strong yes", "نعم بقوة"),
    yes: L("Yes", "نعم"),
    neutral: L("Neutral", "محايد"),
    no: L("No", "لا"),
    strong_no: L("Strong no", "لا بقوة"),
  };

  return (
    <div className="print:text-black">
      <PageHeader
        eyebrow={L("Final Candidate Evaluation Report", "تقرير التقييم النهائي للمرشح")}
        title={`${r.candidate.name} · ${pick(r.app.job, "title", locale)}`}
        actions={
          <>
            <Button asChild size="sm" variant="ghost" className="print:hidden">
              <Link href={`/company/applications/${id}`}>
                <ArrowLeft className="rtl:rotate-180" /> {L("Application", "الطلب")}
              </Link>
            </Button>
            <PrintButton />
            <Badge tone={locked ? "positive" : "neutral"}>
              {locked ? <Lock className="size-3.5" /> : null} {locked ? L("Finalized", "نهائي") : L("Draft", "مسودة")}
            </Badge>
          </>
        }
      />

      {/* hero: overall + breakdown */}
      <section className="from-navy via-navy-800 to-navy-700 relative mb-6 overflow-hidden rounded-[2rem] bg-gradient-to-br p-6 text-white sm:p-8">
        <div className="bg-primary/30 pointer-events-none absolute -end-24 -top-24 size-72 rounded-full blur-3xl" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[auto_1fr_auto]">
          <ScoreRing score={r.overall.score} />
          <div className="flex flex-col gap-3">
            <p className="text-lavender text-xs font-bold tracking-widest uppercase">{L("Overall evidence score", "درجة الأدلة الإجمالية")}</p>
            {r.overall.components.map((c) => (
              <div key={c.key}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{compLabel[c.key]}</span>
                  <span className="ltr-nums text-lavender text-xs">
                    {c.value === null ? L("No evidence yet", "لا أدلة بعد") : `${c.value} · ${L("weight", "الوزن")} ${Math.round(c.effectiveWeight * 100)}%`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${c.value ?? 0}%` }} />
                </div>
              </div>
            ))}
            <p className="text-lavender/80 text-[11px]">
              {L(
                `Weights re-normalise over available evidence (coverage ${Math.round(r.overall.coverage * 100)}%). Missing evidence is never imputed.`,
                `تُعاد موازنة الأوزان على الأدلة المتاحة (التغطية ${Math.round(r.overall.coverage * 100)}٪). لا تُفترض أي أدلة مفقودة.`,
              )}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <StatusBadge status={r.app.status as ApplicationStatus} t={t} />
            {fe?.decision && (
              <span className="bg-white/10 rounded-full px-3 py-1 text-sm font-bold">
                {L("Decision", "القرار")}: {decisionLabel[fe.decision]}
              </span>
            )}
            {r.interview.disagreement && (
              <span className="bg-warning/20 text-warning flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold">
                <AlertTriangle className="size-3.5" /> {L("Interviewers disagree", "المُقابِلون مختلفون")}
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="mb-6 flex flex-wrap gap-1.5" aria-label={L("Source legend", "دليل المصادر")}>
        {(Object.keys(SRC_STYLE) as Src[]).map((k) => (
          <SourceChip key={k} k={k} label={srcLabel(k)} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-6">
          {/* A. overview */}
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><UserRound className="size-4" /> A · {L("Candidate overview", "نظرة على المرشح")}</span>} />
            <CardBody className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="font-semibold">{r.candidate.profile?.headline ?? "—"}</p>
                <p className="text-muted ltr-nums">
                  {r.candidate.profile?.years_experience ?? "—"} {L("years", "سنوات")} · {r.candidate.profile?.experience_level ?? "—"} · {r.candidate.profile?.city ?? "—"}
                </p>
                <p className="text-subtle mt-3 mb-1 text-xs font-bold uppercase">{L("Education", "التعليم")}</p>
                <ul className="flex flex-col gap-1">
                  {r.candidate.education.length ? r.candidate.education.slice(0, 3).map((e, i) => <li key={i}>{[e.degree, e.field].filter(Boolean).join(", ")} — {e.institution}</li>) : <li>—</li>}
                </ul>
              </div>
              <div>
                <p className="text-subtle mb-1 text-xs font-bold uppercase">{L("Experience", "الخبرة")}</p>
                <ul className="flex flex-col gap-1">
                  {r.candidate.experience.length ? r.candidate.experience.slice(0, 4).map((e, i) => <li key={i}>{e.title} · <span className="text-muted">{e.company}</span></li>) : <li>—</li>}
                </ul>
                <p className="text-subtle mt-3 mb-1 text-xs font-bold uppercase">{L("Application history", "سجل الطلب")}</p>
                <ol className="flex flex-wrap gap-1">
                  {r.timeline.map((h, i) => (
                    <li key={i} className="bg-surface-2 rounded-full px-2 py-0.5 text-[11px]">
                      {t.status[h.to_status as ApplicationStatus] ?? h.to_status} <span className="text-subtle ltr-nums">{formatDate(h.created_at, locale)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </CardBody>
          </Card>

          {/* B. matching */}
          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><FileText className="size-4" /> B · {L("CV & semantic matching", "السيرة والمطابقة الدلالية")}</span>}
              description={<span className="flex flex-wrap gap-1">{chip("cv_extraction")}{chip("semantic_match")}</span>}
            />
            <CardBody>
              <MatchExplanation match={r.match} t={t} locale={locale} compact />
            </CardBody>
          </Card>

          {/* C. assessments */}
          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><ClipboardCheck className="size-4" /> C · {L("Assessment performance", "الأداء في التقييم")}</span>}
              description={chip("practical_assessment")}
            />
            <CardBody className="flex flex-col gap-4 text-sm">
              {r.assessments.length === 0 ? (
                <p className="text-muted">{L("No practical assessment was assigned. This component is excluded from the score.", "لم يُسند تقييم عملي. يُستبعد هذا المكوّن من الدرجة.")}</p>
              ) : (
                r.assessments.map((a) => (
                  <div key={a.id} className="rounded-2xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{locale === "ar" ? a.title_ar : a.title_en}</p>
                      <span className="ltr-nums font-extrabold">{a.percentage === null ? L("Not scored yet", "لم يُصحَّح بعد") : `${Math.round(Number(a.percentage))}%`}</span>
                    </div>
                    {a.percentage !== null && (
                      <div className="bg-surface-2 relative mt-2 h-2 rounded-full">
                        <div className="bg-primary h-full rounded-full" style={{ width: `${Number(a.percentage)}%` }} />
                        {a.passing !== null && <span className="bg-navy dark:bg-lavender absolute -top-1 h-4 w-0.5" style={{ insetInlineStart: `${a.passing}%` }} title={L("Passing score", "درجة النجاح")} />}
                      </div>
                    )}
                    {a.needsReview && <p className="text-warning mt-2 text-xs">{L("Open answers await human review.", "إجابات مفتوحة بانتظار المراجعة البشرية.")}</p>}
                    {a.evaluations.length > 0 && (
                      <ul className="mt-3 flex flex-col gap-2">
                        {a.evaluations.map((e, i) => (
                          <li key={i} className="bg-surface-2 rounded-xl p-3">
                            <p className="line-clamp-2 text-xs font-semibold">{locale === "ar" ? e.prompt_ar : e.prompt_en}</p>
                            <p className="ltr-nums text-subtle text-xs">{e.points}{e.max ? ` / ${e.max}` : ""}</p>
                            {e.comments && <p className="mt-1 text-xs">“{e.comments}”</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* D. interviews */}
          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><Users className="size-4" /> D · {L("Structured interview evaluation", "تقييم المقابلة المنظّمة")}</span>}
              description={chip("interviewer_judgment")}
            />
            <CardBody className="flex flex-col gap-4 text-sm">
              {r.evaluations.length === 0 ? (
                <p className="text-muted">{L("No interviewer evaluations submitted yet. This component is excluded from the score.", "لم تُرسل تقييمات المقابلة بعد. يُستبعد هذا المكوّن من الدرجة.")}</p>
              ) : (
                <>
                  <SkillRadar
                    data={r.interview.criteria
                      .filter((c) => c.average !== null)
                      .map((c) => ({ label: locale === "ar" ? c.name_ar : c.name_en, value: c.average! }))}
                  />
                  <div className="overflow-x-auto">
                    <table className="w-full text-start text-xs">
                      <thead className="text-subtle">
                        <tr>
                          <th className="py-1 text-start">{L("Criterion", "المعيار")}</th>
                          <th className="py-1 text-end">{L("Average (1–5)", "المتوسط (1–5)")}</th>
                          <th className="py-1 text-end">{L("Weight", "الوزن")}</th>
                          <th className="py-1 text-end">{L("Ratings", "التقييمات")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.interview.criteria.map((c) => (
                          <tr key={c.key} className="border-t">
                            <td className="py-1.5">{locale === "ar" ? c.name_ar : c.name_en}</td>
                            <td className="ltr-nums py-1.5 text-end font-bold">{c.average ?? "—"}</td>
                            <td className="ltr-nums py-1.5 text-end">{c.weight}</td>
                            <td className="ltr-nums py-1.5 text-end">{c.ratings}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(r.interview.recommendations)
                      .filter(([, n]) => n > 0)
                      .map(([k, n]) => (
                        <Badge key={k} tone={k.includes("yes") ? "positive" : k.includes("no") ? "negative" : "neutral"}>
                          {recLabel[k]} × <span className="ltr-nums">{n}</span>
                        </Badge>
                      ))}
                  </div>
                  <ul className="flex flex-col gap-3">
                    {r.evaluations.map((e, i) => (
                      <li key={i} className="rounded-2xl border p-3">
                        <p className="font-semibold">{e.interviewer} <span className="text-subtle text-xs font-normal">· {recLabel[e.recommendation]}</span></p>
                        {e.strengths && <p className="text-success mt-1 text-xs">+ {e.strengths}</p>}
                        {e.concerns && <p className="text-danger mt-1 text-xs">− {e.concerns}</p>}
                        {e.comments && <p className="text-muted mt-1 text-xs">{e.comments}</p>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {/* E–G. AI-assisted analysis */}
          <Card className="border-lavender/60">
            <CardHeader
              title={<span className="flex items-center gap-2"><Brain className="size-4" /> E–G · {L("AI-assisted analysis", "تحليل بمساعدة الذكاء الاصطناعي")}</span>}
              description={chip("ai_inference")}
              action={!locked ? <GenerateAiButton applicationId={id} regenerate={Boolean(ai)} /> : undefined}
            />
            <CardBody className="flex flex-col gap-4 text-sm">
              {!ai ? (
                <p className="text-muted">
                  {L(
                    "Generate an evidence synthesis: strengths, gaps, what to verify next and a recommendation with its basis. It uses a de-identified evidence pack and never changes the candidate's status.",
                    "أنشئ خلاصة للأدلة: نقاط القوة والفجوات وما يلزم التحقق منه وتوصية مع أساسها. يستخدم حزمة أدلة دون بيانات تعريفية ولا يغيّر حالة المرشح.",
                  )}
                </p>
              ) : (
                <>
                  <div className="bg-accent-soft/60 rounded-2xl p-4">
                    <p className="flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
                      <Sparkles className="text-primary size-3.5" /> {L("AI recommendation", "توصية الذكاء الاصطناعي")}
                    </p>
                    <p className="mt-1 text-xl font-extrabold">
                      {stanceLabel[ai.recommendation.stance]}{" "}
                      <span className="text-subtle text-xs font-semibold">· {L("confidence", "الثقة")}: {ai.recommendation.confidence}</span>
                    </p>
                    <p className="mt-2 leading-relaxed">{ai.recommendation.basis}</p>
                  </div>
                  <p className="leading-relaxed">{ai.summary}</p>
                  {(["strengths", "gaps"] as const).map((k) => (
                    <div key={k}>
                      <p className={cn("mb-1.5 text-xs font-bold uppercase", k === "strengths" ? "text-success" : "text-danger")}>
                        {k === "strengths" ? L("Strengths (evidence-backed)", "نقاط قوة (مدعومة بالأدلة)") : L("Gaps & weaknesses", "فجوات ونقاط ضعف")}
                      </p>
                      <ul className="flex flex-col gap-2">
                        {ai[k].map((p, i) => (
                          <li key={i} className="rounded-xl border p-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold">{p.point}</p>
                              {chip(p.source)}
                            </div>
                            <p className="text-muted mt-0.5 text-xs">{p.evidence}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {ai.verify_next.length > 0 && (
                    <div>
                      <p className="text-warning mb-1 text-xs font-bold uppercase">{L("Verify next", "يلزم التحقق")}</p>
                      <ul className="list-inside list-disc text-xs">{ai.verify_next.map((v, i) => <li key={i}>{v}</li>)}</ul>
                    </div>
                  )}
                  {ai.development.length > 0 && (
                    <div>
                      <p className="text-primary mb-1 text-xs font-bold uppercase">{L("Development opportunities", "فرص التطوير")}</p>
                      <ul className="list-inside list-disc text-xs">{ai.development.map((v, i) => <li key={i}>{v}</li>)}</ul>
                    </div>
                  )}
                  <p className="text-subtle text-[11px]">
                    {formatDateTime(fe?.ai_generated_at, locale)} · {fe?.ai_author?.full_name ?? ""}
                  </p>
                </>
              )}
            </CardBody>
          </Card>

          {/* H. panel + decision */}
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><BadgeCheck className="size-4" /> H · {L("Panel conclusion & final human decision", "خلاصة اللجنة والقرار البشري النهائي")}</span>} />
            <CardBody className="flex flex-col gap-5 text-sm">
              <SummaryEditor applicationId={id} initial={fe?.summary ?? ""} locked={locked} />
              <div>
                <p className="text-subtle mb-2 text-xs font-bold uppercase">{L("Reviewer notes", "ملاحظات المراجعين")}</p>
                <ul className="mb-2 flex flex-col gap-2">
                  {(fe?.final_evaluation_comments ?? []).map((c) => (
                    <li key={c.id} className="bg-surface-2 rounded-xl p-2.5">
                      <p className="text-xs">{c.body}</p>
                      <p className="text-subtle ltr-nums mt-1 text-[10px]">{c.author?.full_name} · {formatDateTime(c.created_at, locale)}</p>
                    </li>
                  ))}
                </ul>
                {!locked && <CommentBox applicationId={id} />}
              </div>
              {locked ? (
                <div className="bg-sky-soft rounded-2xl p-4">
                  <p className="font-bold">{L("Decision", "القرار")}: {decisionLabel[fe!.decision!]}</p>
                  <p className="mt-1">{fe!.decision_rationale}</p>
                  <p className="text-subtle ltr-nums mt-2 text-[11px]">
                    {fe!.decider?.full_name} · {formatDateTime(fe!.decided_at, locale)}
                  </p>
                </div>
              ) : (
                <DecisionPanel applicationId={id} canHireDirectly={!r.app.was_shortlisted} />
              )}
              <div>
                <p className="text-subtle mb-2 text-xs font-bold uppercase">{L("Feedback shared with the candidate", "الملاحظات المشتركة مع المرشح")}</p>
                {fe?.feedback_shared_at && (
                  <p className="text-success mb-2 text-xs">
                    {L("Shared", "تمت المشاركة")} · <span className="ltr-nums">{formatDateTime(fe.feedback_shared_at, locale)}</span>
                  </p>
                )}
                <ShareFeedback applicationId={id} shared={fe?.candidate_feedback ?? null} />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
