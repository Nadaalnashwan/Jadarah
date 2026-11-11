import { notFound } from "next/navigation";
import { CheckCircle2, Trash2 } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { deleteQuestion } from "@/features/assessments/company-actions";
import { requireCompanyMember } from "@/lib/auth/session";
import { pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AIQuestions, JobContextBanner, PublishControls, QuestionBuilder, RubricEditor } from "./builder";
import { ApproveButton, MaterialLink, RegenerateButtons, ScenarioEditor, TaskEditor } from "./generated-client";
import type { GeneratedDraft } from "@/services/ai/assessment-builder";

const CHECK_LABELS: Record<string, [string, string]> = {
  skill_coverage: ["Skill coverage", "تغطية المهارات"],
  task_count: ["Number of tasks", "عدد المهام"],
  deliverable_clarity: ["Clear deliverables", "وضوح المخرجات"],
  time_feasibility: ["Realistic timing", "واقعية الوقت"],
  input_availability: ["Required inputs provided", "توفر المدخلات"],
  rubric_alignment: ["Rubric matches tasks", "مواءمة المعايير مع المهام"],
  scoring_consistency: ["Consistent scoring", "اتساق الدرجات"],
  originality: ["Original content", "أصالة المحتوى"],
  no_assessor_leakage: ["No answer leakage", "عدم تسريب الإجابات"],
  no_legacy_branding: ["Branding", "الهوية"],
  dataset_validity: ["Valid data files", "سلامة ملفات البيانات"],
};
const REASON_LABELS: Record<string, [string, string]> = {
  "same role": ["same role", "الدور نفسه"],
  "same sector": ["same sector", "القطاع نفسه"],
  "shared skills": ["shared skills", "مهارات مشتركة"],
  "similar task structure": ["similar task structure", "بنية مهام مشابهة"],
};

