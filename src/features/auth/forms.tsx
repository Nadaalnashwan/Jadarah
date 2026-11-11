"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n/client";
import {
  forgotPasswordAction,
  resendConfirmationAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type AuthState,
} from "./actions";

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  const { locale } = useI18n();
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pe-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="text-subtle hover:bg-surface-2 hover:text-foreground absolute end-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full"
        aria-label={
          show
            ? locale === "ar"
              ? "إخفاء كلمة المرور"
              : "Hide password"
            : locale === "ar"
              ? "إظهار كلمة المرور"
              : "Show password"
        }
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function SignInForm({ next, linkError }: { next?: string; linkError?: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AuthState, FormData>(signInAction, null);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="editorial text-4xl font-extrabold">{t.auth.signInTitle}</h1>
      </div>
      {linkError && <FormMessage tone="info">{t.auth.linkInvalid}</FormMessage>}
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label={t.auth.email} htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            dir="ltr"
            defaultValue={state?.email}
          />
        </Field>
        <Field label={t.auth.password} htmlFor="password" required>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </Field>
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-primary dark:text-lavender text-sm font-semibold hover:underline"
          >
            {t.auth.forgot}
          </Link>
        </div>
        {state?.error && <FormMessage>{state.error}</FormMessage>}
        <Button type="submit" size="lg" loading={pending}>
          {t.auth.signIn}
        </Button>
      </form>
      {state?.needsConfirmation && state.email && <ResendForm email={state.email} />}
      <p className="text-muted text-center text-sm">
        {t.auth.noAccount}{" "}
        <Link href="/sign-up" className="text-primary dark:text-lavender font-semibold hover:underline">
          {t.auth.signUp}
        </Link>
        <span className="mx-2">·</span>
        <Link href="/employer/request-access" className="text-primary dark:text-lavender font-semibold hover:underline">
          {t.auth.employerAccess}
        </Link>
      </p>
    </div>
  );
}

export function ResendForm({ email }: { email: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AuthState, FormData>(resendConfirmationAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="email" value={email} />
      <Button type="submit" variant="outline" loading={pending}>
        {t.auth.resend}
      </Button>
      {state?.info && <FormMessage tone="success">{state.info}</FormMessage>}
      {state?.error && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}

export function SignUpForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AuthState, FormData>(signUpAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="editorial text-4xl font-extrabold">{t.auth.signUpTitle}</h1>
      </div>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="accountType" value="candidate" />
        <Field label={t.auth.fullName} htmlFor="fullName" error={fe.fullName} required>
          <Input id="fullName" name="fullName" autoComplete="name" required aria-invalid={!!fe.fullName} />
        </Field>
        <Field label={t.auth.email} htmlFor="email" error={fe.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            dir="ltr"
            required
            aria-invalid={!!fe.email}
          />
        </Field>
        <Field
          label={t.auth.password}
          htmlFor="password"
          hint={t.auth.passwordHint}
          error={fe.password}
          required
        >
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            aria-invalid={!!fe.password}
          />
        </Field>
        <Field label={t.auth.confirmPassword} htmlFor="confirmPassword" error={fe.confirmPassword} required>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            required
            aria-invalid={!!fe.confirmPassword}
          />
        </Field>
        <label className="text-muted flex items-start gap-3 text-sm">
          <Checkbox name="consent" required className="mt-1" aria-invalid={!!fe.consent} />
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
        {fe.consent && <p className="text-danger text-xs font-medium">{fe.consent}</p>}
        {state?.error && <FormMessage>{state.error}</FormMessage>}
        <Button type="submit" size="lg" loading={pending}>
          {t.auth.signUp}
        </Button>
      </form>
      <p className="text-muted text-center text-sm">
        {t.auth.haveAccount}{" "}
        <Link href="/sign-in" className="text-primary dark:text-lavender font-semibold hover:underline">
          {t.auth.signIn}
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AuthState, FormData>(forgotPasswordAction, null);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="editorial text-4xl font-extrabold">{t.auth.forgotTitle}</h1>
        <p className="text-muted mt-2">{t.auth.forgotBody}</p>
      </div>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <Field label={t.auth.email} htmlFor="email" error={state?.fieldErrors?.email} required>
          <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" required />
        </Field>
        {state?.info && <FormMessage tone="success">{state.info}</FormMessage>}
        {state?.error && <FormMessage>{state.error}</FormMessage>}
        <Button type="submit" size="lg" loading={pending}>
          {t.auth.sendReset}
        </Button>
      </form>
      <Link href="/sign-in" className="text-primary dark:text-lavender text-center text-sm font-semibold">
        {t.auth.signIn}
      </Link>
    </div>
  );
}

export function ResetPasswordForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AuthState, FormData>(resetPasswordAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <div className="flex flex-col gap-6">
      <h1 className="editorial text-4xl font-extrabold">{t.auth.resetTitle}</h1>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <Field
          label={t.auth.password}
          htmlFor="password"
          hint={t.auth.passwordHint}
          error={fe.password}
          required
        >
          <PasswordInput id="password" name="password" autoComplete="new-password" required />
        </Field>
        <Field label={t.auth.confirmPassword} htmlFor="confirmPassword" error={fe.confirmPassword} required>
          <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required />
        </Field>
        {state?.error && <FormMessage>{state.error}</FormMessage>}
        <Button type="submit" size="lg" loading={pending}>
          {t.auth.resetSubmit}
        </Button>
      </form>
    </div>
  );
}
