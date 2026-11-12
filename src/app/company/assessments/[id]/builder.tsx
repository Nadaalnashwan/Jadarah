"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import {
  addQuestion,
  generateQuestionsWithAI,
  setAssessmentStatus,
  updateRubric,
} from "@/features/assessments/company-actions";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

const TYPES = [
  "multiple_choice",
  "multiple_select",
  "true_false",
  "short_answer",
  "long_answer",
  "coding",
  "sql",
  "case_study",
] as const;

export function QuestionBuilder({ assessmentId }: { assessmentId: string }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<(typeof TYPES)[number]>("multiple_choice");
  const [opts, setOpts] = useState(3);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    addQuestion.bind(null, assessmentId),
    null,
  );
  useEffect(() => {
    if (state?.ok) {
      form.current?.reset();
      router.refresh();
    }
  }, [state, router]);
  const objective = type === "multiple_choice" || type === "multiple_select";
  const label: Record<string, string> = {
    multiple_choice: L("Single choice", "اختيار مفرد"),
    multiple_select: L("Multiple select", "اختيار متعدد"),
    true_false: L("True / false", "صح / خطأ"),
    short_answer: L("Short answer", "إجابة قصيرة"),
    long_answer: L("Long answer", "إجابة مطوّلة"),
    coding: L("Coding", "برمجة"),
    sql: "SQL",
    case_study: L("Case study", "دراسة حالة"),
  };
  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Field label={L("Type", "النوع")} htmlFor="qb-type">
          <Select
            id="qb-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            {TYPES.map((x) => (
              <option key={x} value={x}>
                {label[x]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={L("Points", "النقاط")} htmlFor="qb-pts">
          <Input id="qb-pts" name="points" type="number" min={1} max={100} defaultValue={2} />
        </Field>
      </div>
      <Field label={L("Question (English)", "السؤال (إنجليزي)")} htmlFor="qb-en" required>
        <Textarea id="qb-en" name="prompt_en" rows={2} dir="ltr" required />
      </Field>
      <Field label={L("Question (Arabic)", "السؤال (عربي)")} htmlFor="qb-ar" required>
        <Textarea id="qb-ar" name="prompt_ar" rows={2} dir="rtl" required />
      </Field>
      {objective && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">
            {L("Options — tick the correct answer(s)", "الخيارات — حدّد الإجابة الصحيحة")}
          </legend>
          {Array.from({ length: opts }).map((_, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
              <Checkbox name="opt_correct" value={String(i)} aria-label={L("Correct", "صحيح")} />
              <Input name="opt_en" placeholder={`EN ${i + 1}`} dir="ltr" />
              <Input name="opt_ar" placeholder={`AR ${i + 1}`} dir="rtl" />
            </div>
          ))}
          {opts < 6 && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpts((n) => n + 1)}>
              <Plus /> {L("Option", "خيار")}
            </Button>
          )}
        </fieldset>
      )}
      {type === "true_false" && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="opt_correct" value="0" /> {L("The statement is true", "العبارة صحيحة")}
        </label>
      )}
      {type === "short_answer" && (
        <Field
          label={L(
            "Accepted answers (separate with |) — leave empty for human review",
            "الإجابات المقبولة (افصل بـ |) — اتركه فارغًا للمراجعة البشرية",
          )}
          htmlFor="qb-acc"
        >
          <Input id="qb-acc" name="accepted" />
        </Field>
      )}
      {(type === "coding" || type === "sql") && (
        <Field label={L("Language", "اللغة")} htmlFor="qb-lang">
          <Input
            id="qb-lang"
            name="language"
            defaultValue={type === "sql" ? "postgresql" : "python"}
            dir="ltr"
          />
        </Field>
      )}
      <Field label={L("Explanation shown after submission (EN)", "الشرح بعد التسليم (EN)")} htmlFor="qb-xen">
        <Input id="qb-xen" name="explanation_en" dir="ltr" />
      </Field>
      <Field label={L("Explanation (AR)", "الشرح (AR)")} htmlFor="qb-xar">
        <Input id="qb-xar" name="explanation_ar" dir="rtl" />
      </Field>
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" loading={pending}>
        <Plus /> {L("Add question", "إضافة السؤال")}
      </Button>
    </form>
  );
}

export function AIQuestions({
  assessmentId,
  jobs = [],
}: {
  assessmentId: string;
  jobs?: { id: string; title: string }[];
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {jobs.length > 0 && (
        <Select value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label={L("Base on a job", "بناءً على وظيفة")}>
          <option value="">{L("Base on a job (optional)", "بناءً على وظيفة (اختياري)")}</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </Select>
      )}
      <Input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder={L("Topic, e.g. REST API design for juniors", "الموضوع، مثل تصميم واجهات REST للمبتدئين")}
        aria-label={L("Topic", "الموضوع")}
      />
      <Button
        variant="soft"
        loading={busy}
        disabled={!topic.trim() && !jobId}
        onClick={async () => {
          setBusy(true);
          const r = await generateQuestionsWithAI(assessmentId, topic, jobId || undefined);
          setBusy(false);
          if (r.ok) {
            toast.success(r.message);
            router.refresh();
          } else toast.error(r.error);
        }}
      >
        <Sparkles /> {L("Generate draft questions", "توليد أسئلة مقترحة")}
      </Button>
    </div>
  );
}

