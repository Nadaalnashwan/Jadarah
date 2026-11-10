"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/form";
import { createAssessment } from "@/features/assessments/company-actions";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

export function NewAssessmentForm() {
  const { locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createAssessment, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label={L("Title (English)", "العنوان (إنجليزي)")} htmlFor="na-en" required><Input id="na-en" name="title_en" required dir="ltr" /></Field>
      <Field label={L("Title (Arabic)", "العنوان (عربي)")} htmlFor="na-ar" required><Input id="na-ar" name="title_ar" required dir="rtl" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={L("Minutes", "الدقائق")} htmlFor="na-min"><Input id="na-min" name="duration_minutes" type="number" min={5} max={480} defaultValue={30} /></Field>
        <Field label={L("Pass %", "نسبة النجاح")} htmlFor="na-pass"><Input id="na-pass" name="passing_score" type="number" min={0} max={100} defaultValue={60} /></Field>
      </div>
      <Field label={L("Difficulty", "الصعوبة")} htmlFor="na-diff"><Select id="na-diff" name="difficulty" defaultValue="intermediate"><option value="beginner">{L("Beginner", "مبتدئ")}</option><option value="intermediate">{L("Intermediate", "متوسط")}</option><option value="advanced">{L("Advanced", "متقدم")}</option></Select></Field>
      <Field label={L("Category", "الفئة")} htmlFor="na-cat"><Input id="na-cat" name="category" defaultValue="technical" /></Field>
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" loading={pending}>{L("Create draft", "إنشاء مسودة")}</Button>
    </form>
  );
}
