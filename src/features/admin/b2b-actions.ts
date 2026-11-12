"use server";
import { kickEmailDispatch } from "@/services/email/dispatch";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

async function ctx() {
  await requireSuperAdmin();
  return { supabase: await createClient(), ...(await getI18n()) };
}
const ok = (locale: string, en: string, ar: string): ActionResult => ({ ok: true, message: locale === "ar" ? ar : en });

const reviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  role: z.enum(["company_admin", "recruiter", "interviewer"]).optional(),
  note: z.string().trim().max(1000).optional(),
});

/** Approve (optionally adjusting the role) or reject an employee access request. */
export async function reviewAccessRequest(requestId: string, input: unknown): Promise<ActionResult> {
  const { supabase, locale } = await ctx();
  const p = reviewSchema.safeParse(input);
  if (!p.success) return { ok: false, error: localizeError(null, locale) };
  const { error } = await supabase.rpc("review_access_request", {
    p_request: requestId,
    p_decision: p.data.decision,
    p_role: p.data.role,
    p_note: p.data.note || undefined,
  });
  if (error) return { ok: false, error: localizeError(error, locale) };
  kickEmailDispatch();
  revalidatePath("/admin/access-requests");
  return p.data.decision === "approve" ? ok(locale, "Access approved", "تمت الموافقة") : ok(locale, "Request rejected", "تم رفض الطلب");
}

const provisionSchema = z.object({
  name_en: z.string().trim().min(2).max(160),
  name_ar: z.string().trim().min(2).max(160),
  registry_id: z.string().trim().max(40).optional(),
  sector_en: z.string().trim().max(120).optional(),
  sector_ar: z.string().trim().max(120).optional(),
  website: z.union([z.literal(""), z.string().trim().url().max(300)]).optional(),
  organization_type: z.string().trim().max(120).optional(),
});

/** Provision a new organization (any number; no code change). Starts with a pending subscription. */
export async function provisionCompany(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase, locale } = await ctx();
  const p = provisionSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: locale === "ar" ? "أكمل الاسم بالعربية والإنجليزية" : "Enter the name in Arabic and English" };
  const v = p.data;
  const { data, error } = await supabase.rpc("admin_provision_company", {
    p_name_en: v.name_en,
    p_name_ar: v.name_ar,
    p_registry_id: v.registry_id || undefined,
    p_sector_en: v.sector_en || undefined,
    p_sector_ar: v.sector_ar || undefined,
    p_website: v.website || undefined,
    p_organization_type: v.organization_type || undefined,
  });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/companies");
  return { ok: true, data: undefined, message: locale === "ar" ? "تمت تهيئة الجهة" : `Organization provisioned (${String(data).slice(0, 8)}).` };
}

const num = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));
const subscriptionSchema = z
  .object({
    plan: z.string().trim().min(2).max(60),
    status: z.enum(["pending", "active", "suspended", "expired", "cancelled"]),
    price_sar: z.preprocess(num, z.number().min(0).max(100_000_000).nullable()),
    billing_period: z.preprocess((v) => (v === "" ? null : v), z.enum(["monthly", "quarterly", "annual", "one_time", "custom"]).nullable()),
    starts_on: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
    expires_on: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
    assessment_credits: z.preprocess(num, z.number().int().min(0).max(1_000_000).nullable()),
    payment_status: z.enum(["not_invoiced", "invoiced", "partially_paid", "paid", "waived", "demo"]),
    is_demo: z.preprocess((v) => v === "on" || v === true, z.boolean()),
    listed: z.preprocess((v) => v === "on" || v === true, z.boolean()),
    accepts_access_requests: z.preprocess((v) => v === "on" || v === true, z.boolean()),
    commercial_notes: z.string().trim().max(2000).optional(),
  })
  .refine((v) => !v.starts_on || !v.expires_on || v.expires_on >= v.starts_on, { path: ["expires_on"] })
  // demo access must never be recorded as a paid contract
  .refine((v) => !v.is_demo || v.payment_status === "demo", { path: ["payment_status"] });

export async function saveSubscription(companyId: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase, locale } = await ctx();
  const p = subscriptionSchema.safeParse(Object.fromEntries(form));
  if (!p.success)
    return {
      ok: false,
      error:
        locale === "ar"
          ? "تحقق من التواريخ والقيم. الاشتراك التجريبي يجب أن تكون حالة دفعه «تجريبي»"
          : "Check dates and values. Demonstration access must use payment status ‘demo’",
    };
  const { listed, accepts_access_requests, ...sub } = p.data;
  const { error } = await supabase.from("company_subscriptions").upsert({ company_id: companyId, ...sub }, { onConflict: "company_id" });
  if (error) return { ok: false, error: localizeError(error, locale) };
  const { error: cErr } = await supabase.from("company_profiles").update({ listed, accepts_access_requests }).eq("id", companyId);
  if (cErr) return { ok: false, error: localizeError(cErr, locale) };
  revalidatePath("/admin/subscriptions");
  return ok(locale, "Subscription saved", "حُفظ الاشتراك");
}

const paymentSchema = z.object({
  kind: z.enum(["payment", "refund"]),
  amount_sar: z.coerce.number().positive().max(100_000_000),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

/** Record an ACTUAL payment/refund (revenue reports only count these). */
export async function recordPayment(companyId: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase, locale } = await ctx();
  const p = paymentSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: locale === "ar" ? "أدخل المبلغ والتاريخ" : "Enter amount and date" };
  const { data: sub } = await supabase.from("company_subscriptions").select("id, is_demo").eq("company_id", companyId).maybeSingle();
  if (sub?.is_demo)
    return { ok: false, error: locale === "ar" ? "لا تُسجَّل مدفوعات على وصول تجريبي" : "Payments can't be recorded on demonstration access" };
  const { error } = await supabase.from("company_payments").insert({ company_id: companyId, subscription_id: sub?.id ?? null, ...p.data });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/admin/subscriptions");
  return ok(locale, "Payment recorded", "سُجّلت الدفعة");
}

const hex = z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable());
const brandSchema = z.object({
  primary_hex: hex,
  secondary_hex: hex,
  logo_source_url: z.preprocess((v) => (v === "" ? null : v), z.string().url().max(500).nullable()),
  brand_source: z.preprocess((v) => (v === "" ? null : v), z.string().max(500).nullable()),
  identity_status: z.enum(["not_verified", "verified"]),
  usage_permission: z.enum(["not_verified", "granted", "denied"]),
  notes: z.string().trim().max(1000).optional(),
});

/** Brand assets are only displayed when identity is verified AND usage permission is granted. */
export async function saveBrandProfile(companyId: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase, locale } = await ctx();
  const p = brandSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: locale === "ar" ? "تحقق من الألوان (#RRGGBB) والروابط" : "Check colours (#RRGGBB) and links" };
  const { error } = await supabase
    .from("company_brand_profiles")
    .upsert({ company_id: companyId, ...p.data, updated_at: new Date().toISOString() }, { onConflict: "company_id" });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/admin/subscriptions");
  return ok(locale, "Brand profile saved", "حُفظت الهوية");
}