/** Shown when the task belongs to a job: where it is attached and the next step back on the job page. */
export function JobContextBanner({
  jobId,
  title,
  attached,
  taskPublished,
  jobPublished,
}: {
  jobId: string;
  title: string;
  attached: boolean;
  taskPublished: boolean;
  jobPublished: boolean;
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const next = !attached
    ? L("Created for this job but not attached to it", "أُنشئت لهذه الوظيفة لكنها غير مرتبطة بها")
    : !taskPublished
      ? L("Review the task, then publish it. The job stays a draft", "راجع المهمة ثم انشرها. تبقى الوظيفة مسودة")
      : jobPublished
        ? L("Applicants receive this task right after applying", "يستلم المتقدمون هذه المهمة فور التقديم")
        : L("Task published. Return to the job to review and publish it", "نُشرت المهمة. عُد إلى الوظيفة لمراجعتها ونشرها");
  return (
    <div className="border-primary/30 bg-accent-soft/40 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3">
      <div className="min-w-0 text-sm">
        <p className="font-semibold">
          {L("Practical task for", "المهمة العملية لوظيفة")}: {title}
        </p>
        <p className="text-muted mt-0.5">{next}</p>
      </div>
      <Button asChild size="sm" variant={taskPublished ? "primary" : "outline"}>
        <Link href={`/company/jobs/${jobId}`}>{L("Back to job", "العودة إلى الوظيفة")}</Link>
      </Button>
    </div>
  );
}

export function PublishControls({
  id,
  status,
  locked = false,
}: {
  id: string;
  status: "draft" | "published" | "archived";
  locked?: boolean;
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (s: "draft" | "published" | "archived") =>
    start(async () => {
      const r = await setAssessmentStatus(id, s);
      if (r.ok) router.refresh();
      else toast.error(r.error);
    });
  return status === "draft" ? (
    <Button size="sm" disabled={pending} onClick={() => go("published")}>
      {L("Publish after review", "نشر بعد المراجعة")}
    </Button>
  ) : status === "published" ? (
    <>
      {!locked && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => go("draft")}>
          {L("Back to draft", "إعادة كمسودة")}
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => go("archived")}>
        {L("Archive", "أرشفة")}
      </Button>
    </>
  ) : (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => go("draft")}>
      {L("Restore", "استعادة")}
    </Button>
  );
}

type Criterion = {
  key: string;
  name_en: string;
  name_ar: string;
  description_en?: string;
  description_ar?: string;
  max_points: number;
};

/** Open-answer rubric: editable on drafts (review AI-generated or default criteria), read-only otherwise. */
export function RubricEditor({
  assessmentId,
  initial,
  editable,
  rubricId,
}: {
  assessmentId: string;
  initial: Criterion[];
  editable: boolean;
  /** A question's own rubric; omitted for the assessment-wide rubric. */
  rubricId?: string;
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [rows, setRows] = useState<Criterion[]>(initial);
  const [pending, start] = useTransition();
  const total = rows.reduce((a, c) => a + (Number(c.max_points) || 0), 0);
  const set = (i: number, patch: Partial<Criterion>) => setRows((r) => r.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  if (!editable)
    return (
      <ul className="divide-y rounded-2xl border text-sm">
        {rows.map((c) => (
          <li key={c.key} className="flex items-start justify-between gap-3 p-3">
            <div>
              <p className="font-semibold">{locale === "ar" ? c.name_ar : c.name_en}</p>
              <p className="text-muted text-xs">{locale === "ar" ? c.description_ar : c.description_en}</p>
            </div>
            <span className="ltr-nums text-subtle text-xs font-bold">/{c.max_points}</span>
          </li>
        ))}
      </ul>
    );
  return (
    <div className="flex flex-col gap-3">
      {rows.map((c, i) => (
        <div key={i} className="grid gap-2 rounded-2xl border p-3 sm:grid-cols-[1fr_1fr_5rem_auto]">
          <Input
            value={c.name_en}
            onChange={(e) =>
              set(i, {
                name_en: e.target.value,
                key: c.key || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || `c${i + 1}`,
              })
            }
            aria-label={L("Criterion (English)", "المعيار (إنجليزي)")}
            placeholder="Criterion"
          />
          <Input
            value={c.name_ar}
            onChange={(e) => set(i, { name_ar: e.target.value })}
            dir="rtl"
            aria-label={L("Criterion (Arabic)", "المعيار (عربي)")}
            placeholder="المعيار"
          />
          <Input
            type="number"
            min={0.5}
            max={10}
            step={0.5}
            value={c.max_points}
            onChange={(e) => set(i, { max_points: Number(e.target.value) })}
            aria-label={L("Max points", "الحد الأقصى")}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
            disabled={rows.length <= 1}
            aria-label={L("Remove criterion", "حذف المعيار")}
          >
            <Trash2 />
          </Button>
          <Textarea
            className="sm:col-span-4"
            rows={1}
            value={(locale === "ar" ? c.description_ar : c.description_en) ?? ""}
            onChange={(e) => set(i, locale === "ar" ? { description_ar: e.target.value } : { description_en: e.target.value })}
            aria-label={L("What a strong answer shows", "ما تُظهره الإجابة القوية")}
            placeholder={L("What a strong answer shows", "ما تُظهره الإجابة القوية")}
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="soft"
          disabled={rows.length >= 8}
          onClick={() => setRows((r) => [...r, { key: `criterion_${r.length + 1}`, name_en: "", name_ar: "", max_points: 3 }])}
        >
          <Plus /> {L("Add criterion", "إضافة معيار")}
        </Button>
        <span className="text-subtle ltr-nums text-xs">
          {L("Total", "المجموع")}: {total}
        </span>
        <Button
          type="button"
          size="sm"
          className="ms-auto"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await updateRubric(assessmentId, rows, rubricId);
              if (r.ok) {
                toast.success(r.message);
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          {L("Save rubric", "حفظ المعايير")}
        </Button>
      </div>
    </div>
  );
}
