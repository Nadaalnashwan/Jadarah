import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort fixed-window limiter (per server instance). Supabase Auth applies its own
 * project-level limits; this adds a cheap first line of defence for auth and AI endpoints.
 * For multi-instance production deployments, back this with a shared store (e.g. Upstash).
 */
const buckets = new Map<string, { count: number; reset: number }>();

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const id = `${key}:${ip}`;
  const now = Date.now();
  const b = buckets.get(id);
  if (!b || b.reset < now) {
    buckets.set(id, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export async function rateLimitUser(
  key: string,
  userId: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  return rateLimit(`${key}:${userId}`, limit, windowMs);
}
