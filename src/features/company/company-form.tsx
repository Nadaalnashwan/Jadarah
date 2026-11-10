"use client";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";
import { registerCompany, updateCompanyProfile } from "./actions";

type Defaults = Partial<
  Record<
    | "name_en"
    | "name_ar"
    | "industry"
    | "website"
    | "size_range"
    | "city"
    | "description_en"
    | "description_ar"
    | "contact_email"
    | "contact_phone",
    string | null
  >
>;

export function CompanyForm({ mode, defaults = {} }: { mode: "register" | "edit"; defaults?: Defaults }) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    mode === "register" ? registerCompany : updateCompanyProfile,
    null,
  );
  useEffect(() => {
    if (state?.ok && state.message) toast.success(state.message);
  }, [state]);
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const d = (k: keyof Defaults) => defaults[k] ?? "";
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field
        label={L("Company name (English)", "اسم الشركة (إنجليزي)")}
        htmlFor="name_en"
        error={fe.name_en}
        required
      >
        <Input id="name_en" name="name_en" defaultValue={d("name_en")} required dir="ltr" />
      </Field>
      <Field
        label={L("Company name (Arabic)", "اسم الشركة (عربي)")}
        htmlFor="name_ar"
        error={fe.name_ar}
        required
      >
        <Input id="name_ar" name="name_ar" defaultValue={d("name_ar")} required dir="rtl" />
      </Field>
      <Field label={L("Industry", "القطاع")} htmlFor="industry" error={fe.industry} required>
        <Input id="industry" name="industry" defaultValue={d("industry")} required />
      </Field>
      <Field label={L("Company size", "حجم الشركة")} htmlFor="size_range" required>
        <Select id="size_range" name="size_range" defaultValue={d("size_range") || "11-50"}>
          {["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </Field>
      <Field label={L("City", "المدينة")} htmlFor="city" error={fe.city} required>
        <Input id="city" name="city" defaultValue={d("city")} required />
      </Field>
      <Field label={L("Website", "الموقع الإلكتروني")} htmlFor="website" error={fe.website}>
        <Input
          id="website"
          name="website"
          type="url"
          defaultValue={d("website")}
          dir="ltr"
          placeholder="https://"
        />
      </Field>
      <Field label={L("Contact email", "بريد التواصل")} htmlFor="contact_email" error={fe.contact_email}>
        <Input
          id="contact_email"
          name="contact_email"
          type="email"
          defaultValue={d("contact_email")}
          dir="ltr"
        />
      </Field>
      <Field label={L("Contact phone", "هاتف التواصل")} htmlFor="contact_phone">
        <Input id="contact_phone" name="contact_phone" defaultValue={d("contact_phone")} dir="ltr" />
      </Field>
      <Field
        label={L("Description (English)", "الوصف (إنجليزي)")}
        htmlFor="description_en"
        className="sm:col-span-2"
      >
        <Textarea
          id="description_en"
          name="description_en"
          defaultValue={d("description_en")}
          dir="ltr"
          rows={3}
        />
      </Field>
      <Field
        label={L("Description (Arabic)", "الوصف (عربي)")}
        htmlFor="description_ar"
        className="sm:col-span-2"
      >
        <Textarea
          id="description_ar"
          name="description_ar"
          defaultValue={d("description_ar")}
          dir="rtl"
          rows={3}
        />
      </Field>
      {state && !state.ok && (
        <div className="sm:col-span-2">
          <FormMessage>{state.error}</FormMessage>
        </div>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" loading={pending}>
          {mode === "register" ? L("Register company", "تسجيل الشركة") : t.common.save}
        </Button>
      </div>
    </form>
  );
}
