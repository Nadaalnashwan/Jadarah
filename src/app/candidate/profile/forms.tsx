"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { addProfileItem, saveCandidateProfile, type SectionTable } from "@/features/candidate/actions";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

type Defaults = { full_name: string; phone: string; headline: string; summary: string; city: string; years_experience: number; experience_level: string; career_interests: string; languages: string; linkedin_url: string; portfolio_url: string; visibility: string };

export function ProfileForm({ defaults }: { defaults: Defaults }) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveCandidateProfile, null);
  useEffect(() => {
    if (state?.ok) toast.success(state.message);
  }, [state]);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label={t.auth.fullName} htmlFor="full_name" error={fe.full_name} required><Input id="full_name" name="full_name" defaultValue={defaults.full_name} required /></Field>
      <Field label={L("Phone", "الجوال")} htmlFor="phone"><Input id="phone" name="phone" defaultValue={defaults.phone} dir="ltr" /></Field>
      <Field label={L("Headline", "العنوان المهني")} htmlFor="headline" className="sm:col-span-2"><Input id="headline" name="headline" defaultValue={defaults.headline} maxLength={140} /></Field>
      <Field label={L("Summary", "الملخص")} htmlFor="summary" className="sm:col-span-2"><Textarea id="summary" name="summary" defaultValue={defaults.summary} rows={5} maxLength={2000} /></Field>
      <Field label={L("City", "المدينة")} htmlFor="city"><Input id="city" name="city" defaultValue={defaults.city} /></Field>
      <Field label={L("Years of experience", "سنوات الخبرة")} htmlFor="years_experience" error={fe.years_experience}><Input id="years_experience" name="years_experience" type="number" min={0} max={60} step={0.5} defaultValue={defaults.years_experience} /></Field>
      <Field label={L("Career level", "المستوى المهني")} htmlFor="experience_level">
        <Select id="experience_level" name="experience_level" defaultValue={defaults.experience_level}>{(["entry", "junior", "mid", "senior", "lead"] as const).map((l) => <option key={l} value={l}>{t.level[l]}</option>)}</Select>
      </Field>
      <Field label={L("Who can discover your profile", "من يمكنه اكتشاف ملفك")} htmlFor="visibility">
        <Select id="visibility" name="visibility" defaultValue={defaults.visibility}>
          <option value="companies">{L("Approved companies (talent pool)", "الشركات المعتمدة (مجمّع المواهب)")}</option>
          <option value="private">{L("Only companies I apply to", "فقط الشركات التي أتقدّم إليها")}</option>
        </Select>
      </Field>
      <Field label={L("Languages (comma separated)", "اللغات (افصل بفاصلة)")} htmlFor="languages"><Input id="languages" name="languages" defaultValue={defaults.languages} /></Field>
      <Field label={L("Career interests", "الاهتمامات المهنية")} htmlFor="career_interests"><Input id="career_interests" name="career_interests" defaultValue={defaults.career_interests} /></Field>
      <Field label="LinkedIn" htmlFor="linkedin_url" error={fe.linkedin_url}><Input id="linkedin_url" name="linkedin_url" type="url" defaultValue={defaults.linkedin_url} dir="ltr" /></Field>
      <Field label={L("Portfolio", "معرض الأعمال")} htmlFor="portfolio_url" error={fe.portfolio_url}><Input id="portfolio_url" name="portfolio_url" type="url" defaultValue={defaults.portfolio_url} dir="ltr" /></Field>
      {state && !state.ok && <div className="sm:col-span-2"><FormMessage>{state.error}</FormMessage></div>}
      <div className="sm:col-span-2"><Button type="submit" loading={pending}>{t.common.save}</Button></div>
    </form>
  );
}

type FieldDef = { name: string; label: string; required?: boolean; type?: "text" | "date" | "url" | "textarea" | "checkbox" };

export function AddItemForm({ table, fields }: { table: SectionTable; fields: FieldDef[] }) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addProfileItem.bind(null, table), null);
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      toast.success(t.common.saved);
    }
  }, [state, t.common.saved]);
  return (
    <div>
      {!open && <Button variant="soft" size="sm" onClick={() => setOpen(true)}><Plus /> {t.common.add}</Button>}
      <AnimatePresence>
        {open && (
          <motion.form ref={formRef} action={action} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="grid gap-3 overflow-hidden rounded-2xl bg-surface-2/60 p-4 sm:grid-cols-2">
            {fields.map((f) =>
              f.type === "checkbox" ? (
                <label key={f.name} className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox name={f.name} /> {f.label}</label>
              ) : (
                <Field key={f.name} label={f.label} htmlFor={`${table}-${f.name}`} required={f.required} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                  {f.type === "textarea" ? <Textarea id={`${table}-${f.name}`} name={f.name} rows={3} /> : <Input id={`${table}-${f.name}`} name={f.name} type={f.type ?? "text"} required={f.required} dir={f.type === "url" ? "ltr" : undefined} />}
                </Field>
              ),
            )}
            {state && !state.ok && <div className="sm:col-span-2"><FormMessage>{state.error}</FormMessage></div>}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" loading={pending}>{t.common.save}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>{L("Cancel", "إلغاء")}</Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
