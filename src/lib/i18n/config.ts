export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_COOKIE = "jadarah_locale";

export function isLocale(v: unknown): v is Locale {
  return v === "ar" || v === "en";
}

export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Gregorian calendar and Latin digits in both languages for consistent, scannable data. */
export function intlLocale(locale: Locale): string {
  return locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
}

export function formatDate(value: string | Date | null | undefined, locale: Locale, opts?: Intl.DateTimeFormatOptions) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(intlLocale(locale), opts ?? { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined, locale: Locale, timeZone = "Asia/Riyadh") {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(d);
}

export function formatNumber(n: number | null | undefined, locale: Locale, opts?: Intl.NumberFormatOptions) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(intlLocale(locale), opts).format(n);
}

export function formatRelative(value: string | Date, locale: Locale) {
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = (d.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(d, locale);
}

/** Pick the localized column of a bilingual row: pick(job, "title", "ar") -> job.title_ar */
export function pick<T extends Record<string, unknown>>(row: T | null | undefined, base: string, locale: Locale): string {
  if (!row) return "";
  const primary = row[`${base}_${locale}`];
  const fallback = row[`${base}_${locale === "ar" ? "en" : "ar"}`];
  return String((primary as string) || (fallback as string) || "");
}

export function pickArray<T extends Record<string, unknown>>(row: T | null | undefined, base: string, locale: Locale): string[] {
  if (!row) return [];
  const primary = row[`${base}_${locale}`] as string[] | undefined;
  const fallback = row[`${base}_${locale === "ar" ? "en" : "ar"}`] as string[] | undefined;
  return primary && primary.length ? primary : (fallback ?? []);
}
