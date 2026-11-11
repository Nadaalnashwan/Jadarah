"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, CalendarSearch, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import {
  addNote,
  assignAssessment,
  changeStatus,
  evaluateAnswer,
  scheduleInterview,
  shareAssessmentFeedback,
  shortlistForInterview,
} from "@/features/company/actions";
import { getApplicationCvUrl } from "@/features/company/document-actions";
import { suggestRubricScores, type RubricSuggestion } from "@/features/assessments/ai-evaluation-actions";
import { getSchedulingSlots } from "@/features/calendar/actions";
import type { Slot } from "@/lib/domain/calendar";
import type { ApplicationStatus } from "@/lib/domain/application-status";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

function useToastResult(state: ActionResult | null, onOk?: () => void) {
  const router = useRouter();
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      onOk?.();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

export function CvButton({ applicationId, label }: { applicationId: string; label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const r = await getApplicationCvUrl(applicationId);
        setBusy(false);
        if (r.ok) window.open(r.data!.url, "_blank", "noopener");
        else toast.error(r.error);
      }}
    >
      <FileText /> {label}
    </Button>
  );
}

export function StatusForm({
  applicationId,
  targets,
}: {
  applicationId: string;
  targets: ApplicationStatus[];
}) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    changeStatus.bind(null, applicationId),
    null,
  );
  const form = useRef<HTMLFormElement>(null);
  useToastResult(state, () => form.current?.reset());
  if (targets.length === 0)
    return <p className="text-subtle text-sm">{L("This application is closed.", "هذا الطلب مغلق.")}</p>;
  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <Field label={L("Move to", "نقل إلى")} htmlFor="to">
        <Select id="to" name="to" required defaultValue="">
          {
            <option value="" disabled>
              {L("Choose a stage…", "اختر مرحلة…")}
            </option>
          }
          {targets.map((s) => (
            <option key={s} value={s}>
              {t.status[s]}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label={L("Internal reason", "السبب الداخلي")}
        htmlFor="reason"
        hint={L("Recruiters only", "لمسؤولي التوظيف فقط")}
      >
        <Textarea id="reason" name="reason" rows={2} maxLength={1000} />
      </Field>
      <Field
        label={L("Message to the candidate (optional)", "رسالة للمرشح (اختياري)")}
        htmlFor="candidate_message"
        hint={L("Shared with the candidate exactly as written", "تُشارك مع المرشح كما هي")}
      >
        <Textarea id="candidate_message" name="candidate_message" rows={2} maxLength={2000} />
      </Field>
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" loading={pending}>
        {L("Update status", "تحديث الحالة")}
      </Button>
    </form>
  );
}

export function NoteForm({ applicationId }: { applicationId: string }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    addNote.bind(null, applicationId),
    null,
  );
  const form = useRef<HTMLFormElement>(null);
  useToastResult(state, () => form.current?.reset());
  return (
    <form ref={form} action={action} className="flex flex-col gap-2">
      <Textarea
        name="body"
        rows={2}
        maxLength={5000}
        placeholder={L("Add an internal note…", "أضف ملاحظة داخلية…")}
        aria-label={L("Note", "ملاحظة")}
      />
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" size="sm" variant="soft" loading={pending}>
        {L("Save note", "حفظ الملاحظة")}
      </Button>
    </form>
  );
}

export function AssignAssessmentForm({
  applicationId,
  assessments,
  defaultId,
}: {
  applicationId: string;
  assessments: { id: string; name: string }[];
  defaultId: string;
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    assignAssessment.bind(null, applicationId),
    null,
  );
  useToastResult(state);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Select name="assessment_id" defaultValue={defaultId} aria-label={L("Assessment", "التقييم")} required>
        {assessments.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      <Field label={L("Due (optional)", "الموعد النهائي (اختياري)")} htmlFor="due_at">
        <Input id="due_at" name="due_at" type="datetime-local" />
      </Field>
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" size="sm" loading={pending}>
        {L("Assign", "إسناد")}
      </Button>
    </form>
  );
}

