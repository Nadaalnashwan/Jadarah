"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ClipboardCheck, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { saveJob } from "@/features/company/actions";
import { draftJobWithAI } from "@/services/ai/recruiting";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

export interface JobFormValues {
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  responsibilities_en: string;
  responsibilities_ar: string;
  qualifications_en: string;
  qualifications_ar: string;
  category_id: string;
  experience_level: string;
  min_years: number;
  city: string;
  work_mode: string;
  employment_type: string;
  salary_min: string;
  salary_max: string;
  salary_visible: boolean;
  education_level: string;
  openings: number;
  deadline: string;
  questions_en: string;
  questions_ar: string;
  skills: { skill_id: string; importance: "required" | "preferred"; min_level: number }[];
}

export function JobEditor({
  jobId,
  initial,
  skills,
  categories,
  hasTask = false,
}: {
  jobId: string | null;
  initial: JobFormValues;
  skills: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  hasTask?: boolean;
}) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [aiState, setAiState] = useState<{ busy: boolean; note: string | null; provider?: string }>({
    busy: false,
    note: null,
  });
  const [state, action, pending] = useActionState<ActionResult<{ id: string; next?: "task" }> | null, FormData>(
    saveJob.bind(null, jobId),
    null,
  );
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      if (state.data?.next === "task" && state.data.id) router.push(`/company/jobs/${state.data.id}/task`);
      else if (!jobId && state.data?.id) router.replace(`/company/jobs/${state.data.id}`);
      else router.refresh();
    }
  }, [state, jobId, router]);
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const set = <K extends keyof JobFormValues>(k: K, val: JobFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  async function aiDraft() {
    if (!v.title_en.trim())
      return setAiState({
        busy: false,
        note: L("Enter the English title first", "أدخل المسمى الإنجليزي أولًا"),
      });
    setAiState({ busy: true, note: null });
    const r = await draftJobWithAI(v.title_en, v.experience_level);
    if (!r.ok)
      return setAiState({
        busy: false,
        note:
          r.reason === "not_configured"
            ? L(
                "No AI provider is configured on this platform. Write the post manually",
                "لم يُضبط مزوّد ذكاء اصطناعي على المنصة. اكتب الإعلان يدويًا",
              )
            : L(
                "The AI provider did not return a usable draft. Try again or write it manually",
                "لم يُرجع مزوّد الذكاء الاصطناعي مسودة صالحة. حاول مجددًا أو اكتبها يدويًا",
              ),
      });
    const d = r.draft;
    setV((p) => ({
      ...p,
      description_en: d.description_en,
      description_ar: d.description_ar,
      responsibilities_en: d.responsibilities_en.join("\n"),
      responsibilities_ar: d.responsibilities_ar.join("\n"),
      qualifications_en: d.qualifications_en.join("\n"),
      qualifications_ar: d.qualifications_ar.join("\n"),
      skills: d.skill_ids.length ? d.skill_ids : p.skills,
    }));
    setAiState({
      busy: false,
      note: L(
        "AI draft inserted. Review and edit everything before saving or publishing",
        "أُدرجت مسودة الذكاء الاصطناعي. راجع كل شيء وعدّله قبل الحفظ أو النشر",
      ),
      provider: d.provider,
    });
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="ai_assisted" value={aiState.provider ? "true" : "false"} />
      <section className="surface-card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="flex items-center gap-2 font-bold sm:col-span-2">
          <span className="bg-tone-blue text-primary-ink ltr-nums grid size-6 place-items-center rounded-full text-xs">1</span>
          {L("Role and description", "المسمى والوصف")}
        </h2>
        <Field
          label={L("Title (English)", "المسمى (إنجليزي)")}
          htmlFor="title_en"
          error={fe.title_en}
          required
        >
          <Input
            id="title_en"
            name="title_en"
            value={v.title_en}
            onChange={(e) => set("title_en", e.target.value)}
            dir="ltr"
            required
          />
        </Field>
        <Field label={L("Title (Arabic)", "المسمى (عربي)")} htmlFor="title_ar" error={fe.title_ar} required>
          <Input
            id="title_ar"
            name="title_ar"
            value={v.title_ar}
            onChange={(e) => set("title_ar", e.target.value)}
            dir="rtl"
            required
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="button" variant="soft" size="sm" onClick={aiDraft} loading={aiState.busy}>
            <Sparkles /> {L("Draft with AI", "صياغة بالذكاء الاصطناعي")}
          </Button>
          {aiState.provider && (
            <Badge tone="progress">
              {t.common.aiGenerated}
            </Badge>
          )}
          <AnimatePresence>
            {aiState.note && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted text-xs">
                {aiState.note}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <Field label={L("Description (English)", "الوصف (إنجليزي)")} htmlFor="description_en">
          <Textarea
            id="description_en"
            name="description_en"
            value={v.description_en}
            onChange={(e) => set("description_en", e.target.value)}
            dir="ltr"
            rows={4}
          />
        </Field>
        <Field label={L("Description (Arabic)", "الوصف (عربي)")} htmlFor="description_ar">
          <Textarea
            id="description_ar"
            name="description_ar"
            value={v.description_ar}
            onChange={(e) => set("description_ar", e.target.value)}
            dir="rtl"
            rows={4}
          />
        </Field>
      </section>

      <section className="surface-card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="flex items-center gap-2 font-bold sm:col-span-2">
          <span className="bg-tone-blue text-primary-ink ltr-nums grid size-6 place-items-center rounded-full text-xs">2</span>
          {L("Responsibilities and qualifications", "المسؤوليات والمؤهلات")}
        </h2>
        <Field
          label={L("Responsibilities (EN, one per line)", "المسؤوليات (EN، سطر لكل بند)")}
          htmlFor="responsibilities_en"
        >
          <Textarea
            id="responsibilities_en"
            name="responsibilities_en"
            value={v.responsibilities_en}
            onChange={(e) => set("responsibilities_en", e.target.value)}
            dir="ltr"
            rows={4}
          />
        </Field>
        <Field
          label={L("Responsibilities (AR, one per line)", "المسؤوليات (AR، سطر لكل بند)")}
          htmlFor="responsibilities_ar"
        >
          <Textarea
            id="responsibilities_ar"
            name="responsibilities_ar"
            value={v.responsibilities_ar}
            onChange={(e) => set("responsibilities_ar", e.target.value)}
            dir="rtl"
            rows={4}
          />
        </Field>
        <Field label={L("Qualifications (EN)", "المؤهلات (EN)")} htmlFor="qualifications_en">
          <Textarea
            id="qualifications_en"
            name="qualifications_en"
            value={v.qualifications_en}
            onChange={(e) => set("qualifications_en", e.target.value)}
            dir="ltr"
            rows={3}
          />
        </Field>
        <Field label={L("Qualifications (AR)", "المؤهلات (AR)")} htmlFor="qualifications_ar">
          <Textarea
            id="qualifications_ar"
            name="qualifications_ar"
            value={v.qualifications_ar}
            onChange={(e) => set("qualifications_ar", e.target.value)}
            dir="rtl"
            rows={3}
          />
        </Field>
      </section>

      <section className="surface-card grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <h2 className="flex items-center gap-2 font-bold sm:col-span-2 lg:col-span-4">
          <span className="bg-tone-blue text-primary-ink ltr-nums grid size-6 place-items-center rounded-full text-xs">3</span>
          {L("Seniority and constraints", "الأقدمية والقيود")}
        </h2>
        <Field label={L("Field", "المجال")} htmlFor="category_id">
          <Select
            id="category_id"
            name="category_id"
            value={v.category_id}
            onChange={(e) => set("category_id", e.target.value)}
          >
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={L("Level", "المستوى")} htmlFor="experience_level">
          <Select
            id="experience_level"
            name="experience_level"
            value={v.experience_level}
            onChange={(e) => set("experience_level", e.target.value)}
          >
            {(["entry", "junior", "mid", "senior", "lead"] as const).map((l) => (
              <option key={l} value={l}>
                {t.level[l]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={L("Minimum years", "أدنى سنوات خبرة")} htmlFor="min_years">
          <Input
            id="min_years"
            name="min_years"
            type="number"
            min={0}
            max={40}
            value={v.min_years}
            onChange={(e) => set("min_years", Number(e.target.value))}
          />
        </Field>
        <Field label={L("Openings", "عدد الشواغر")} htmlFor="openings">
          <Input
            id="openings"
            name="openings"
            type="number"
            min={1}
            max={500}
            value={v.openings}
            onChange={(e) => set("openings", Number(e.target.value))}
          />
        </Field>
        <Field label={L("City", "المدينة")} htmlFor="city" error={fe.city} required>
          <Input
            id="city"
            name="city"
            value={v.city}
            onChange={(e) => set("city", e.target.value)}
            required
          />
        </Field>
        <Field label={L("Work mode", "نمط العمل")} htmlFor="work_mode">
          <Select
            id="work_mode"
            name="work_mode"
            value={v.work_mode}
            onChange={(e) => set("work_mode", e.target.value)}
          >
            {(["onsite", "hybrid", "remote"] as const).map((m) => (
              <option key={m} value={m}>
                {t.workMode[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={L("Employment type", "نوع التوظيف")} htmlFor="employment_type">
          <Select
            id="employment_type"
            name="employment_type"
            value={v.employment_type}
            onChange={(e) => set("employment_type", e.target.value)}
          >
            {(["full_time", "part_time", "contract", "internship", "temporary"] as const).map((m) => (
              <option key={m} value={m}>
                {t.employmentType[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={L("Deadline", "الموعد النهائي")} htmlFor="deadline">
          <Input
            id="deadline"
            name="deadline"
            type="date"
            value={v.deadline}
            onChange={(e) => set("deadline", e.target.value)}
          />
        </Field>
        <Field label={L("Salary min (SAR)", "أدنى راتب (ر.س)")} htmlFor="salary_min">
          <Input
            id="salary_min"
            name="salary_min"
            type="number"
            min={0}
            value={v.salary_min}
            onChange={(e) => set("salary_min", e.target.value)}
          />
        </Field>
        <Field label={L("Salary max (SAR)", "أعلى راتب (ر.س)")} htmlFor="salary_max" error={fe.salary_max}>
          <Input
            id="salary_max"
            name="salary_max"
            type="number"
            min={0}
            value={v.salary_max}
            onChange={(e) => set("salary_max", e.target.value)}
          />
        </Field>
        <Field label={L("Education", "التعليم")} htmlFor="education_level">
          <Input
            id="education_level"
            name="education_level"
            value={v.education_level}
            onChange={(e) => set("education_level", e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <Checkbox
            name="salary_visible"
            checked={v.salary_visible}
            onChange={(e) => set("salary_visible", e.target.checked)}
          />{" "}
          {L("Show salary range to candidates", "إظهار نطاق الراتب للمرشحين")}
        </label>
      </section>

      <section className="surface-card p-6">
        <h2 className="flex items-center gap-2 font-bold ">
          <span className="bg-tone-blue text-primary-ink ltr-nums grid size-6 place-items-center rounded-full text-xs">4</span>
          {L("Skills — required and preferred", "المهارات — المطلوبة والمفضّلة")}
        </h2>
        <p className="text-muted mt-1 text-sm">
          {L(
            "These drive explainable matching. Required skills weigh twice as much as preferred",
            "تقود هذه المطابقة القابلة للتفسير. المهارات المطلوبة ضعف وزن المفضّلة",
          )}
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {v.skills.map((sk, i) => (
            <li key={i} className="grid grid-cols-[1fr_8rem_6rem_auto] items-center gap-2">
              <Select
                aria-label={L("Skill", "المهارة")}
                value={sk.skill_id}
                onChange={(e) =>
                  set(
                    "skills",
                    v.skills.map((x, j) => (j === i ? { ...x, skill_id: e.target.value } : x)),
                  )
                }
              >
                <option value="">—</option>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={L("Importance", "الأهمية")}
                value={sk.importance}
                onChange={(e) =>
                  set(
                    "skills",
                    v.skills.map((x, j) =>
                      j === i ? { ...x, importance: e.target.value as "required" } : x,
                    ),
                  )
                }
              >
                <option value="required">{L("Required", "مطلوبة")}</option>
                <option value="preferred">{L("Preferred", "مفضّلة")}</option>
              </Select>
              <Select
                aria-label={L("Minimum level", "أدنى مستوى")}
                value={String(sk.min_level)}
                onChange={(e) =>
                  set(
                    "skills",
                    v.skills.map((x, j) => (j === i ? { ...x, min_level: Number(e.target.value) } : x)),
                  )
                }
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </Select>
              <button
                type="button"
                onClick={() =>
                  set(
                    "skills",
                    v.skills.filter((_, j) => j !== i),
                  )
                }
                className="text-subtle hover:bg-danger-soft hover:text-danger flex size-9 items-center justify-center rounded-full"
                aria-label={t.common.remove}
              >
                <Trash2 className="size-4" />
              </button>
              {sk.skill_id && (
                <input type="hidden" name="skill" value={`${sk.skill_id}:${sk.importance}:${sk.min_level}`} />
              )}
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="soft"
          size="sm"
          className="mt-3"
          onClick={() => set("skills", [...v.skills, { skill_id: "", importance: "required", min_level: 3 }])}
        >
          <Plus /> {L("Add skill", "إضافة مهارة")}
        </Button>
      </section>

      <section className="surface-card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="flex items-center gap-2 font-bold sm:col-span-2">
          <span className="bg-tone-blue text-primary-ink ltr-nums grid size-6 place-items-center rounded-full text-xs">5</span>
          {L("Application questions (optional)", "أسئلة التقديم (اختيارية)")}
        </h2>
        <Field
          label={L("Application questions (EN, one per line)", "أسئلة التقديم (EN، سطر لكل سؤال)")}
          htmlFor="questions_en"
        >
          <Textarea
            id="questions_en"
            name="questions_en"
            value={v.questions_en}
            onChange={(e) => set("questions_en", e.target.value)}
            dir="ltr"
            rows={3}
          />
        </Field>
        <Field label={L("Application questions (AR)", "أسئلة التقديم (AR)")} htmlFor="questions_ar">
          <Textarea
            id="questions_ar"
            name="questions_ar"
            value={v.questions_ar}
            onChange={(e) => set("questions_ar", e.target.value)}
            dir="rtl"
            rows={3}
          />
        </Field>
      </section>
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" loading={pending} variant={hasTask ? "primary" : "outline"}>
          {jobId ? L("Save changes", "حفظ التغييرات") : L("Save as draft", "حفظ كمسودة")}
        </Button>
        {!hasTask && (
          <Button type="submit" size="lg" name="intent" value="task" loading={pending}>
            <ClipboardCheck /> {L("Save & create practical task", "حفظ وإنشاء مهمة عملية")}
          </Button>
        )}
        <p className="text-subtle text-xs">
          {L("Saving never publishes the job", "الحفظ لا ينشر الوظيفة")}
        </p>
      </div>
    </form>
  );
}
