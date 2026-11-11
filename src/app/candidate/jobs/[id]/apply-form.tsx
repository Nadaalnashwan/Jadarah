"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Select, Textarea } from "@/components/ui/form";
import { applyToJob } from "@/features/candidate/actions";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

export function ApplyForm({
  jobId,
  cvs,
  questions,
  hasTask = false,
}: {
  jobId: string;
  hasTask?: boolean;
  cvs: { id: string; label: string; primary: boolean }[];
  questions: { id: string; text: string; required: boolean }[];
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    applyToJob,
    null,
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="job_id" value={jobId} />
      <Field
        label={L("CV to share", "السيرة الذاتية المرفقة")}
        htmlFor="cv"
        hint={
          cvs.length
            ? undefined
            : L(
                "No CV yet — you can apply without one, or upload first.",
                "لا توجد سيرة بعد — يمكنك التقديم بدونها أو رفعها أولًا.",
              )
        }
      >
        <Select id="cv" name="cv_document_id" defaultValue={cvs.find((c) => c.primary)?.id ?? ""}>
          <option value="">{L("Apply without a CV", "التقديم بدون سيرة ذاتية")}</option>
          {cvs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      {!cvs.length && (
        <Link href="/candidate/cvs" className="text-primary dark:text-lavender text-xs font-semibold">
          {L("Upload a CV", "ارفع سيرة ذاتية")}
        </Link>
      )}
      <Field
        label={L("Cover letter", "خطاب التقديم")}
        htmlFor="cover"
        hint={L("Optional · up to 5000 characters", "اختياري · حتى 5000 حرف")}
      >
        <Textarea id="cover" name="cover_letter" maxLength={5000} rows={5} />
      </Field>
      {questions.map((q) => (
        <Field key={q.id} label={q.text} htmlFor={`q_${q.id}`} required={q.required}>
          <Textarea id={`q_${q.id}`} name={`q_${q.id}`} maxLength={4000} rows={3} required={q.required} />
        </Field>
      ))}
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      {hasTask && (
        <p className="bg-sky-soft text-navy rounded-xl px-3 py-2 text-sm dark:text-sky">
          {L(
            "Next: the practical task opens immediately. Your application is complete once you submit it.",
            "التالي: تُفتح المهمة العملية فورًا، ويكتمل طلبك عند تسليمها.",
          )}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending}>
        <Send className="rtl:-scale-x-100" /> {L("Apply for this job", "تقديم على الوظيفة")}
      </Button>
      <p className="text-subtle text-xs">
        {L(
          "The company sees your profile, the CV you choose and your answers. AI never makes the hiring decision.",
          "ترى الشركة ملفك والسيرة التي تختارها وإجاباتك. الذكاء الاصطناعي لا يتخذ قرار التوظيف.",
        )}
      </p>
    </form>
  );
}
