"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Building2, Eye, EyeOff, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import {
  forgotPasswordAction,
  resendConfirmationAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type AuthState,
} from "./actions";

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  const { locale } = useI18n();
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pe-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute end-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-subtle hover:bg-surface-2 hover:text-foreground"
        aria-label={show ? (locale === "ar" ? "إخفاء كلمة المرور" : "Hide password") : locale === "ar" ? "إظهار كلمة المرور" : "Show password"}
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
        <p className="mt-2 text-muted">{t.auth.signInBody}</p>
      </div>
      {linkError && <FormMessage tone="info">{t.auth.linkInvalid}</FormMessage>}
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label={t.auth.email} htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" required dir="ltr" defaultValue={state?.email} />
        </Field>
        <Field label={t.auth.password} htmlFor="password" required>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:underline dark:text-lavender">
            {t.auth.forgot}
          </Link>
        </div>
        {state?.error && <FormMessage>{state.error}</FormMessage>}
        <Button type="submit" size="lg" loading={pending}>
          {t.auth.signIn}
        </Button>
      </form>
      {state?.needsConfirmation && state.email && <ResendForm email={state.email} />}
      <p className="text-center text-sm text-muted">
        {t.auth.noAccount}{" "}
        <Link href="/sign-up" className="font-semibold text-primary hover:underline dark:text-lavender">
          {t.auth.signUp}
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

export function SignUpForm({ initialType }: { initialType: "candidate" | "company" }) {
  const { t } = useI18n();
  const [type, setType] = useState(initialType);
  const [state, action, pending] = useActionState<AuthState, FormData>(signUpAction, null);
  const fe = state?.fieldErrors ?? {};
  const types = [
    { key: "candidate" as const, icon: UserRound, title: t.auth.asCandidate, body: t.auth.asCandidateBody },
    { key: "company" as const, icon: Building2, title: t.auth.asCompany, body: t.auth.asCompanyBody },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="editorial text-4xl font-extrabold">{t.auth.signUpTitle}</h1>
        <p className="mt-2 text-muted">{t.auth.signUpBody}</p>
      </div>
      <div role="radiogroup" aria-label={t.auth.signUpBody} className="grid grid-cols-2 gap-3">
        {types.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={type === o.key}
            onClick={() => setType(o.key)}
            className={cn(
              "relative flex flex-col gap-2 rounded-2xl border p-4 text-start transition",
              type === o.key ? "border-primary bg-accent-soft" : "hover:border-border-strong",
            )}
          >
            {type === o.key && (
              <motion.span layoutId="acct-type" className="absolute inset-0 rounded-2xl ring-2 ring-primary" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
            )}
            <o.icon className="size-5 text-primary dark:text-lavender" aria-hidden />
            <span className="text-sm font-bold">{o.title}</span>
            <span className="text-xs leading-snug text-muted">{o.body}</span>
          </button>
        ))}
      </div>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="accountType" value={type} />
        <Field label={t.auth.fullName} htmlFor="fullName" error={fe.fullName} required>
          <Input id="fullName" name="fullName" autoComplete="name" required aria-invalid={!!fe.fullName} />
        </Field>
        <Field label={t.auth.email} htmlFor="email" error={fe.email} required>
          <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" required aria-invalid={!!fe.email} />
        </Field>
        <Field label={t.auth.password} htmlFor="password" hint={t.auth.passwordHint} error={fe.password} required>
          <PasswordInput id="password" name="password" autoComplete="new-password" required aria-invalid={!!fe.password} />
        </Field>
        <Field label={t.auth.confirmPassword} htmlFor="confirmPassword" error={fe.confirmPassword} required>
          <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required aria-invalid={!!fe.confirmPassword} />
        </Field>
        <label className="flex items-start gap-3 text-sm text-muted">
          <Checkbox name="consent" required className="mt-1" aria-invalid={!!fe.consent} />
          <span>
            {t.auth.consent}{" "}
            <Link href="/terms" className="font-semibold text-primary dark:text-lavender">
              {t.landing.footerTerms}
            </Link>{" "}
            ·{" "}
            <Link href="/privacy" className="font-semibold text-primary dark:text-lavender">
              {t.landing.footerPrivacy}
            </Link>
          </span>
        </label>
        {fe.consent && <p className="text-xs font-medium text-danger">{fe.consent}</p>}
        {state?.error && <FormMessage>{state.error}</FormMessage>}
        <Button type="submit" size="lg" loading={pending}>
          {t.auth.signUp}
        </Button>
      </form>
      <p className="text-center text-sm text-muted">
        {t.auth.haveAccount}{" "}
        <Link href="/sign-in" className="font-semibold text-primary hover:underline dark:text-lavender">
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
        <p className="mt-2 text-muted">{t.auth.forgotBody}</p>
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
      <Link href="/sign-in" className="text-center text-sm font-semibold text-primary dark:text-lavender">
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
        <Field label={t.auth.password} htmlFor="password" hint={t.auth.passwordHint} error={fe.password} required>
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
