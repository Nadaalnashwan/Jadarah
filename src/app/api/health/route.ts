import { NextResponse } from "next/server";
import { publicEnv } from "@/lib/env";
import { rateLimitBackend } from "@/lib/rate-limit";
import { hasServerKey, serverEnv } from "@/lib/server-env";
import { rpcClient } from "@/lib/supabase/rpc-client";
import { aiStatus } from "@/services/ai/provider";
import { dailyConfigured } from "@/services/daily";
import { emailConfig } from "@/services/email/provider";

export const dynamic = "force-dynamic";

/**
 * Operational health. Reports only whether things are configured/reachable — never values,
 * keys, model credentials or user data. 200 when the database answers, 503 otherwise.
 */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "error" = "error";
  let schema: string | null = null;
  try {
    const { data, error } = await rpcClient().rpc("health_ping").abortSignal(AbortSignal.timeout(3000));
    if (!error) {
      database = "ok";
      schema = (data as { schema?: string } | null)?.schema ?? null;
    } else {
      // Before migration 0029: fall back to a public read.
      const r = await rpcClient().from("skills").select("id", { head: true, count: "exact" }).abortSignal(AbortSignal.timeout(3000));
      if (!r.error) database = "ok";
    }
  } catch {
    database = "error";
  }
  let auth: "ok" | "error" = "error";
  try {
    const r = await fetch(`${publicEnv.supabaseUrl}/auth/v1/health`, {
      headers: { apikey: publicEnv.supabaseKey },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    auth = r.ok ? "ok" : "error";
  } catch {
    auth = "error";
  }
  const ai = aiStatus();
  const email = emailConfig();
  const body = {
    status: database === "ok" && auth === "ok" ? "ok" : "degraded",
    time: new Date().toISOString(),
    latency_ms: Date.now() - started,
    environment: serverEnv.environment(),
    commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || null,
    checks: {
      database,
      database_schema: schema ?? "pre-0029",
      auth,
      server_key: hasServerKey() ? "configured" : "missing",
      rate_limit: rateLimitBackend().configured,
      email: email.configured ? email.provider : `not_configured (${email.reason})`,
      ai: { configured: ai.configured, providers: ai.providers.filter((p) => p.configured).map((p) => p.name) },
      video: dailyConfigured() ? "configured" : "not_configured",
      video_webhooks: serverEnv.dailyWebhookSecret() ? "configured" : "not_configured",
    },
  };
  return NextResponse.json(body, { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
