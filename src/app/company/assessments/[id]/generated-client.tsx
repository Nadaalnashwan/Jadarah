"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Download, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { approveAndPublish, editDraft, materialUrl, regenerateSection } from "@/features/assessments/builder-actions";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return {
    pending,
    run: (fn: () => Promise<ActionResult>) =>
      start(async () => {
        const r = await fn();
        if (r.ok) {
          if (r.message) toast.success(r.message);
          router.refresh();
        } else toast.error(r.error);
      }),
  };
}

export function ApproveButton({ id, blocked }: { id: string; blocked: boolean }) {
  const { locale } = useI18n();
  const { pending, run } = useRun();
  return (
    <Button size="sm" loading={pending} variant={blocked ? "outline" : "primary"} onClick={() => run(() => approveAndPublish(id))}>
      <CheckCircle2 /> {tx(locale)("Approve & publish", "اعتماد ونشر")}
    </Button>
  );
}

export function RegenerateButtons({ id }: { id: string }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const { pending, run } = useRun();
  const [which, setWhich] = useState<string | null>(null);
  const sections = [
    ["scenario", L("Scenario", "السيناريو")],
    ["tasks", L("Tasks", "المهام")],
    ["rubric", L("Rubric", "المعايير")],
    ["data", L("Data", "البيانات")],
  ] as const;
  return (
    <div className="flex flex-wrap gap-2">
      {sections.map(([k, label]) => (
        <Button
          key={k}
          size="sm"
          variant="ghost"
          loading={pending && which === k}
          disabled={pending}
          onClick={() => {
            setWhich(k);
            run(() => regenerateSection(id, k));
          }}
        >
          <RefreshCw /> {label}
        </Button>
      ))}
    </div>
  );
}

function EditForm({ id, part, children, onDone }: { id: string; part: string; children: React.ReactNode; onDone: () => void }) {
  const { locale } = useI18n();
  const router = useRouter();
  const [state, action, pending] = useActionState(editDraft.bind(null, id, part), null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      onDone();
      router.refresh();
    }
  }, [state, router, onDone]);
  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      {children}
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" size="sm" loading={pending} className="self-start">
        {tx(locale)("Save", "حفظ")}
      </Button>
    </form>
  );
}

export function ScenarioEditor({ id, d }: { id: string; d: { title_en: string; title_ar: string; scenario_en: string; scenario_ar: string; duration_minutes: number } }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Pencil /> {L("Edit", "تعديل")}
      </Button>
    );
  return (
    <EditForm id={id} part="scenario" onDone={() => setOpen(false)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="title_en" defaultValue={d.title_en} aria-label="Title (English)" dir="ltr" />
        <Input name="title_ar" defaultValue={d.title_ar} aria-label="العنوان" dir="rtl" />
        <Textarea name="scenario_en" rows={6} defaultValue={d.scenario_en} aria-label="Scenario (English)" dir="ltr" />
        <Textarea name="scenario_ar" rows={6} defaultValue={d.scenario_ar} aria-label="السيناريو" dir="rtl" />
      </div>
      <Field label={L("Duration (min)", "المدة (دقيقة)")} htmlFor={`dur-${id}`}>
        <Input id={`dur-${id}`} name="duration_minutes" type="number" min={30} max={480} defaultValue={d.duration_minutes} className="ltr-nums w-32" />
      </Field>
    </EditForm>
  );
}

export function TaskEditor({
  id,
  index,
  t,
}: {
  id: string;
  index: number;
  t: { title_en: string; title_ar: string; instructions_en: string; instructions_ar: string; deliverables: { name: string; format: string; description?: string }[]; time_minutes: number };
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Pencil /> {L("Edit", "تعديل")}
      </Button>
    );
  return (
    <EditForm id={id} part={`task:${index}`} onDone={() => setOpen(false)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="title_en" defaultValue={t.title_en} aria-label="Task title (English)" dir="ltr" />
        <Input name="title_ar" defaultValue={t.title_ar} aria-label="عنوان المهمة" dir="rtl" />
        <Textarea name="instructions_en" rows={6} defaultValue={t.instructions_en} aria-label="Instructions (English)" dir="ltr" />
        <Textarea name="instructions_ar" rows={6} defaultValue={t.instructions_ar} aria-label="التعليمات" dir="rtl" />
      </div>
      <Field label={L("Deliverables — one per line: name (format) — description", "المخرجات — سطر لكل مخرج: الاسم (الصيغة) — الوصف")} htmlFor={`del-${index}`}>
        <Textarea
          id={`del-${index}`}
          name="deliverables"
          rows={3}
          defaultValue={t.deliverables.map((d) => `${d.name} (${d.format})${d.description ? ` — ${d.description}` : ""}`).join("\n")}
        />
      </Field>
      <Field label={L("Time (min)", "الوقت (دقيقة)")} htmlFor={`tm-${index}`}>
        <Input id={`tm-${index}`} name="time_minutes" type="number" min={5} max={300} defaultValue={t.time_minutes} className="ltr-nums w-32" />
      </Field>
    </EditForm>
  );
}

export function MaterialLink({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await materialUrl(id);
          if (r.ok) window.location.assign(r.data!.url);
          else toast.error(r.error);
        })
      }
      className="text-primary inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
    >
      <Download className="size-4" /> {name}
    </button>
  );
}
