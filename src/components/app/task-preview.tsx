import { ClipboardCheck, Clock } from "lucide-react";
import { tx, type Locale } from "@/lib/i18n/config";

/** Candidate-safe preview returned by `job_task_preview` — no questions, options, keys or assessor notes. */
export type TaskPreview = {
  title_en: string;
  title_ar: string;
  description_en: string | null;
  description_ar: string | null;
  duration_minutes: number;
  difficulty: string;
  learning_outcomes_en: string[] | null;
  learning_outcomes_ar: string[] | null;
  question_count: number;
  question_types: string[];
};

const TYPE_LABEL: Record<string, [string, string]> = {
  multiple_choice: ["Multiple choice", "اختيار من متعدد"],
  multiple_select: ["Multiple select", "اختيارات متعددة"],
  true_false: ["True / false", "صح أو خطأ"],
  short_answer: ["Short answer", "إجابة قصيرة"],
  long_answer: ["Written answer", "إجابة مكتوبة"],
  coding: ["Coding", "برمجة"],
  sql: ["SQL", "SQL"],
  case_study: ["Case study", "دراسة حالة"],
  file_upload: ["Deliverable", "ملف مُسلَّم"],
};

export function TaskPreviewCard({ task, locale }: { task: TaskPreview; locale: Locale }) {
  const L = tx(locale);
  const title = locale === "ar" ? task.title_ar : task.title_en;
  const desc = locale === "ar" ? task.description_ar : task.description_en;
  const outcomes = (locale === "ar" ? task.learning_outcomes_ar : task.learning_outcomes_en) ?? [];
  return (
    <section className="border-primary/25 rounded-2xl border p-5" aria-labelledby="task-preview-title">
      <p className="text-primary flex items-center gap-2 text-xs font-bold tracking-wide dark:text-lavender">
        <ClipboardCheck className="size-4" /> {L("Practical task", "المهمة العملية")}
      </p>
      <h2 id="task-preview-title" className="mt-1.5 font-bold">
        {title}
      </h2>
      {desc && <p className="text-muted mt-2 line-clamp-4 text-sm leading-relaxed whitespace-pre-line">{desc}</p>}
      <div className="text-subtle ltr-nums mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" /> {task.duration_minutes} {L("min", "دقيقة")}
        </span>
        <span>
          {task.question_count} {L("items", "بنود")}
        </span>
        {task.question_types.map((t) => (
          <span key={t}>{TYPE_LABEL[t] ? L(...TYPE_LABEL[t]) : t}</span>
        ))}
      </div>
      {outcomes.length > 0 && (
        <ul className="text-muted mt-3 list-disc space-y-0.5 ps-5 text-sm">
          {outcomes.slice(0, 4).map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      )}
      <p className="text-subtle mt-3 text-xs">
        {L(
          "Every applicant receives the same task. It opens right after you apply; the timer starts when you begin.",
          "يستلم جميع المتقدمين المهمة نفسها. تُفتح فور التقديم، ويبدأ الوقت عند بدئك.",
        )}
      </p>
    </section>
  );
}
