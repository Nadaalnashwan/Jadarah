"use server";
import { kickEmailDispatch } from "@/services/email/dispatch";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { getSession, homeFor } from "@/lib/auth/session";
import { localizeError } from "@/lib/errors";
import {
  accessRequestSchema,
  emailOnlySchema,
  employerAccessSchema,
  resetSchema,
  safeNext,
  signInSchema,
  signUpSchema,
} from "./schemas";

export type AuthState = {
  error?: string;
  info?: string;
  fieldErrors?: Record<string, string>;
  needsConfirmation?: boolean;
  email?: string;
} | null;

function callbackUrl(next: string) {
  return `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signInAction(_: AuthState, form: FormData): Promise<AuthState> {
  const { t } = await getI18n();
  if (!(await rateLimit("sign-in", 10, 60_000))) return { error: t.auth.rateLimited };
  const parsed = signInSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: t.auth.invalidCredentials };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    if (error.code === "email_not_confirmed")
      return { error: t.auth.emailNotConfirmed, needsConfirmation: true, email: parsed.data.email };
    if (error.status === 429) return { error: t.auth.rateLimited };
    return { error: t.auth.invalidCredentials };
  }
  const session = await getSession();
  if (session && session.profile.status !== "active") {
    await supabase.auth.signOut();
    redirect("/account-suspended");
  }
  redirect(safeNext(parsed.data.next, session ? homeFor(session) : "/"));
}

export async function signUpAction(_: AuthState, form: FormData): Promise<AuthState> {
  const { t, locale } = await getI18n();
  if (!(await rateLimit("sign-up", 5, 60_000))) return { error: t.auth.rateLimited };
  const parsed = signUpSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (fieldErrors[key]) continue;
      if (key === "password") fieldErrors[key] = t.auth.weakPassword;
      else if (key === "confirmPassword") fieldErrors[key] = t.auth.passwordsMismatch;
      else if (key === "consent") fieldErrors[key] = t.common.required;
      else fieldErrors[key] = t.common.required;
    }
    return { fieldErrors };
  }
  const { accountType, fullName, email, password } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl("/onboarding/candidate"),
      // account_type is a hint only: the database trigger allows just 'candidate' | 'company' and never grants privileged roles.
      data: { full_name: fullName, account_type: accountType, locale, consent: "true" },
    },
  });
  if (error) {
    if (error.status === 429) return { error: t.auth.rateLimited };
    if (error.code === "weak_password") return { fieldErrors: { password: t.auth.weakPassword } };
    return { error: t.common.errorBody };
  }
  // With email confirmation enabled Supabase returns no session. Never treat the user as verified here.
  if (data.session) redirect("/onboarding/candidate");
  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

/**
 * Employer access request. Creates an EMPLOYER account (never a company, never any privilege).
 * The membership request itself is filed after email verification (see /onboarding/company) and
 * waits for Super Admin approval.
 */
export async function employerSignUpAction(_: AuthState, form: FormData): Promise<AuthState> {
  const { t, locale } = await getI18n();
  if (!(await rateLimit("sign-up", 5, 60_000))) return { error: t.auth.rateLimited };
  const parsed = employerAccessSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (fieldErrors[key]) continue;
      fieldErrors[key] =
        key === "password" ? t.auth.weakPassword : key === "confirmPassword" ? t.auth.passwordsMismatch : t.common.required;
    }
    return { fieldErrors };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      emailRedirectTo: callbackUrl("/onboarding/company"),
      data: {
        full_name: v.fullName,
        account_type: "company",
        locale,
        consent: "true",
        // Untrusted hint only — validated by request_company_access() and reviewed by Super Admin.
        access_request: { company_id: v.companyId, job_title: v.jobTitle, role: v.role },
      },
    },
  });
  if (error) {
    if (error.status === 429) return { error: t.auth.rateLimited };
    if (error.code === "weak_password") return { fieldErrors: { password: t.auth.weakPassword } };
    return { error: t.common.errorBody };
  }
  redirect(`/check-email?email=${encodeURIComponent(v.email)}`);
}

/** File (or re-file) an access request as a signed-in, verified employer account. */
export async function submitAccessRequestAction(_: AuthState, form: FormData): Promise<AuthState> {
  const { t, locale } = await getI18n();
  const parsed = accessRequestSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: t.common.required };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_company_access", {
    p_company: parsed.data.companyId,
    p_job_title: parsed.data.jobTitle,
    p_role: parsed.data.role,
  });
  if (error) return { error: localizeError(error, locale) };
  kickEmailDispatch();
  redirect("/onboarding/company");
}

export async function resendConfirmationAction(_: AuthState, form: FormData): Promise<AuthState> {
  const { t } = await getI18n();
  if (!(await rateLimit("resend", 3, 60_000))) return { error: t.auth.rateLimited };
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: t.common.required };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: callbackUrl("/onboarding") },
  });
  if (error?.status === 429) return { error: t.auth.rateLimited };
  // Same response whether or not the address exists (no account enumeration).
  return { info: t.auth.resent };
}

export async function forgotPasswordAction(_: AuthState, form: FormData): Promise<AuthState> {
  const { t } = await getI18n();
  if (!(await rateLimit("forgot", 3, 60_000))) return { error: t.auth.rateLimited };
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: { email: t.common.required } };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl("/reset-password"),
  });
  if (error?.status === 429) return { error: t.auth.rateLimited };
  return { info: t.auth.resetSent };
}

export async function resetPasswordAction(_: AuthState, form: FormData): Promise<AuthState> {
  const { t } = await getI18n();
  const parsed = resetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const k = String(parsed.error.issues[0]?.path[0]);
    return { fieldErrors: { [k]: k === "confirmPassword" ? t.auth.passwordsMismatch : t.auth.weakPassword } };
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: t.auth.linkInvalid };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.code === "same_password" ? t.auth.weakPassword : t.common.errorBody };
  const session = await getSession();
  redirect(session ? homeFor(session) : "/onboarding");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