export function EvaluateAnswerForm({
  applicationId,
  submissionId,
  questionId,
  max,
  criteria,
  existing,
}: {
  applicationId: string;
  submissionId: string;
  questionId: string;
  max: number;
  criteria: { key: string; name_en: string; name_ar: string; max_points: number }[];
  existing: { points: number; comments: string } | null;
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    evaluateAnswer.bind(null, applicationId, submissionId, questionId),
    null,
  );
  useToastResult(state);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState(existing?.comments ?? "");
  const [ai, setAi] = useState<RubricSuggestion | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  async function askAi() {
    setAiBusy(true);
    const res = await suggestRubricScores(applicationId, submissionId, questionId);
    setAiBusy(false);
    if (!res.ok) return toast.error(res.error);
    const d = res.data!;
    setAi(d);
    setScores(Object.fromEntries(d.criteria.map((c) => [c.key, c.score])));
    if (!comments.trim()) setComments(d.overall_comment);
  }
  const rubricTotal = criteria.reduce((s, c) => s + c.max_points, 0);
  const suggested = rubricTotal
    ? Math.round((Object.values(scores).reduce((a, b) => a + b, 0) / rubricTotal) * max * 10) / 10
    : undefined;
  return (
    <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <Button type="button" size="sm" variant="soft" onClick={askAi} loading={aiBusy}>
          <Sparkles /> {L("Suggest rubric scores with AI", "اقتراح درجات المعايير بالذكاء الاصطناعي")}
        </Button>
        {ai && (
          <span className="bg-accent-soft rounded-full px-2.5 py-1 text-[11px] font-semibold">
            {L("AI suggestion — you decide", "اقتراح آلي — القرار لك")}
          </span>
        )}
      </div>
      {ai?.concerns.length ? (
        <p className="text-warning text-xs sm:col-span-2" role="note">
          {L("AI flagged: ", "ملاحظات الذكاء الاصطناعي: ")}
          {ai.concerns.join(" · ")}
        </p>
      ) : null}
      {criteria.map((c) => (
        <Field
          key={c.key}
          label={`${locale === "ar" ? c.name_ar : c.name_en} (/${c.max_points})`}
          htmlFor={`${questionId}-${c.key}`}
        >
          <Input
            id={`${questionId}-${c.key}`}
            name={`rubric_${c.key}`}
            type="number"
            min={0}
            max={c.max_points}
            step={1}
            value={scores[c.key] ?? ""}
            onChange={(e) => setScores((s) => ({ ...s, [c.key]: Number(e.target.value) }))}
          />
          {(() => {
            const sug = ai?.criteria.find((x) => x.key === c.key);
            return sug ? (
              <p className="text-muted mt-1 text-[11px] leading-snug">
                <Sparkles className="text-primary dark:text-lavender me-1 inline size-3" aria-hidden />
                {sug.rationale}
                {sug.evidence && <span className="text-subtle block truncate">“{sug.evidence}”</span>}
              </p>
            ) : null;
          })()}
        </Field>
      ))}
      <Field
        label={L(`Points awarded (/${max})`, `النقاط الممنوحة (/${max})`)}
        htmlFor={`${questionId}-points`}
        hint={
          suggested !== undefined
            ? L(`Rubric suggests ${suggested}`, `المعايير تقترح ${suggested}`)
            : undefined
        }
      >
        <Input
          id={`${questionId}-points`}
          name="points"
          type="number"
          min={0}
          max={max}
          step={0.5}
          defaultValue={existing?.points}
          required
          key={suggested}
          placeholder={suggested?.toString()}
        />
      </Field>
      <Field
        label={L("Reviewer comments", "تعليق المراجِع")}
        htmlFor={`${questionId}-comments`}
        className="sm:col-span-2"
      >
        <Textarea
          id={`${questionId}-comments`}
          name="comments"
          rows={ai ? 4 : 2}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
      </Field>
      {state && !state.ok && (
        <div className="sm:col-span-2">
          <FormMessage>{state.error}</FormMessage>
        </div>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" variant={existing ? "outline" : "primary"} loading={pending}>
          {existing ? L("Update evaluation", "تحديث التقييم") : L("Save evaluation", "حفظ التقييم")}
        </Button>
      </div>
    </form>
  );
}

export function ShareFeedbackForm({
  applicationId,
  submissionId,
  current,
  shared,
}: {
  applicationId: string;
  submissionId: string;
  current: string;
  shared: boolean;
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    shareAssessmentFeedback.bind(null, applicationId, submissionId),
    null,
  );
  useToastResult(state);
  return (
    <form action={action} className="bg-sky-soft flex flex-col gap-2 rounded-2xl p-4">
      <Field
        label={L("Feedback to share with the candidate", "ملاحظات لمشاركتها مع المرشح")}
        htmlFor={`fb-${submissionId}`}
        hint={shared ? L("Currently shared", "مُشارَكة حاليًا") : L("Not shared yet", "لم تُشارك بعد")}
      >
        <Textarea
          id={`fb-${submissionId}`}
          name="feedback"
          rows={2}
          defaultValue={current}
          maxLength={2000}
        />
      </Field>
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" size="sm" variant="soft" loading={pending}>
        {L("Share feedback", "مشاركة الملاحظات")}
      </Button>
    </form>
  );
}

/** Shortlist (validated transition) and open interview scheduling in the same application context. */
export function ShortlistForInterviewButton({ applicationId, size = "md" }: { applicationId: string; size?: "sm" | "md" }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size={size}
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await shortlistForInterview(applicationId);
          if (!r.ok) return void toast.error(r.error);
          if (r.message) toast.success(r.message);
          router.replace(`/company/applications/${applicationId}?schedule=1#interviews`);
          router.refresh();
        })
      }
    >
      <CalendarPlus /> {L("Shortlist for interview", "ترشيح للمقابلة")}
    </Button>
  );
}

