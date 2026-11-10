import { notFound } from "next/navigation";
import { CheckCircle2, Trash2 } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { deleteQuestion } from "@/features/assessments/company-actions";
import { requireCompanyMember } from "@/lib/auth/session";
import { pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AIQuestions, PublishControls, QuestionBuilder } from "./builder";

export default async function AssessmentBuilder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: a } = await supabase.from("assessments").select("*, assessment_questions(*, assessment_options(*))").eq("id", id).eq("company_id", s.activeMembership.company_id).maybeSingle();
  if (!a) notFound();
  const qs = [...a.assessment_questions].sort((x, y) => x.position - y.position);
  const draft = a.status === "draft";
  const total = qs.reduce((n, q) => n + q.points, 0);
  return (
    <>
      <PageHeader title={pick(a, "title", locale)} description={`${a.duration_minutes} ${t.common.minutes} · ${L("pass", "النجاح")} ${a.passing_score}% · ${total} ${t.common.points}`} actions={<><Badge tone={a.status === "published" ? "positive" : "neutral"}>{a.status}</Badge>{a.ai_generated && <Badge tone="progress">{t.common.aiGenerated}</Badge>}<PublishControls id={a.id} status={a.status as "draft"} /></>} />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title={L("Questions", "الأسئلة")} description={draft ? undefined : L("Published assessments are read-only. Move back to draft to edit.", "التقييمات المنشورة للقراءة فقط. أعدها إلى مسودة للتعديل.")} />
          <CardBody>
            {qs.length === 0 && <p className="text-sm text-subtle">{L("No questions yet.", "لا توجد أسئلة بعد.")}</p>}
            <ol className="flex flex-col gap-3">
              {qs.map((q, i) => (
                <li key={q.id} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold"><span className="ltr-nums text-subtle">{i + 1}.</span> {pick(q, "prompt", locale)}</p>
                    <div className="flex shrink-0 items-center gap-2"><Badge tone="info">{q.type}</Badge><span className="ltr-nums text-xs font-bold">{q.points}</span>
                      {draft && <form action={deleteQuestion.bind(null, a.id, q.id)}><button className="flex size-7 items-center justify-center rounded-full text-subtle hover:bg-danger-soft hover:text-danger" aria-label={t.common.delete}><Trash2 className="size-3.5" /></button></form>}
                    </div>
                  </div>
                  {q.assessment_options.length > 0 && <ul className="mt-2 space-y-1 text-sm">{[...q.assessment_options].sort((x, y) => x.position - y.position).map((o) => <li key={o.id} className="flex items-center gap-2">{o.is_correct ? <CheckCircle2 className="size-4 text-success" /> : <span className="size-4" />}{pick(o, "label", locale)}</li>)}</ul>}
                  {Array.isArray((q.config as { accepted_answers?: string[] })?.accepted_answers) && <p className="mt-2 text-xs text-subtle">{L("Accepted", "المقبول")}: {(q.config as { accepted_answers: string[] }).accepted_answers.join(" | ")}</p>}
                  {q.rubric_id && <p className="mt-2 text-xs text-subtle">{L("Reviewed by a person using the rubric", "يراجعه شخص وفق المعايير")}</p>}
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
        {draft && (
          <div className="flex flex-col gap-6">
            <Card><CardHeader title={L("Add question", "إضافة سؤال")} /><CardBody><QuestionBuilder assessmentId={a.id} /></CardBody></Card>
            <Card><CardHeader title={L("Draft with AI", "صياغة بالذكاء الاصطناعي")} description={L("Suggestions are added to this draft for your review — never published automatically.", "تُضاف الاقتراحات إلى هذه المسودة لمراجعتك — ولا تُنشر تلقائيًا.")} /><CardBody><AIQuestions assessmentId={a.id} /></CardBody></Card>
          </div>
        )}
      </div>
    </>
  );
}