export default async function AssessmentBuilder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("assessments")
    .select("*, assessment_questions(*, assessment_options(*)), assessment_rubrics(id, criteria)")
    .eq("id", id)
    .eq("company_id", s.activeMembership.company_id)
    .maybeSingle();
  if (!a) notFound();
  // Job context: the job this task is attached to (or was created for).
  const { data: linkedJob } = await supabase
    .from("jobs")
    .select("id, title_en, title_ar, status, assessment_id")
    .eq("company_id", s.activeMembership.company_id)
    .or(`assessment_id.eq.${a.id}${a.job_id ? `,id.eq.${a.job_id}` : ""}`)
    .order("assessment_id", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  // Manager-scoped check (proposal 0028). Falls back to the legacy helper until that migration is applied.
  const scoped = await supabase.rpc("assessment_in_use_for_manager" as "assessment_is_in_use", {
    p_assessment: a.id,
  });
  const inUse = scoped.error
    ? (await supabase.rpc("assessment_is_in_use", { p_assessment: a.id })).data
    : scoped.data;
  const qs = [...a.assessment_questions].sort((x, y) => x.position - y.position);
  const draft = a.status === "draft";
  const total = qs.reduce((n, q) => n + q.points, 0);
  const rubric = (a.assessment_rubrics?.[0]?.criteria ?? []) as {
    key: string;
    name_en: string;
    name_ar: string;
    description_en?: string;
    description_ar?: string;
    max_points: number;
  }[];
  const [{ data: gen }, { data: guide }, { data: materials }] = await Promise.all([
    supabase
      .from("assessment_generations")
      .select("output, validation, references_used, status, provider, model, job_snapshot")
      .eq("assessment_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("assessment_assessor_guides").select("guide").eq("assessment_id", id).maybeSingle(),
    supabase.from("assessment_materials").select("id, file_name, audience, rows, columns, description").eq("assessment_id", id).order("file_name"),
  ]);
  const out = gen?.output as GeneratedDraft | null | undefined;
  const checks = (gen?.validation ?? []) as { check: string; passed: boolean; detail: string }[];
  const refsUsed = (gen?.references_used ?? []) as { role: string; sector: string | null; similarity: number; reason: string }[];
  const failed = checks.filter((c) => !c.passed).length;
  const { data: jobs } = draft
    ? await supabase
        .from("jobs")
        .select("id, title_en, title_ar")
        .eq("company_id", s.activeMembership.company_id)
        .in("status", ["draft", "published", "paused"])
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };
  return (
    <>
      <PageHeader
        title={pick(a, "title", locale)}
        description={`${a.duration_minutes} ${t.common.minutes} · ${L("pass", "النجاح")} ${a.passing_score}% · ${total} ${t.common.points}`}
        actions={
          <>
            <Badge tone={a.status === "published" ? "positive" : "neutral"}>{a.status}</Badge>
            {a.ai_generated && <Badge tone="progress">{t.common.aiGenerated}</Badge>}
            {gen && draft ? (
              <ApproveButton id={a.id} blocked={failed > 0} />
            ) : (
              <PublishControls id={a.id} status={a.status as "draft"} locked={!!inUse} />
            )}
          </>
        }
      />
      {linkedJob && (
        <JobContextBanner
          jobId={linkedJob.id}
          title={pick(linkedJob, "title", locale)}
          attached={linkedJob.assessment_id === a.id}
          taskPublished={a.status === "published"}
          jobPublished={linkedJob.status === "published"}
        />
      )}
      {inUse && (
        <p className="bg-surface-2 text-muted mb-6 rounded-xl px-4 py-3 text-sm">
          {L(
            "Candidates have received this task, so its content is locked and everyone is assessed on the same version. Duplicate it to make changes.",
            "استلم مرشحون هذه المهمة، لذا أصبح محتواها ثابتًا ليُقيَّم الجميع على النسخة نفسها. أنشئ نسخة منها لإجراء تعديلات.",
          )}
        </p>
      )}
      {gen && out && (
        <div className="mb-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader
              title={L("Scenario", "السيناريو")}
              action={draft ? <ScenarioEditor id={a.id} d={out} /> : undefined}
            />
            <CardBody className="flex flex-col gap-4 text-sm">
              <p className="leading-relaxed whitespace-pre-line" dir="auto">{locale === "ar" ? out.scenario_ar : out.scenario_en}</p>
              <ol className="flex flex-col gap-3">
                {out.tasks.map((task, i) => (
                  <li key={i} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold">
                        <span className="ltr-nums text-subtle me-1">{i + 1}.</span> {locale === "ar" ? task.title_ar : task.title_en}
                      </p>
                      <span className="text-subtle ltr-nums shrink-0 text-xs">{task.time_minutes} {t.common.minutes}</span>
                    </div>
                    <p className="text-muted mt-1 text-xs whitespace-pre-line" dir="auto">{locale === "ar" ? task.instructions_ar : task.instructions_en}</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {task.deliverables.map((dl, k) => (
                        <li key={k}><Badge tone="neutral">{dl.name} · {dl.format}</Badge></li>
                      ))}
                    </ul>
                    {draft && <TaskEditor id={a.id} index={i} t={task} />}
                  </li>
                ))}
              </ol>
              {draft && <RegenerateButtons id={a.id} />}
            </CardBody>
          </Card>
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader title={L("Validation", "التحقق")} description={failed ? L(`${failed} to resolve`, `${failed} للمعالجة`) : L("All checks passed", "اجتازت كل الفحوص")} />
              <CardBody>
                <ul className="flex flex-col gap-1.5 text-xs">
                  {checks.map((c) => (
                    <li key={c.check} className="flex items-start gap-2">
                      <span className={c.passed ? "text-success" : "text-danger"}>{c.passed ? "✓" : "✕"}</span>
                      <span>
                        <span className="font-semibold">{CHECK_LABELS[c.check] ? L(...CHECK_LABELS[c.check]) : c.check}</span>
                        {!c.passed && <span className="text-muted"> — {c.detail}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={L("Materials", "المواد")} />
              <CardBody className="flex flex-col gap-2">
                {(materials ?? []).length === 0 && <p className="text-muted text-sm">—</p>}
                {(materials ?? []).map((m) => (
                  <div key={m.id}>
                    <MaterialLink id={m.id} name={m.file_name} />
                    <p className="text-subtle ltr-nums text-[11px]">{m.rows} × {m.columns?.length} · {m.description}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={L("Reference examples", "الأمثلة المرجعية")} />
              <CardBody>
                <ul className="flex flex-col gap-2 text-xs">
                  {refsUsed.length === 0 && <li className="text-muted">—</li>}
                  {refsUsed.map((r, i) => (
                    <li key={i}>
                      <span className="font-semibold">{r.role}</span>{" "}
                      <span className="text-subtle">
                        · {r.reason.split(" · ").map((x) => (REASON_LABELS[x] ? L(...REASON_LABELS[x]) : x)).join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
            {guide && (
              <Card className="border-navy/30">
                <CardHeader title={L("Assessor guide", "دليل المقيّم")} description={L("Evaluators only", "للمقيّمين فقط")} />
                <CardBody className="flex flex-col gap-3 text-xs">
                  {(() => {
                    const gd = guide.guide as { overview?: string; scoring_guidance?: string[]; red_flags?: string[]; rubric?: { key: string; criterion_en: string; criterion_ar: string; max_points: number; expected_evidence: string; levels?: { strong: string; adequate: string; weak: string } }[] };
                    return (
                      <>
                        {gd.overview && <p className="leading-relaxed">{gd.overview}</p>}
                        <ul className="flex flex-col gap-2">
                          {(gd.rubric ?? []).map((c) => (
                            <li key={c.key} className="rounded-xl border p-2.5">
                              <p className="font-bold">{locale === "ar" ? c.criterion_ar : c.criterion_en} <span className="ltr-nums text-subtle">/{c.max_points}</span></p>
                              <p className="text-muted mt-0.5">{c.expected_evidence}</p>
                              {c.levels && <p className="text-subtle mt-1">↑ {c.levels.strong} · ↓ {c.levels.weak}</p>}
                            </li>
                          ))}
                        </ul>
                        {(gd.red_flags ?? []).length > 0 && <p className="text-warning">{gd.red_flags!.join(" · ")}</p>}
                      </>
                    );
                  })()}
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title={L("Questions", "الأسئلة")}
            description={
              draft
                ? undefined
                : L(
                    "Published assessments are read-only. Move back to draft to edit.",
                    "التقييمات المنشورة للقراءة فقط. أعدها إلى مسودة للتعديل.",
                  )
            }
          />
          <CardBody>
            {qs.length === 0 && (
              <p className="text-subtle text-sm">{L("No questions yet.", "لا توجد أسئلة بعد.")}</p>
            )}
            <ol className="flex flex-col gap-3">
              {qs.map((q, i) => (
                <li key={q.id} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold">
                      <span className="ltr-nums text-subtle">{i + 1}.</span> {pick(q, "prompt", locale)}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone="info">{q.type}</Badge>
                      <span className="ltr-nums text-xs font-bold">{q.points}</span>
                      {draft && (
                        <form action={deleteQuestion.bind(null, a.id, q.id)}>
                          <button
                            className="text-subtle hover:bg-danger-soft hover:text-danger flex size-7 items-center justify-center rounded-full"
                            aria-label={t.common.delete}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                  {q.assessment_options.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm">
                      {[...q.assessment_options]
                        .sort((x, y) => x.position - y.position)
                        .map((o) => (
                          <li key={o.id} className="flex items-center gap-2">
                            {o.is_correct ? (
                              <CheckCircle2 className="text-success size-4" />
                            ) : (
                              <span className="size-4" />
                            )}
                            {pick(o, "label", locale)}
                          </li>
                        ))}
                    </ul>
                  )}
                  {Array.isArray((q.config as { accepted_answers?: string[] })?.accepted_answers) && (
                    <p className="text-subtle mt-2 text-xs">
                      {L("Accepted", "المقبول")}:{" "}
                      {(q.config as { accepted_answers: string[] }).accepted_answers.join(" | ")}
                    </p>
                  )}
                  {q.rubric_id && (
                    <p className="text-subtle mt-2 text-xs">
                      {L("Reviewed by a person using the rubric", "يراجعه شخص وفق المعايير")}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
        {draft && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader title={L("Add question", "إضافة سؤال")} />
              <CardBody>
                <QuestionBuilder assessmentId={a.id} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title={L("Draft with AI", "صياغة بالذكاء الاصطناعي")}
                description={L(
                  "Suggestions are added to this draft for your review — never published automatically.",
                  "تُضاف الاقتراحات إلى هذه المسودة لمراجعتك — ولا تُنشر تلقائيًا.",
                )}
              />
              <CardBody>
                <AIQuestions
                  assessmentId={a.id}
                  jobs={(jobs ?? []).map((j) => ({ id: j.id, title: pick(j, "title", locale) }))}
                />
              </CardBody>
            </Card>
          </div>
        )}
        {rubric.length > 0 && (
          <Card className="xl:col-span-2">
            <CardHeader
              title={L("Open-answer rubric", "معايير الإجابات المفتوحة")}
              description={
                draft
                  ? L(
                      "Reviewers score open answers with these criteria. Edit AI-drafted criteria before publishing.",
                      "يقيّم المراجعون الإجابات المفتوحة بهذه المعايير. عدّل المعايير المقترحة آليًا قبل النشر.",
                    )
                  : L("Locked after publishing.", "مقفلة بعد النشر.")
              }
            />
            <CardBody>
              <RubricEditor key={JSON.stringify(rubric)} assessmentId={a.id} initial={rubric} editable={draft} />
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
