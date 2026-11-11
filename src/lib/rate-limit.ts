import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { hasServerKey, serverEnv } from "@/lib/server-env";
import { rpcClient } from "@/lib/supabase/rpc-client";

/**
 * Fixed-window rate limiter.
 * - Shared backend (default when JADARAH_SERVER_KEY is set): one counter in Postgres
 *   (`internal_rate_limit`) for every app instance, so limits hold behind a load balancer.
 * - Fallback: per-instance memory counters with the SAME limits. Used when the shared store is not
 *   configured, slow (>1.5 s) or failing — requests are never let through unchecked.
 * Keys are hashed before leaving the process (no raw IPs or user ids stored).
 */
type Backend = "shared" | "memory";
const g = globalThis as typeof globalThis & {
  __jadarahRl?: Map<string, { count: number; reset: number }>;
  __jadarahRlDownUntil?: number;
  __jadarahRlLast?: Backend;
};
const buckets = (g.__jadarahRl ??= new Map());
const SHARED_TIMEOUT_MS = 1500;
const SHARED_BACKOFF_MS = 30_000;

export function memoryHit(id: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const b = buckets.get(id);
  if (!b || b.reset < now) {
    buckets.set(id, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export function hashKey(id: string): string {
  return "rl:" + createHash("sha256").update(id).digest("hex").slice(0, 40);
}

async function sharedHit(id: string, limit: number, windowMs: number): Promise<boolean | null> {
  if (!hasServerKey() || (g.__jadarahRlDownUntil ?? 0) > Date.now()) return null;
  try {
    const { data, error } = await rpcClient()
      .rpc("internal_rate_limit", {
        p_service_key: serverEnv.serverKey(),
        p_key: hashKey(id),
        p_limit: limit,
        p_window_seconds: Math.max(1, Math.round(windowMs / 1000)),
      })
      .abortSignal(AbortSignal.timeout(SHARED_TIMEOUT_MS));
    if (error || typeof data !== "boolean") throw new Error(error?.code ?? "invalid_response");
    return data;
  } catch (e) {
    g.__jadarahRlDownUntil = Date.now() + SHARED_BACKOFF_MS;
    console.warn(`[rate-limit] shared store unavailable, using per-instance limits for 30 s (${e instanceof Error ? e.message : "error"})`);
    return null;
  }
}

async function clientIp(): Promise<string> {
  // Outside a request (scripts, background jobs) there are no headers: key by "local".
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  } catch {
    return "local";
  }
}

async function hit(id: string, limit: number, windowMs: number): Promise<boolean> {
  const shared = await sharedHit(id, limit, windowMs);
  g.__jadarahRlLast = shared === null ? "memory" : "shared";
  return shared ?? memoryHit(id, limit, windowMs);
}

/** Per-IP limit (auth endpoints, public forms). */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  return hit(`${key}:${await clientIp()}`, limit, windowMs);
}

/** Per-user limit (AI calls, uploads). Not tied to IP so it follows the account across networks. */
export async function rateLimitUser(key: string, userId: string, limit: number, windowMs: number): Promise<boolean> {
  return hit(`${key}:u:${userId}`, limit, windowMs);
}

/** Which backend answered the most recent check (health endpoint). */
export function rateLimitBackend(): { configured: Backend; lastUsed: Backend | null } {
  return { configured: hasServerKey() ? "shared" : "memory", lastUsed: g.__jadarahRlLast ?? null };
}
