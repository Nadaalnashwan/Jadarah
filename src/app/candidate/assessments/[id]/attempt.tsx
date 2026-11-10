"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Clock, Cloud, CloudOff, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, Progress } from "@/components/ui/primitives";
import { Input, Textarea } from "@/components/ui/form";
import { saveAnswer, startAttempt, submitAttempt, type Attempt, type AttemptQuestion } from "@/features/assessments/candidate-actions";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function AttemptGate({ assignmentId, started, unavailable, intro }: { assignmentId: string; started: boolean; unavailable: boolean; intro: { title: string; description: string; minutes: number; due: string | null; outcomes: string[] } }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const begin = useCallback(async () => {
    setLoading(true);
    const res = await startAttempt(assignmentId);
    setLoading(false);
    if (res.ok) setAttempt(res.data!);
    else setError(res.error);
  }, [assignmentId]);

  // Resume automatically if the attempt is already running (progress is preserved server-side).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (started) void begin();
  }, [started, begin]);

  if (attempt) return <AttemptWorkspace attempt={attempt} />;
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="overflow-hidden">
        <div className="bg-navy p-8 text-ivory">
          <p className="eyebrow !text-lavender">{L("Practical assessment", "تقييم عملي")}</p>
          <h1 className="editorial mt-3 text-4xl font-extrabold">{intro.title}</h1>
          <p className="mt-3 text-sky/90">{intro.description}</p>
        </div>
        <CardBody className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="info"><Clock className="size-3" /> <span className="ltr-nums">{intro.minutes}</span> {L("minutes", "دقيقة")}</Badge>
            {intro.due && <Badge tone="progress">{L("Due", "الموعد")} {intro.due}</Badge>}
          </div>
          <ul className="list-disc space-y-1 ps-5 text-sm text-muted">{intro.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>
          <ul className="space-y-1 rounded-2xl bg-surface-2 p-4 text-sm">
            <li>• {L("The timer starts when you begin and continues if you leave.", "يبدأ المؤقت عند البدء ويستمر إذا غادرت.")}</li>
            <li>• {L("Every answer is saved automatically.", "تُحفظ كل إجابة تلقائيًا.")}</li>
            <li>• {L("You can submit once. Correct answers appear after submission.", "يمكنك التسليم مرة واحدة. تظهر الإجابات الصحيحة بعد التسليم.")}</li>
          </ul>
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
          {unavailable ? (
            <p className="text-sm text-muted">{L("This assessment is no longer available.", "هذا التقييم لم يعد متاحًا.")}</p>
          ) : (
            <Button size="lg" onClick={begin} loading={loading}>{started ? L("Resume", "متابعة") : L("Begin assessment", "ابدأ التقييم")}</Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

type Draft = { selected: string[]; text: string };
type SaveState = "idle" | "saving" | "saved" | "error";

function AttemptWorkspace({ attempt }: { attempt: Attempt }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const qs = attempt.questions;
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(qs.map((q) => [q.id, { selected: q.answer?.selected_option_ids ?? [], text: q.answer?.text_answer ?? "" }])),
  );
  const [saveState, setSaveState] = useState<Record<string, SaveState>>(() => Object.fromEntries(qs.map((q) => [q.id, q.answer ? "saved" : "idle"])));
  const [remaining, setRemaining] = useState(() => new Date(attempt.ends_at).getTime() - Date.now());
  const [submitting, setSubmitting] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const t = setInterval(() => setRemaining(new Date(attempt.ends_at).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [attempt.ends_at]);

  const persist = useCallback(
    (qid: string, d: Draft, delay: number) => {
      clearTimeout(timers.current[qid]);
      setSaveState((s) => ({ ...s, [qid]: "saving" }));
      timers.current[qid] = setTimeout(async () => {
        const res = await saveAnswer({ assignmentId: attempt.assignment_id, questionId: qid, selected: d.selected, text: d.text || null });
        setSaveState((s) => ({ ...s, [qid]: res.ok ? "saved" : "error" }));
        if (!res.ok) toast.error(res.error);
      }, delay);
    },
    [attempt.assignment_id],
  );

  function update(q: AttemptQuestion, patch: Partial<Draft>, delay = 0) {
    const next = { ...drafts[q.id], ...patch };
    setDrafts((d) => ({ ...d, [q.id]: next }));
    persist(q.id, next, delay);
  }

  const answered = useMemo(() => qs.filter((q) => drafts[q.id].selected.length > 0 || drafts[q.id].text.trim() !== "").length, [qs, drafts]);
  const anySaving = Object.values(saveState).some((s) => s === "saving");
  const q = qs[index];
  const mins = Math.max(0, Math.floor(remaining / 60000));
  const secs = Math.max(0, Math.floor((remaining % 60000) / 1000));
  const lowTime = remaining < 5 * 60000;
  const timeUp = remaining <= 0;

  async function submit() {
    if (!timeUp && answered < qs.length && !confirm(L(`You answered ${answered} of ${qs.length}. Submit anyway?`, `أجبت عن ${answered} من ${qs.length}. هل تريد التسليم؟`))) return;
    setSubmitting(true);
    const res = await submitAttempt(attempt.assignment_id);
    setSubmitting(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(L("Submitted", "تم التسليم"));
    router.refresh();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("textarea, input")) return;
      if (e.key === "ArrowRight") setIndex((i) => (locale === "ar" ? Math.max(0, i - 1) : Math.min(qs.length - 1, i + 1)));
      if (e.key === "ArrowLeft") setIndex((i) => (locale === "ar" ? Math.min(qs.length - 1, i + 1) : Math.max(0, i - 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [qs.length, locale]);

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <Card className={cn("p-5 transition-colors", lowTime && "border-danger/50 bg-danger-soft/40")}>
          <p className="flex items-center gap-2 text-xs font-semibold text-muted"><Clock className="size-4" /> {L("Time remaining", "الوقت المتبقي")}</p>
          <p className={cn("ltr-nums mt-1 text-4xl font-extrabold tabular-nums", lowTime && "text-danger")} aria-live="polite">
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </p>
          <Progress value={(answered / qs.length) * 100} className="mt-4" label={L("Answered", "تمت الإجابة")} />
          <p className="ltr-nums mt-2 text-xs text-subtle">{answered}/{qs.length} {L("answered", "مُجاب")}</p>
        </Card>
        <Card className="p-4">
          <ol className="grid grid-cols-5 gap-2" aria-label={L("Questions", "الأسئلة")}>
            {qs.map((qq, i) => {
              const done = drafts[qq.id].selected.length > 0 || drafts[qq.id].text.trim() !== "";
              return (
                <li key={qq.id}>
                  <button
                    onClick={() => setIndex(i)}
                    aria-current={i === index ? "step" : undefined}
                    className={cn("ltr-nums flex aspect-square w-full items-center justify-center rounded-xl text-sm font-bold transition", i === index ? "bg-primary text-white" : done ? "bg-accent-soft text-primary dark:text-lavender" : "bg-surface-2 text-subtle hover:bg-border")}
                  >
                    {i + 1}
                  </button>
                </li>
              );
            })}
          </ol>
        </Card>
        <Button size="lg" onClick={submit} loading={submitting} disabled={anySaving}>
          <Send className="rtl:-scale-x-100" /> {L("Submit assessment", "تسليم التقييم")}
        </Button>
      </aside>

      <Card>
        <CardBody>
          <div className="mb-4 flex items-center justify-between gap-3">
            <Badge tone="info">
              <span className="ltr-nums">{index + 1}/{qs.length}</span> · <span className="ltr-nums">{q.points}</span> {L("pts", "نقطة")}
            </Badge>
            <SaveIndicator state={saveState[q.id]} />
          </div>
          {timeUp && <p className="mb-4 flex items-center gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger"><AlertTriangle className="size-4" /> {L("Time is up — submit now. Further edits won't be saved.", "انتهى الوقت — سلّم الآن. لن تُحفظ التعديلات اللاحقة.")}</p>}
          <AnimatePresence mode="wait">
            <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }}>
              <h2 className="text-xl font-bold leading-relaxed">{locale === "ar" ? q.prompt_ar : q.prompt_en}</h2>
              <div className="mt-6">
                <QuestionInput q={q} draft={drafts[q.id]} disabled={timeUp} onChange={(patch, delay) => update(q, patch, delay)} />
              </div>
              {q.rubric && (
                <details className="mt-6 rounded-2xl bg-surface-2 p-4 text-sm">
                  <summary className="cursor-pointer font-semibold">{L("How this answer is reviewed", "كيف تُراجع هذه الإجابة")}</summary>
                  <ul className="mt-2 space-y-1 text-muted">
                    {q.rubric.criteria.map((c) => <li key={c.key}>• {locale === "ar" ? c.name_ar : c.name_en} (<span className="ltr-nums">{c.max_points}</span>)</li>)}
                  </ul>
                </details>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="mt-8 flex justify-between">
            <Button variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}><ChevronLeft className="rtl:rotate-180" /> {L("Previous", "السابق")}</Button>
            <Button variant="outline" onClick={() => setIndex((i) => Math.min(qs.length - 1, i + 1))} disabled={index === qs.length - 1}>{L("Next", "التالي")} <ChevronRight className="rtl:rotate-180" /></Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const { locale } = useI18n();
  const L = tx(locale);
  if (state === "saving") return <span className="flex items-center gap-1.5 text-xs text-subtle"><Loader2 className="size-3.5 animate-spin" /> {L("Saving…", "جارٍ الحفظ…")}</span>;
  if (state === "saved") return <span className="flex items-center gap-1.5 text-xs text-success"><Cloud className="size-3.5" /> {L("Saved", "محفوظ")}</span>;
  if (state === "error") return <span className="flex items-center gap-1.5 text-xs text-danger"><CloudOff className="size-3.5" /> {L("Not saved", "لم يُحفظ")}</span>;
  return null;
}

function QuestionInput({ q, draft, disabled, onChange }: { q: AttemptQuestion; draft: Draft; disabled: boolean; onChange: (p: Partial<Draft>, delay?: number) => void }) {
  const { locale } = useI18n();
  const L = tx(locale);
  if (q.type === "multiple_choice" || q.type === "true_false" || q.type === "multiple_select") {
    const multi = q.type === "multiple_select";
    return (
      <div role={multi ? "group" : "radiogroup"} className="flex flex-col gap-2">
        {multi && <p className="text-xs text-subtle">{L("Select all that apply.", "اختر كل ما ينطبق.")}</p>}
        {q.options.map((o, i) => {
          const on = draft.selected.includes(o.id);
          return (
            <motion.button
              key={o.id}
              type="button"
              whileTap={{ scale: 0.985 }}
              role={multi ? "checkbox" : "radio"}
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange({ selected: multi ? (on ? draft.selected.filter((x) => x !== o.id) : [...draft.selected, o.id]) : [o.id] })}
              className={cn("flex items-center gap-3 rounded-2xl border-2 p-4 text-start transition", on ? "border-primary bg-accent-soft" : "border-border hover:border-primary/40")}
            >
              <span className={cn("ltr-nums flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", multi ? "rounded-lg" : "", on ? "bg-primary text-white" : "bg-surface-2 text-subtle")}>
                {on ? <Check className="size-4" /> : String.fromCharCode(65 + i)}
              </span>
              <span className="font-medium">{locale === "ar" ? o.label_ar : o.label_en}</span>
            </motion.button>
          );
        })}
      </div>
    );
  }
  if (q.type === "short_answer") {
    return <Input value={draft.text} disabled={disabled} onChange={(e) => onChange({ text: e.target.value }, 700)} maxLength={500} aria-label={L("Your answer", "إجابتك")} dir="auto" />;
  }
  const code = q.type === "coding" || q.type === "sql";
  const lang = (q.config?.language as string) ?? (q.type === "sql" ? "sql" : undefined);
  return (
    <div>
      {code && <p className="mb-2 font-mono text-xs text-subtle">{lang}</p>}
      <Textarea
        value={draft.text || (code && !draft.text && typeof q.config?.starter === "string" ? (q.config.starter as string) : draft.text)}
        disabled={disabled}
        onChange={(e) => onChange({ text: e.target.value }, 900)}
        onKeyDown={(e) => {
          if (code && e.key === "Tab") {
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart: s, selectionEnd: en } = el;
            const v = el.value.slice(0, s) + "    " + el.value.slice(en);
            onChange({ text: v }, 900);
            requestAnimationFrame(() => (el.selectionStart = el.selectionEnd = s + 4));
          }
        }}
        rows={code ? 14 : 10}
        spellCheck={!code}
        dir={code ? "ltr" : "auto"}
        className={cn(code && "bg-navy font-mono text-[0.82rem] leading-6 text-ivory caret-lavender focus:bg-navy")}
        aria-label={L("Your answer", "إجابتك")}
        maxLength={20000}
      />
      <p className="ltr-nums mt-1 text-end text-xs text-subtle">{draft.text.length}/20000</p>
    </div>
  );
}
