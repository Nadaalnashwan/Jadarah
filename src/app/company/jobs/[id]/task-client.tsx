"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookCopy, PenLine, Sparkles, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { createManualTask, createTaskFromTemplate, setJobTask } from "@/features/company/job-task-actions";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

export function DetachTaskButton({ jobId }: { jobId: string }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!confirm(L("Remove the practical task from this job?", "إزالة المهمة العملية من هذه الوظيفة؟"))) return;
          const r = await setJobTask(jobId, null);
          if (r.ok) {
            toast.success(r.message);
            router.refresh();
          } else toast.error(r.error);
        })
      }
    >
      <Unlink /> {L("Remove", "إزالة")}
    </Button>
  );
}

export type TemplateOption = {
  id: string;
  title: string;
  description: string | null;
  minutes: number;
  questions: number;
  own: boolean;
};

/**
 * Three ways to create the job's practical task. One idempotency key per page visit: a double click or a retry
 * after a network error re-uses the draft that was already created.
 */
export function TaskCreationPaths({ jobId, templates }: { jobId: string; templates: TemplateOption[] }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [key] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const run = (id: string, fn: () => Promise<{ ok: boolean; error?: string } | void>) => {
    setBusy(id);
    start(async () => {
      const r = await fn();
      if (r && !r.ok) toast.error(r.error);
      setBusy(null);
    });
  };
  const shown = showAll ? templates : templates.slice(0, 6);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="surface-card flex flex-col gap-3 p-5">
        <span className="bg-accent-soft text-primary grid size-10 place-items-center rounded-xl dark:text-lavender">
          <Sparkles className="size-5" />
        </span>
        <h2 className="font-bold">{L("AI-assisted draft", "مسودة بمساعدة الذكاء الاصطناعي")}</h2>
        <p className="text-muted text-sm">
          {L(
            "Generates a realistic task, deliverables and a rubric from this job. You review and edit everything before publishing.",
            "يولّد مهمة واقعية ومخرجات ومعايير تقييم من بيانات الوظيفة. تراجع كل شيء وتعدّله قبل النشر.",
          )}
        </p>
        <Button asChild className="mt-auto">
          <a href={`/company/assessments/builder?job=${jobId}&attach=1&key=${key}`}>{L("Start with AI", "ابدأ بالمساعدة الذكية")}</a>
        </Button>
      </section>
      <section className="surface-card flex flex-col gap-3 p-5">
        <span className="bg-sky-soft text-navy grid size-10 place-items-center rounded-xl dark:text-sky">
          <PenLine className="size-5" />
        </span>
        <h2 className="font-bold">{L("Create manually", "إنشاء يدوي")}</h2>
        <p className="text-muted text-sm">
          {L(
            "Start from an empty draft prefilled with the job title and description, then add your own items.",
            "ابدأ بمسودة فارغة تحمل مسمى الوظيفة ووصفها، ثم أضف بنودك الخاصة.",
          )}
        </p>
        <Button
          variant="outline"
          className="mt-auto"
          loading={pending && busy === "manual"}
          disabled={pending}
          onClick={() => run("manual", () => createManualTask(jobId, key))}
        >
          {L("Create draft", "إنشاء مسودة")}
        </Button>
      </section>
      <section className="surface-card flex flex-col gap-3 p-5 lg:row-span-2">
        <span className="bg-surface-2 grid size-10 place-items-center rounded-xl">
          <BookCopy className="size-5" />
        </span>
        <h2 className="font-bold">{L("From a template", "من قالب جاهز")}</h2>
        <p className="text-muted text-sm">
          {L(
            "Copy a published task into an editable draft for this job.",
            "انسخ مهمة منشورة إلى مسودة قابلة للتعديل لهذه الوظيفة.",
          )}
        </p>
        {templates.length === 0 ? (
          <p className="text-subtle text-sm">{L("No published templates yet.", "لا توجد قوالب منشورة بعد.")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((t) => (
              <li key={t.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{t.title}</p>
                  {t.own && <Badge tone="info">{L("Yours", "لشركتك")}</Badge>}
                </div>
                <p className="text-subtle ltr-nums mt-0.5 text-xs">
                  {t.questions} {L("items", "بنود")} · {t.minutes} {L("min", "دقيقة")}
                </p>
                <Button
                  size="sm"
                  variant="soft"
                  className="mt-2"
                  loading={pending && busy === t.id}
                  disabled={pending}
                  onClick={() => run(t.id, () => createTaskFromTemplate(jobId, t.id, key))}
                >
                  {L("Use this template", "استخدام هذا القالب")}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {templates.length > 6 && !showAll && (
          <Button size="sm" variant="link" onClick={() => setShowAll(true)}>
            {L(`Show all ${templates.length}`, `عرض الكل (${templates.length})`)}
          </Button>
        )}
      </section>
    </div>
  );
}
