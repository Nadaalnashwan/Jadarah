import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time string comparison (hashes first so lengths never leak). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

/** `Authorization: Bearer <secret>` check for scheduled jobs. A missing secret never authorizes. */
export function bearerAuthorized(header: string | null, secret: string): boolean {
  if (!secret || secret.length < 16 || !header?.startsWith("Bearer ")) return false;
  return safeEqual(header.slice(7), secret);
}
