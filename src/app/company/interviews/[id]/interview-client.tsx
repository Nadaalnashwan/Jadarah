"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import {
  addInterviewFeedback,
  addInterviewQuestions,
  rescheduleInterview,
  setInterviewStatus,
  submitInterviewEvaluation,
  toggleFeedbackShare,
} from "@/features/company/actions";
import { suggestInterviewQuestions } from "@/services/ai/recruiting";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

function useDone(state: ActionResult | null) {
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      if (state.message) toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);
}

export function EvaluationForm({
  interviewId,
  existing,
  criteria,
}: {
  interviewId: string;
  criteria: { key: string; name_en: string; name_ar: string }[];
  existing: {
    recommendation: string;
    ratings: Record<string, number>;
    strengths: string;
    concerns: string;
    comments: string;
  } | null;
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    submitInterviewEvaluation.bind(null, interviewId),
    null,
  );
  useDone(state);
  const dims = criteria.map((c) => [c.key, locale === "ar" ? c.name_ar : c.name_en] as const);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {dims.map(([k, label]) => (
          <fieldset key={k}>
            <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="cursor-pointer">
                  <input
                    type="radio"
                    name={k}
                    value={n}
                    defaultChecked={existing?.ratings?.[k] === n}
                    required
                    className="peer sr-only"
                  />
                  <span className="ltr-nums peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-ring flex size-9 items-center justify-center rounded-xl border text-sm font-bold transition peer-checked:text-primary-foreground peer-focus-visible:ring-2">
                    {n}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <Field label={L("Recommendation", "التوصية")} htmlFor="recommendation">
        <Select
          id="recommendation"
          name="recommendation"
          defaultValue={existing?.recommendation ?? "neutral"}
        >
          {[
            ["strong_yes", L("Strong yes", "نعم بقوة")],
            ["yes", L("Yes", "نعم")],
            ["neutral", L("Neutral", "محايد")],
            ["no", L("No", "لا")],
            ["strong_no", L("Strong no", "لا بقوة")],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={L("Strengths", "نقاط القوة")} htmlFor="strengths">
        <Textarea id="strengths" name="strengths" rows={2} defaultValue={existing?.strengths} />
      </Field>
      <Field label={L("Concerns", "المخاوف")} htmlFor="concerns">
        <Textarea id="concerns" name="concerns" rows={2} defaultValue={existing?.concerns} />
      </Field>
      <Field label={L("Comments", "تعليقات")} htmlFor="comments">
        <Textarea id="comments" name="comments" rows={2} defaultValue={existing?.comments} />
      </Field>
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" loading={pending}>
        {existing ? L("Update evaluation", "تحديث التقييم") : L("Submit evaluation", "إرسال التقييم")}
      </Button>
    </form>
  );
}

export function FeedbackForm({ interviewId, applicationId }: { interviewId: string; applicationId: string }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    addInterviewFeedback.bind(null, interviewId, applicationId),
    null,
  );
  useDone(state);
  return (
    <form action={action} className="flex flex-col gap-2">
      <Textarea
        name="body"
        rows={2}
        maxLength={3000}
        placeholder={L(
          "Write candidate-facing feedback (private until shared)…",
          "اكتب ملاحظات موجهة للمرشح (خاصة حتى المشاركة)…",
        )}
        aria-label={L("Feedback", "الملاحظات")}
      />
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" size="sm" variant="soft" loading={pending}>
        {L("Add feedback", "إضافة ملاحظات")}
      </Button>
    </form>
  );
}

export function FeedbackShareToggle({
  interviewId,
  feedbackId,
  shared,
}: {
  interviewId: string;
  feedbackId: string;
  shared: boolean;
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2">
      <Checkbox
        checked={shared}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await toggleFeedbackShare(interviewId, feedbackId, e.target.checked);
            router.refresh();
          })
        }
      />
      {L("Shared with candidate", "مُشارَكة مع المرشح")}
    </label>
  );
}

export function InterviewControls({ interviewId, timezone }: { interviewId: string; timezone: string }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, action, rPending] = useActionState<ActionResult | null, FormData>(
    rescheduleInterview.bind(null, interviewId),
    null,
  );
  useDone(state);
  const act = (s: "completed" | "cancelled") =>
    start(async () => {
      const r = await setInterviewStatus(interviewId, s);
      if (r.ok) {
        toast.success(
          s === "completed" ? L("Marked completed", "تم التعليم كمكتملة") : L("Cancelled", "أُلغيت"),
        );
        router.refresh();
      } else toast.error(r.error);
    });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button size="sm" onClick={() => act("completed")} disabled={pending}>
          {L("Mark completed", "تعليم كمكتملة")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => confirm(L("Cancel this interview?", "إلغاء هذه المقابلة؟")) && act("cancelled")}
          disabled={pending}
        >
          {L("Cancel", "إلغاء")}
        </Button>
      </div>
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="timezone" value={timezone} />
        <Field label={L("Reschedule to", "إعادة الجدولة إلى")} htmlFor="re-at">
          <Input id="re-at" name="scheduled_at" type="datetime-local" required />
        </Field>
        {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
        <Button type="submit" size="sm" variant="soft" loading={rPending}>
          {L("Reschedule", "إعادة الجدولة")}
        </Button>
      </form>
    </div>
  );
}

export function QuestionSuggester({ interviewId }: { interviewId: string }) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [suggested, setSuggested] = useState<
    { question: string; kind: "technical" | "behavioral" | "role" | "follow_up"; on: boolean }[] | null
  >(null);
  const [mode, setMode] = useState<"ai" | "rule_based">("rule_based");
  const [custom, setCustom] = useState("");
  return (
    <div className="bg-surface-2/60 flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex gap-2">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={L("Add your own question…", "أضف سؤالك…")}
          aria-label={L("Question", "السؤال")}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!custom.trim()}
          onClick={async () => {
            await addInterviewQuestions(interviewId, [{ question: custom, kind: "role", ai: false }]);
            setCustom("");
            router.refresh();
          }}
        >
          {t.common.add}
        </Button>
      </div>
      <Button
        size="sm"
        variant="soft"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          const r = await suggestInterviewQuestions(interviewId, locale);
          setBusy(false);
          setMode(r.mode);
          setSuggested(r.questions.map((q) => ({ ...q, on: true })));
        }}
      >
        <Sparkles /> {L("Suggest questions", "اقترح أسئلة")}
      </Button>
      {suggested && (
        <div className="flex flex-col gap-2">
          <Badge tone={mode === "ai" ? "progress" : "neutral"}>
            {mode === "ai" ? t.common.aiGenerated : t.common.ruleBased}
          </Badge>
          {suggested.map((q, i) => (
            <label key={i} className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={q.on}
                onChange={(e) =>
                  setSuggested((s) => s!.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))
                }
                className="mt-1"
              />{" "}
              <span>
                {q.question} <span className="text-subtle text-xs">({q.kind})</span>
              </span>
            </label>
          ))}
          <Button
            size="sm"
            onClick={async () => {
              const r = await addInterviewQuestions(
                interviewId,
                suggested
                  .filter((q) => q.on)
                  .map((q) => ({ question: q.question, kind: q.kind, ai: mode === "ai" })),
              );
              if (r.ok) {
                setSuggested(null);
                router.refresh();
              } else toast.error(r.error);
            }}
          >
            {L("Add selected after review", "إضافة المحدد بعد المراجعة")}
          </Button>
        </div>
      )}
    </div>
  );
}
