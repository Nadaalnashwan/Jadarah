"use client";
import { useActionState, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { completeCandidateOnboarding } from "@/features/candidate/actions";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function CandidateOnboardingForm({
  defaults,
  skills,
}: {
  defaults: { full_name: string; headline: string; city: string; summary: string };
  skills: { id: string; name: string; category: string }[];
}) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(completeCandidateOnboarding, null);
  const steps = [L("About you", "عنك"), L("Experience", "الخبرة"), L("Skills", "المهارات")];
  const visible = useMemo(() => skills.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase())).slice(0, 40), [skills, filter]);

  return (
    <form action={action} className="mt-10">
      <ol className="mb-8 flex items-center gap-2" aria-label={L("Progress", "التقدّم")}>
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition", i <= step ? "bg-primary text-white" : "bg-surface-2 text-subtle")} aria-current={i === step ? "step" : undefined}>
              {i < step ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cn("hidden text-sm font-semibold sm:inline", i === step ? "text-foreground" : "text-subtle")}>{s}</span>
            {i < steps.length - 1 && <span className={cn("h-px flex-1 transition-colors", i < step ? "bg-primary" : "bg-border")} />}
          </li>
        ))}
      </ol>
      <div className="surface-card p-6 sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
            <div className={cn("grid gap-4", step !== 0 && "hidden")}>
              <Field label={t.auth.fullName} htmlFor="full_name" required>
                <Input id="full_name" name="full_name" defaultValue={defaults.full_name} required />
              </Field>
              <Field label={L("Professional headline", "العنوان المهني")} htmlFor="headline" hint={L("e.g. Data analyst who turns operations data into decisions", "مثال: محلل بيانات يحوّل بيانات العمليات إلى قرارات")}>
                <Input id="headline" name="headline" defaultValue={defaults.headline} maxLength={140} />
              </Field>
              <Field label={L("City", "المدينة")} htmlFor="city">
                <Input id="city" name="city" defaultValue={defaults.city} maxLength={80} />
              </Field>
            </div>
            <div className={cn("grid gap-4", step !== 1 && "hidden")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={L("Years of experience", "سنوات الخبرة")} htmlFor="years_experience">
                  <Input id="years_experience" name="years_experience" type="number" min={0} max={60} step={0.5} defaultValue={0} />
                </Field>
                <Field label={L("Career level", "المستوى المهني")} htmlFor="experience_level">
                  <Select id="experience_level" name="experience_level" defaultValue="entry">
                    {(["entry", "junior", "mid", "senior", "lead"] as const).map((l) => (
                      <option key={l} value={l}>
                        {t.level[l]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label={L("Professional summary", "الملخص المهني")} htmlFor="summary">
                <Textarea id="summary" name="summary" defaultValue={defaults.summary} maxLength={2000} rows={5} />
              </Field>
              <Field label={L("Career interests (comma separated)", "الاهتمامات المهنية (افصل بفاصلة)")} htmlFor="career_interests">
                <Input id="career_interests" name="career_interests" />
              </Field>
            </div>
            <div className={cn(step !== 2 && "hidden")}>
              <p className="mb-3 text-sm text-muted">
                {L("Pick up to 15 skills. They start as self-declared — add evidence later through your CV or assessments.", "اختر حتى 15 مهارة. تبدأ كتصريح ذاتي — أضف الأدلة لاحقًا عبر سيرتك أو التقييمات.")}
              </p>
              <Input placeholder={t.common.search} value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-4" aria-label={t.common.search} />
              <div className="flex flex-wrap gap-2">
                {visible.map((s) => {
                  const on = picked.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s.id) : p.length < 15 ? [...p, s.id] : p))}
                      className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold transition", on ? "border-primary bg-primary text-white" : "hover:border-primary/50")}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
              {picked.map((id) => (
                <input key={id} type="hidden" name="skills" value={id} />
              ))}
              <p className="ltr-nums mt-3 text-xs text-subtle">{picked.length}/15</p>
            </div>
          </motion.div>
        </AnimatePresence>
        {state && !state.ok && <div className="mt-4"><FormMessage>{state.error}</FormMessage></div>}
        <div className="mt-8 flex justify-between">
          <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            {t.common.back}
          </Button>
          {step < 2 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)}>
              {t.common.next}
            </Button>
          ) : (
            <Button type="submit" loading={pending}>
              {L("Finish and open my workspace", "إنهاء وفتح مساحتي")}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
