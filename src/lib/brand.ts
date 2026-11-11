/**
 * Employer-managed company identity → scoped CSS variables.
 * Colours are validated (#RRGGBB only), and a readable foreground is computed so text on a company colour always
 * meets WCAG contrast. Company colours are applied only inside a company-scoped wrapper — never to JADARAH's
 * navigation, security indicators or platform identity.
 */
export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function sanitizeHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return HEX_RE.test(s) ? s.toUpperCase() : null;
}

function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Darkest tone of the approved Deep Navy (#172F49) — text on light company colours. */
export const NAVY_INK = "#0C1927";

/** White or JADARAH navy ink — whichever reads better on the given background. */
export function readableOn(bg: string): "#FFFFFF" | typeof NAVY_INK {
  return contrastRatio(bg, "#FFFFFF") >= contrastRatio(bg, NAVY_INK) ? "#FFFFFF" : NAVY_INK;
}

/** Mix a colour toward white (amount 0..1) — used for soft tinted surfaces. */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

export type CompanyIdentityRow = {
  logo_path?: string | null;
  cover_path?: string | null;
  tagline_en?: string | null;
  tagline_ar?: string | null;
  primary_hex?: string | null;
  secondary_hex?: string | null;
  accent_hex?: string | null;
} | null;

export const JADARAH_FALLBACK = { primary: "#172F49", secondary: "#3B66F6", accent: "#A9CBE5" } as const;

/** CSS custom properties for a company scope (JADARAH palette when the company has no branding). */
export function brandVars(identity: CompanyIdentityRow): Record<string, string> {
  const primary = sanitizeHex(identity?.primary_hex) ?? JADARAH_FALLBACK.primary;
  const secondary = sanitizeHex(identity?.secondary_hex) ?? JADARAH_FALLBACK.secondary;
  const accent = sanitizeHex(identity?.accent_hex) ?? JADARAH_FALLBACK.accent;
  return {
    "--brand": primary,
    "--brand-fg": readableOn(primary),
    "--brand-2": secondary,
    "--brand-2-fg": readableOn(secondary),
    "--brand-accent": accent,
    "--brand-soft": tint(primary, 0.9),
  };
}

/** Public URL of an identity image the organization published (public bucket `company-identity`). */
export function identityImageUrl(path: string | null | undefined): string | null {
  if (!path || !/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/.test(path)) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/company-identity/${path}` : null;
}
