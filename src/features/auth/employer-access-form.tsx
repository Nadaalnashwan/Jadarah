"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";
import { employerSignUpAction, submitAccessRequestAction } from "./actions";
import { PasswordInput } from "./forms";

type AuthState = { error?: string; fieldErrors?: Record<string, string> } | null;
type Company = { id: string; name_en: string; name_ar: string };

function CompanyRoleFields({ companies, fe }: { companies: Company[]; fe: Record<string, string> }) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  return (
    <>
      <Field label={L("Organization", "الجهة")} htmlFor="companyId" error={fe.companyId} required>
        <Select id="companyId" name="companyId" required defaultValue="">
          <option value="" disabled>
            {L("Select", "اختر")}
          </option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {locale === "ar" ? c.name_ar : c.name_en}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={L("Job title", "المسمى الوظيفي")} htmlFor="jobTitle" error={fe.jobTitle} required>
          <Input id="jobTitle" name="jobTitle" required maxLength={120} />
        </Field>
        <Field label={L("Requested role", "الدور المطلوب")} htmlFor="role" required>
          <Select id="role" name="role" defaultValue="recruiter">
            <option value="recruiter">{t.roles.recruiter}</option>
            <option value="interviewer">{t.roles.interviewer}</option>
            <option value="company_admin">{t.roles.company_admin}</option>
          </Select>
        </Field>
      </div>
    </>
  );
}

/** New employer account + access request (approved by JADARAH before any workspace access). */
export function EmployerAccessForm({ companies }: { companies: Company[] }) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<AuthState, FormData>(employerSignUpAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <div className="flex flex-col gap-6">
      <h1 className="editorial text-4xl font-extrabold">{L("Employer access", "دخول جهات العمل")}</h1>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <Field label={t.auth.fullName} htmlFor="fullName" error={fe.fullName} required>
          <Input id="fullName" name="fullName" autoComplete="name" required />
        </Field>
        <Field label={L("Work email", "البريد الوظيفي")} htmlFor="email" error={fe.email} required>
          <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" required />
        </Field>
        <CompanyRoleFields companies={companies} fe={fe} />
        <Field label={t.auth.password} htmlFor="password" hint={t.auth.passwordHint} error={fe.password} required>
          <PasswordInput id="password" name="password" autoComplete="new-password" required />
        </Field>
        <Field label={t.auth.confirmPassword} htmlFor="confirmPassword" error={fe.confirmPassword} required>
          <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required />
        </Field>
        <label className="text-muted flex items-start gap-3 text-sm">
          <Checkbox name="consent" required className="mt-1" />
          <span>
            {t.auth.consent}{" "}
            <Link href="/terms" className="text-primary dark:text-lavender font-semibold">
              {t.landing.footerTerms}
            </Link>{" "}
            ·{" "}
            <Link href="/privacy" className="text-primary dark:text-lavender font-semibold">
              {t.landing.footerPrivacy}
            </Link>
          </span>
        </label>
        {state?.error && <FormMessage>{state.error}</FormMessage>}
        <Button type="submit" size="lg" loading={pending}>
          {L("Request access", "طلب الانضمام")}
        </Button>
      </form>
      <p className="text-muted text-center text-sm">
        <Link href="/sign-in" className="text-primary dark:text-lavender font-semibold hover:underline">
          {t.auth.signIn}
        </Link>
      </p>
    </div>
  );
}

/** Signed-in employer account without an approved membership: file a (new) request. */
export function AccessRequestForm({ companies }: { companies: Company[] }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<AuthState, FormData>(submitAccessRequestAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <CompanyRoleFields companies={companies} fe={{}} />
      {state?.error && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" loading={pending}>
        {L("Request access", "طلب الانضمام")}
      </Button>
    </form>
  );
}
