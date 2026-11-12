"use client";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageUp, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { saveCompanyIdentity } from "@/features/company/actions";
import { brandVars, contrastRatio, identityImageUrl, JADARAH_FALLBACK, readableOn, sanitizeHex } from "@/lib/brand";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";
import { getBrowserClient } from "@/lib/supabase/client";

type Identity = {
  logo_path: string;
  cover_path: string;
  tagline_en: string;
  tagline_ar: string;
  primary_hex: string;
  secondary_hex: string;
  accent_hex: string;
};
const IMG_TYPES = ["image/png", "image/jpeg", "image/webp"];
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * Employer-managed company identity with a live preview of how candidates see it.
 * Images go to the public `company-identity` bucket under `{company_id}/` (company admins only, ≤ 2 MB).
 */
export function IdentityEditor({
  companyId,
  name,
  initial,
}: {
  companyId: string;
  name: { en: string; ar: string };
  initial: Identity;
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveCompanyIdentity, null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);
  const set = (k: keyof Identity, val: string) => setV((p) => ({ ...p, [k]: val }));

  async function upload(kind: "logo" | "cover", f: File) {
    if (!IMG_TYPES.includes(f.type) || f.size > 2 * 1024 * 1024)
      return toast.error(L("PNG, JPEG or WebP up to 2 MB", "PNG أو JPEG أو WebP حتى 2 ميجابايت"));
    setUploading(kind);
    const path = `${companyId}/${kind}-${crypto.randomUUID().slice(0, 8)}.${EXT[f.type]}`;
    const { error } = await getBrowserClient().storage.from("company-identity").upload(path, f, { contentType: f.type });
    setUploading(null);
    if (error) return toast.error(L("Upload failed", "فشل الرفع"));
    set(kind === "logo" ? "logo_path" : "cover_path", path);
  }

  const vars = useMemo(
    () =>
      brandVars({
        primary_hex: sanitizeHex(v.primary_hex),
        secondary_hex: sanitizeHex(v.secondary_hex),
        accent_hex: sanitizeHex(v.accent_hex),
      }),
    [v.primary_hex, v.secondary_hex, v.accent_hex],
  );
  const primary = sanitizeHex(v.primary_hex) ?? JADARAH_FALLBACK.primary;
  const ratio = contrastRatio(primary, readableOn(primary));
  const logo = identityImageUrl(v.logo_path);
  const cover = identityImageUrl(v.cover_path);
  const nm = locale === "ar" ? name.ar : name.en;
  const tagline = locale === "ar" ? v.tagline_ar : v.tagline_en;

  const colour = (k: "primary_hex" | "secondary_hex" | "accent_hex", label: string, hint?: string) => {
    const ok = v[k] === "" || sanitizeHex(v[k]) !== null;
    return (
      <Field label={label} htmlFor={k} hint={hint} error={ok ? undefined : L("Use #RRGGBB", "استخدم ‎#RRGGBB")}>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={label}
            value={sanitizeHex(v[k]) ?? "#172F49"}
            onChange={(e) => set(k, e.target.value.toUpperCase())}
            className="size-10 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0.5"
          />
          <Input id={k} name={k} value={v[k]} onChange={(e) => set(k, e.target.value)} placeholder="#RRGGBB" dir="ltr" className="ltr-nums" />
          {v[k] && (
            <Button type="button" size="icon" variant="ghost" onClick={() => set(k, "")} aria-label={L("Reset", "إعادة ضبط")}>
              <RotateCcw />
            </Button>
          )}
        </div>
      </Field>
    );
  };

  const imagePicker = (kind: "logo" | "cover", label: string, url: string | null) => (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-2">
        <label className="hover:border-primary/60 flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed px-4 py-2.5 text-sm font-semibold">
          <ImageUp className="size-4" />
          {uploading === kind ? L("Uploading…", "جارٍ الرفع…") : url ? L("Replace", "استبدال") : L("Upload", "رفع")}
          <input
            type="file"
            accept={IMG_TYPES.join(",")}
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && upload(kind, e.target.files[0])}
          />
        </label>
        {url && (
          <Button type="button" size="sm" variant="ghost" onClick={() => set(kind === "logo" ? "logo_path" : "cover_path", "")}>
            <Trash2 /> {L("Remove", "إزالة")}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <input type="hidden" name="logo_path" value={v.logo_path} />
      <input type="hidden" name="cover_path" value={v.cover_path} />
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {imagePicker("logo", L("Logo", "الشعار"), logo)}
          {imagePicker("cover", L("Cover image", "صورة الغلاف"), cover)}
        </div>
        <Field label={L("Short description (Arabic)", "وصف مختصر (عربي)")} htmlFor="tagline_ar">
          <Input id="tagline_ar" name="tagline_ar" value={v.tagline_ar} maxLength={160} dir="rtl" onChange={(e) => set("tagline_ar", e.target.value)} />
        </Field>
        <Field label={L("Short description (English)", "وصف مختصر (إنجليزي)")} htmlFor="tagline_en">
          <Input id="tagline_en" name="tagline_en" value={v.tagline_en} maxLength={160} dir="ltr" onChange={(e) => set("tagline_en", e.target.value)} />
        </Field>
        {colour("primary_hex", L("Primary colour", "اللون الأساسي"))}
        {colour("secondary_hex", L("Secondary colour", "اللون الثانوي"))}
        {colour("accent_hex", L("Accent colour (optional)", "لون مميّز (اختياري)"))}
        <p className="text-subtle text-xs">
          {L(
            "Your colours appear on your company pages, jobs, tasks and interviews. JADARAH navigation and security indicators always keep the platform colours. Text colour is chosen automatically for readability",
            "تظهر ألوانك في صفحات شركتك ووظائفها ومهامها ومقابلاتها. تحتفظ قوائم جدارة ومؤشرات الأمان دائمًا بألوان المنصة. يُختار لون النص تلقائيًا لضمان الوضوح",
          )}
        </p>
        {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
        <Button type="submit" loading={pending} disabled={!!uploading} className="self-start">
          {L("Save identity", "حفظ الهوية")}
        </Button>
      </div>

      <div aria-label={L("Live preview", "معاينة مباشرة")} className="flex flex-col gap-3">
        <p className="text-subtle text-xs font-bold tracking-wide">{L("LIVE PREVIEW — what candidates see", "معاينة مباشرة — ما يراه المرشحون")}</p>
        <div style={vars as React.CSSProperties} className="overflow-hidden rounded-2xl border">
          <div
            className="relative h-32 bg-[var(--brand)]"
            style={
              cover
                ? { backgroundImage: `linear-gradient(to top, var(--brand) 5%, transparent 120%), url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" }
                : { backgroundImage: "linear-gradient(120deg, var(--brand) 55%, var(--brand-2) 140%)" }
            }
          >
            <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 text-[var(--brand-fg)]">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- preview of the uploaded logo
                <img src={logo} alt="" className="size-12 rounded-xl bg-white object-contain p-1 ring-2 ring-white/40" />
              ) : (
                <span className="grid size-12 place-items-center rounded-xl bg-white/15 text-lg font-bold ring-2 ring-white/40">{nm.slice(0, 1)}</span>
              )}
              <div className="min-w-0">
                <p className="truncate font-bold">{nm}</p>
                {tagline && <p className="truncate text-sm opacity-85">{tagline}</p>}
              </div>
            </div>
          </div>
          <div className="bg-surface flex flex-col gap-3 p-4">
            <div className="rounded-xl border p-3">
              <p className="text-xs font-semibold text-[var(--brand-2)]">{nm}</p>
              <p className="font-bold">{L("Data Analyst", "محلل بيانات")}</p>
              <p className="text-subtle text-xs">{L("Riyadh · Hybrid · Sample job card", "الرياض · هجين · بطاقة وظيفة توضيحية")}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-semibold text-[var(--brand-fg)]">
                  {L("Apply for this job", "تقديم على الوظيفة")}
                </span>
                <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-semibold text-[#172F49]">
                  {L("Practical task", "مهمة عملية")}
                </span>
                <span className="size-2.5 rounded-full bg-[var(--brand-accent)]" aria-hidden />
              </div>
            </div>
          </div>
        </div>
        <p className={ratio >= 4.5 ? "text-success text-xs" : "text-warning text-xs"}>
          {L("Text contrast on primary colour", "تباين النص على اللون الأساسي")}: <span className="ltr-nums">{ratio.toFixed(1)}:1</span>{" "}
          {ratio >= 4.5 ? L("— accessible", "— مناسب") : L("— consider a darker or lighter colour", "— جرّب لونًا أغمق أو أفتح")}
        </p>
      </div>
    </form>
  );
}
