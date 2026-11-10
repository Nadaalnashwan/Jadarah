"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import {
  addQuestion,
  generateQuestionsWithAI,
  setAssessmentStatus,
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

export function AIQuestions({ assessmentId }: { assessmentId: string }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder={L("Topic, e.g. REST API design for juniors", "الموضوع، مثل تصميم واجهات REST للمبتدئين")}
        aria-label={L("Topic", "الموضوع")}
      />
      <Button
        variant="soft"
        loading={busy}
        disabled={!topic.trim()}
        onClick={async () => {
          setBusy(true);
          const r = await generateQuestionsWithAI(assessmentId, topic);
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

export function PublishControls({ id, status }: { id: string; status: "draft" | "published" | "archived" }) {
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
      <Button size="sm" variant="outline" disabled={pending} onClick={() => go("draft")}>
        {L("Back to draft", "إعادة كمسودة")}
      </Button>
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