const IV_TYPES: Record<string, [string, string]> = {
  video: ["Video", "مرئية"],
  phone: ["Phone", "هاتفية"],
  onsite: ["On-site", "حضورية"],
  technical: ["Technical", "تقنية"],
  behavioral: ["Behavioral", "سلوكية"],
  panel: ["Panel", "لجنة"],
};

export function InterviewForm({
  applicationId,
  members,
  defaultOpen = false,
  context,
}: {
  applicationId: string;
  members: { id: string; name: string }[];
  defaultOpen?: boolean;
  context?: { candidate: string; job: string };
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [open, setOpen] = useState(defaultOpen);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    scheduleInterview.bind(null, applicationId),
    null,
  );
  const [duration, setDuration] = useState(45);
  const [tz, setTz] = useState("Asia/Riyadh");
  const [at, setAt] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [day, setDay] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [finding, setFinding] = useState(false);
  async function findSlots() {
    if (!day || !picked.length) return toast.error(L("Choose interviewers and a date first.", "اختر المُقابِلين والتاريخ أولًا."));
    setFinding(true);
    const r = await getSchedulingSlots({ date: day, duration, interviewers: picked, timezone: tz });
    setFinding(false);
    if (!r.ok) return toast.error(r.error);
    setSlots(r.data!.slots);
  }
  if (!open)
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        {L("Schedule interview", "جدولة مقابلة")}
      </Button>
    );
  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border p-4">
      {context && (
        <p className="bg-surface-2 rounded-xl px-3 py-2 text-xs">
          <span className="font-semibold">{context.candidate}</span> · {context.job}
        </p>
      )}
      <Field label={L("Title", "العنوان")} htmlFor="iv-title" required>
        <Input id="iv-title" name="title" required defaultValue={L("Technical interview", "مقابلة تقنية")} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{L("Interviewers", "المُقابِلون")}</legend>
        {members.map((m) => (
          <label key={m.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              name="interviewers"
              value={m.id}
              checked={picked.includes(m.id)}
              onChange={(e) => {
                setSlots(null);
                setPicked((p) => (e.target.checked ? [...p, m.id] : p.filter((x) => x !== m.id)));
              }}
            />{" "}
            {m.name}
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label={L("Type", "النوع")} htmlFor="iv-type">
          <Select id="iv-type" name="type" defaultValue="video">
            {Object.entries(IV_TYPES).map(([x, lbl]) => (
              <option key={x} value={x}>
                {L(...lbl)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={L("Duration (min)", "المدة (دقيقة)")} htmlFor="iv-dur">
          <Select
            id="iv-dur"
            name="duration"
            value={duration}
            onChange={(e) => {
              setSlots(null);
              setDuration(Number(e.target.value));
            }}
          >
            {[15, 30, 45, 60, 90, 120].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={L("Time zone", "المنطقة الزمنية")} htmlFor="iv-tz">
          <Select
            id="iv-tz"
            name="timezone"
            value={tz}
            onChange={(e) => {
              setSlots(null);
              setTz(e.target.value);
            }}
          >
            {["Asia/Riyadh", "Asia/Dubai", "Europe/London", "UTC"].map((z) => (
              <option key={z}>{z}</option>
            ))}
          </Select>
        </Field>
        <Field label={L("Find a free slot on", "ابحث عن موعد متاح في")} htmlFor="iv-day">
          <Input
            id="iv-day"
            type="date"
            value={day}
            onChange={(e) => {
              setSlots(null);
              setDay(e.target.value);
            }}
          />
        </Field>
      </div>
      <div className="bg-sky-soft flex flex-col gap-2 rounded-2xl p-3">
        <Button type="button" size="sm" variant="soft" onClick={findSlots} loading={finding} className="self-start">
          <CalendarSearch /> {L("Show free slots for all selected interviewers", "اعرض المواعيد المتاحة لكل المُقابِلين المختارين")}
        </Button>
        {slots && (
          slots.length === 0 ? (
            <p className="text-muted text-sm">{L("No common free slot on this day.", "لا يوجد موعد مشترك متاح في هذا اليوم.")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5" role="listbox" aria-label={L("Free slots", "المواعيد المتاحة")}>
              {slots.map((sl) => {
                const local = `${day}T${sl.label}`;
                return (
                  <button
                    key={sl.startUtc}
                    type="button"
                    role="option"
                    aria-selected={at === local}
                    onClick={() => setAt(local)}
                    className={cn(
                      "ltr-nums rounded-full border px-3 py-1 text-xs font-semibold transition",
                      at === local ? "bg-primary border-primary text-white" : "bg-surface hover:border-primary/60",
                    )}
                  >
                    {sl.label}
                  </button>
                );
              })}
            </div>
          )
        )}
      </div>
      <Field
        label={L("Date & time", "التاريخ والوقت")}
        htmlFor="iv-at"
        required
        hint={L("Double-booking is blocked automatically.", "يُمنع الحجز المزدوج تلقائيًا.")}
      >
        <Input id="iv-at" name="scheduled_at" type="datetime-local" required value={at} onChange={(e) => setAt(e.target.value)} />
      </Field>
      <Field label={L("Meeting link", "رابط الاجتماع")} htmlFor="iv-url">
        <Input id="iv-url" name="meeting_url" type="url" dir="ltr" placeholder="https://" />
      </Field>
      <Field label={L("Location (on-site)", "الموقع (حضوري)")} htmlFor="iv-loc">
        <Input id="iv-loc" name="location" />
      </Field>
      <Field label={L("Instructions for the candidate", "تعليمات للمرشح")} htmlFor="iv-ins">
        <Textarea id="iv-ins" name="instructions" rows={2} />
      </Field>
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>
          {L("Create interview", "إنشاء المقابلة")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {L("Cancel", "إلغاء")}
        </Button>
      </div>
    </form>
  );
}
