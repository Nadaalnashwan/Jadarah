"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { saveInterviewRubric } from "@/features/final-evaluation/actions";
import { DEFAULT_INTERVIEW_RUBRIC, type RubricCriterion } from "@/lib/domain/final-evaluation";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

/** Company-wide structured interview rubric (1–5 per criterion, weighted). */
export function InterviewRubricEditor({ initial }: { initial: RubricCriterion[] }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [rows, setRows] = useState<RubricCriterion[]>(initial);
  const [pending, start] = useTransition();
  const set = (i: number, p: Partial<RubricCriterion>) => setRows((r) => r.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const slug = (v: string, i: number) =>
    v.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || `criterion_${i + 1}`;
  return (
    <div className="flex flex-col gap-3">
      {rows.map((c, i) => (
        <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_6rem_auto]">
          <Input
            value={c.name_en}
            aria-label={L("Criterion (English)", "المعيار (إنجليزي)")}
            onChange={(e) => set(i, { name_en: e.target.value, key: DEFAULT_INTERVIEW_RUBRIC.some((d) => d.key === c.key) ? c.key : slug(e.target.value, i) })}
          />
          <Input value={c.name_ar} dir="rtl" aria-label={L("Criterion (Arabic)", "المعيار (عربي)")} onChange={(e) => set(i, { name_ar: e.target.value })} />
          <Input
            type="number"
            min={0.25}
            max={3}
            step={0.25}
            value={c.weight}
            aria-label={L("Weight", "الوزن")}
            onChange={(e) => set(i, { weight: Number(e.target.value) })}
            className="ltr-nums"
          />
          <Button type="button" size="sm" variant="ghost" disabled={rows.length <= 1} onClick={() => setRows((r) => r.filter((_, j) => j !== i))} aria-label={L("Remove", "حذف")}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="soft" disabled={rows.length >= 12} onClick={() => setRows((r) => [...r, { key: `criterion_${r.length + 1}`, name_en: "", name_ar: "", weight: 1 }])}>
          <Plus /> {L("Add criterion", "إضافة معيار")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setRows(DEFAULT_INTERVIEW_RUBRIC)}>
          <RotateCcw /> {L("Reset to default", "استعادة الافتراضي")}
        </Button>
        <Button
          type="button"
          size="sm"
          className="ms-auto"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await saveInterviewRubric(rows);
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
      <p className="text-subtle text-[11px]">
        {L("Interviewers rate each criterion 1–5. Weights shape the interview score in the final report; earlier evaluations stay readable.", "يقيّم المُقابِلون كل معيار من 1 إلى 5. تحدّد الأوزان درجة المقابلة في التقرير النهائي؛ وتبقى التقييمات السابقة مقروءة.")}
      </p>
    </div>
  );
}
