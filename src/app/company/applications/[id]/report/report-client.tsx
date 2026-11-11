"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Gavel, MessageSquarePlus, Printer, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/form";
import {
  addFinalComment,
  decideFinal,
  generateFinalAiReport,
  saveFinalSummary,
  shareFinalFeedback,
} from "@/features/final-evaluation/actions";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (r.message) toast.success(r.message);
        after?.();
        router.refresh();
      } else toast.error(r.error);
    });
  return { pending, run };
}

/** Animated overall score ring (brand royal blue on navy). */
export function ScoreRing({ score, size = 148 }: { score: number | null; size?: number }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const pct = score === null ? 0 : score / 100;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(169,184,255,0.22)" strokeWidth={12} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#3B6CFF"
          strokeWidth={12}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="ltr-nums text-4xl font-extrabold">{score ?? "—"}</span>
        <span className="text-lavender text-[11px] font-semibold">/100</span>
      </div>
    </div>
  );
}

export function PrintButton() {
  const { locale } = useI18n();
  return (
    <Button type="button" size="sm" variant="ghost" onClick={() => window.print()} className="print:hidden">
      <Printer /> {tx(locale)("Print / PDF", "طباعة / PDF")}
    </Button>
  );
}

export function GenerateAiButton({ applicationId, regenerate }: { applicationId: string; regenerate: boolean }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const { pending, run } = useRun();
  return (
    <Button
      type="button"
      size="sm"
      variant={regenerate ? "ghost" : "primary"}
      loading={pending}
      onClick={() => run(() => generateFinalAiReport(applicationId))}
      className="print:hidden"
    >
      <Sparkles /> {regenerate ? L("Regenerate AI analysis", "إعادة التحليل الآلي") : L("Generate AI-assisted analysis", "إنشاء تحليل بمساعدة الذكاء الاصطناعي")}
    </Button>
  );
}

export function SummaryEditor({ applicationId, initial, locked }: { applicationId: string; initial: string; locked: boolean }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [text, setText] = useState(initial);
  const { pending, run } = useRun();
  if (locked) return <p className="leading-relaxed whitespace-pre-line">{initial || "—"}</p>;
  return (
    <div className="flex flex-col gap-2">
      <Textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={L("Panel summary", "خلاصة اللجنة")}
        placeholder={L("The panel's own conclusion, in your words…", "خلاصة اللجنة بكلماتكم…")}
      />
      <Button size="sm" variant="soft" className="self-end" loading={pending} onClick={() => run(() => saveFinalSummary(applicationId, text))}>
        {L("Save summary", "حفظ الخلاصة")}
      </Button>
    </div>
  );
}

export function CommentBox({ applicationId }: { applicationId: string }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [text, setText] = useState("");
  const { pending, run } = useRun();
  return (
    <div className="flex items-end gap-2 print:hidden">
      <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} aria-label={L("Reviewer comment", "تعليق المراجِع")} />
      <Button size="sm" variant="soft" loading={pending} disabled={!text.trim()} onClick={() => run(() => addFinalComment(applicationId, text), () => setText(""))}>
        <MessageSquarePlus /> {L("Add", "إضافة")}
      </Button>
    </div>
  );
}

export function DecisionPanel({ applicationId, canHireDirectly }: { applicationId: string; canHireDirectly: boolean }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [decision, setDecision] = useState<"hire" | "reject" | "hold">("hold");
  const [rationale, setRationale] = useState("");
  const [message, setMessage] = useState("");
  const { pending, run } = useRun();
  return (
    <div className="flex flex-col gap-3 print:hidden">
      <Field label={L("Decision", "القرار")} htmlFor="fe-decision">
        <Select id="fe-decision" value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
          <option value="hire">{L("Hire", "توظيف")}</option>
          <option value="hold">{L("Hold — keep in consideration", "تعليق — إبقاء قيد الدراسة")}</option>
          <option value="reject">{L("Do not proceed", "عدم المتابعة")}</option>
        </Select>
      </Field>
      {decision === "hire" && canHireDirectly && (
        <p className="text-muted text-xs">
          {L("Hiring is allowed at any open stage, even without prior shortlisting.", "يُسمح بالتوظيف في أي مرحلة مفتوحة حتى دون إدراج مسبق في القائمة المختصرة.")}
        </p>
      )}
      <Field label={L("Rationale (internal)", "المبرر (داخلي)")} htmlFor="fe-rationale" required>
        <Textarea id="fe-rationale" rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)} />
      </Field>
      {decision !== "hold" && (
        <Field label={L("Message to the candidate (optional)", "رسالة للمرشح (اختياري)")} htmlFor="fe-msg">
          <Textarea id="fe-msg" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
      )}
      <Button
        loading={pending}
        disabled={rationale.trim().length < 10}
        onClick={() => run(() => decideFinal(applicationId, { decision, rationale, candidate_message: message }))}
      >
        <Gavel /> {L("Record decision & finalize", "تسجيل القرار واعتماد التقييم")}
      </Button>
      <p className="text-subtle text-[11px]">
        {L("Finalizing locks this report. The decision is yours — AI never decides.", "الاعتماد يقفل هذا التقرير. القرار لكم — ولا يتخذه الذكاء الاصطناعي.")}
      </p>
    </div>
  );
}

export function ShareFeedback({ applicationId, shared }: { applicationId: string; shared: string | null }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [text, setText] = useState(shared ?? "");
  const { pending, run } = useRun();
  return (
    <div className="flex flex-col gap-2 print:hidden">
      <Textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={L("Feedback for the candidate", "ملاحظات للمرشح")}
        placeholder={L("Only what you write here is shared — internal scores and notes stay private.", "يُشارك ما تكتبه هنا فقط — تبقى الدرجات والملاحظات الداخلية خاصة.")}
      />
      <Button size="sm" variant="soft" className="self-end" loading={pending} disabled={text.trim().length < 10} onClick={() => run(() => shareFinalFeedback(applicationId, text))}>
        <Send /> {shared ? L("Update shared feedback", "تحديث الملاحظات المشتركة") : L("Share with candidate", "مشاركة مع المرشح")}
      </Button>
    </div>
  );
}
