"use server";
import { kickEmailDispatch } from "@/services/email/dispatch";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

async function ctx() {
  const session = await requireSuperAdmin();
  return { session, supabase: await createClient(), ...(await getI18n()) };
}

export async function reviewCompany(
  companyId: string,
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { supabase, locale } = await ctx();
  const decision = String(form.get("decision"));
  const { error } = await supabase.rpc("review_company", {
    p_company: companyId,
    p_decision: decision,
    p_notes: String(form.get("notes") ?? "").slice(0, 1000),
  });
  if (error) return { ok: false, error: localizeError(error, locale) };
  kickEmailDispatch();
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message:
      locale === "ar" ? "تم تسجيل القرار وإبلاغ الشركة" : "Decision recorded and the company was notified",
  };
}

export async function getCompanyDocumentUrl(path: string): Promise<ActionResult<{ url: string }>> {
  const { supabase, locale } = await ctx();
  const { data, error } = await supabase.storage.from("company-documents").createSignedUrl(path, 60);
  if (error || !data) return { ok: false, error: localizeError(error, locale) };
  return { ok: true, data: { url: data.signedUrl } };
}

export async function setUserStatus(
  userId: string,
  status: "active" | "suspended" | "deactivated",
): Promise<ActionResult> {
  const { supabase, locale } = await ctx();
  const { error } = await supabase.rpc("admin_set_user_status", { p_user: userId, p_status: status });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/admin/users", "layout");
  return { ok: true };
}

export async function setPlatformRole(
  userId: string,
  role: "super_admin" | "candidate",
  grant: boolean,
): Promise<ActionResult> {
  const { supabase, locale } = await ctx();
  const { error } = grant
    ? await supabase.rpc("admin_grant_role", { p_user: userId, p_role: role })
    : await supabase.rpc("admin_revoke_role", { p_user: userId, p_role: role });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/admin/users", "layout");
  return { ok: true };
}

export async function setMembership(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase, locale } = await ctx();
  const { error } = await supabase.rpc("admin_set_membership", {
    p_company: String(form.get("company_id")),
    p_user: String(form.get("user_id")),
    p_role: String(form.get("role")) as "company_admin",
    p_active: form.get("active") !== "false",
  });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/admin/users", "layout");
  return { ok: true };
}

const resourceSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
  title_en: z.string().min(2).max(200),
  title_ar: z.string().min(2).max(200),
  provider: z.string().min(2).max(120),
  url: z.string().url().startsWith("https://"),
  kind: z.enum(["course", "documentation", "video", "book", "practice", "article"]),
  topic: z.string().min(2).max(60),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  skill_slugs: z.string().max(300).optional(),
});
export async function addResource(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase, locale } = await ctx();
  const p = resourceSchema.safeParse(Object.fromEntries(form));
  if (!p.success)
    return {
      ok: false,
      error:
        locale === "ar"
          ? "راجع الحقول (الرابط يجب أن يبدأ بـ https)"
          : "Check the fields (URL must use https)",
    };
  const { error } = await supabase.from("learning_resources").insert({
    ...p.data,
    skill_slugs: (p.data.skill_slugs ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/admin/resources");
  return { ok: true };
}

export async function toggleResource(id: string, active: boolean): Promise<void> {
  const { supabase } = await ctx();
  await supabase.from("learning_resources").update({ is_active: active }).eq("id", id);
  revalidatePath("/admin/resources");
}

/** Checks a resource URL with a HEAD/GET request and records the verification time only on success. */
export async function verifyResourceLink(id: string): Promise<ActionResult<{ status: number }>> {
  const { supabase, locale } = await ctx();
  const { data: r } = await supabase.from("learning_resources").select("url").eq("id", id).single();
  if (!r) return { ok: false, error: localizeError(null, locale) };
  let status = 0;
  try {
    const res = await fetch(r.url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "JADARAH-link-check/1.0" },
    });
    status = res.status;
  } catch {
    status = 0;
  }
  if (status >= 200 && status < 400)
    await supabase
      .from("learning_resources")
      .update({ link_verified_at: new Date().toISOString() })
      .eq("id", id);
  revalidatePath("/admin/resources");
  return { ok: true, data: { status } };
}

export async function saveSetting(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { session, supabase, locale } = await ctx();
  const key = String(form.get("key"));
  if (key === "environment")
    return {
      ok: false,
      error:
        locale === "ar"
          ? "يُغيَّر نوع البيئة عبر SQL فقط لأسباب أمان"
          : "The environment flag can only be changed through SQL for safety",
    };
  let value: unknown;
  try {
    value = JSON.parse(String(form.get("value")));
  } catch {
    return {
      ok: false,
      error: locale === "ar" ? "القيمة يجب أن تكون JSON صالحًا" : "Value must be valid JSON",
    };
  }
  const { error } = await supabase
    .from("platform_settings")
    .upsert({
      key,
      value: value as never,
      description: String(form.get("description") ?? "") || null,
      updated_by: session.userId,
      updated_at: new Date().toISOString(),
    });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/admin/settings");
  return { ok: true, message: locale === "ar" ? "تم الحفظ" : "Saved" };
}

export async function generateReport(kind: "platform_snapshot"): Promise<ActionResult> {
  const { session, supabase, locale } = await ctx();
  const { data, error } = await supabase.rpc("admin_platform_stats");
  if (error) return { ok: false, error: localizeError(error, locale) };
  await supabase
    .from("reports")
    .insert({
      kind,
      title: `Platform snapshot ${new Date().toISOString().slice(0, 10)}`,
      data: data as never,
      generated_by: session.userId,
    });
  revalidatePath("/admin/reports");
  return { ok: true };
}

export async function resetDemo(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase, locale } = await ctx();
  if (form.get("confirm") !== "RESET DEMO")
    return { ok: false, error: locale === "ar" ? "اكتب RESET DEMO للتأكيد" : "Type RESET DEMO to confirm" };
  const { data, error } = await supabase.rpc("demo_reset" as never);
  if (error)
    return {
      ok: false,
      error: error.message.includes("refused") ? error.message : localizeError(error, locale),
    };
  revalidatePath("/admin", "layout");
  return { ok: true, message: JSON.stringify(data) };
}

/** Requeue a permanently failed email (Super Admin). Same outbox row → no duplicate. */
export async function retryEmail(id: string): Promise<ActionResult> {
  await requireSuperAdmin();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_retry_email", { p_id: id });
  if (error) return { ok: false, error: localizeError(error, locale) };
  kickEmailDispatch();
  revalidatePath("/admin/emails");
  return { ok: true };
}
