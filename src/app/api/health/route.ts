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
      // Before migration 0029 the function does not exist (PGRST202); anything else (e.g. a timeout on a cold start)
      // says nothing about the schema, so it is reported as unknown rather than as an old schema.
      if (error.code === "PGRST202") schema = "pre-0029";
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
  // Task Solution Files need migrations 0029 (table, storage rules) and 0032 (solution kind + RPC). Probe the schema
  // without reading data: an anonymous zero-row request is refused by grants when the table exists.
  let taskSolutionFiles: "ready" | "missing_0029_and_0032" | "missing_0032" | "unknown" = "unknown";
  try {
    const r = await rpcClient()
      .from("assessment_answer_files")
      .select("kind")
      .limit(0) // a GET returning no rows: HEAD requests do not carry PostgREST errors
      .abortSignal(AbortSignal.timeout(3000));
    const code = r.error?.code ?? "";
    if (code === "PGRST205" || code === "42P01") taskSolutionFiles = "missing_0029_and_0032";
    else if (code === "42703" || /column .*kind/i.test(r.error?.message ?? "")) taskSolutionFiles = "missing_0032";
    // Anonymous callers have no SELECT grant: "permission denied" (42501) means table and column exist.
    else if (!r.error || code === "42501") taskSolutionFiles = "ready";
  } catch {
    taskSolutionFiles = "unknown";
  }
  // Question-level evaluation (migration 0033): AI evaluations table, probed the same way.
  let questionEvaluation: "ready" | "missing_0033" | "unknown" = "unknown";
  try {
    const r = await rpcClient().from("assessment_ai_evaluations").select("id").limit(0).abortSignal(AbortSignal.timeout(3000));
    const code = r.error?.code ?? "";
    if (code === "PGRST205" || code === "42P01") questionEvaluation = "missing_0033";
    else if (!r.error || code === "42501") questionEvaluation = "ready";
  } catch {
    questionEvaluation = "unknown";
  }
  // AI evaluation reliability (proposal 0034: persisted run states, database lock, explicit rejection). Optional.
  let aiReliability: "ready" | "not_applied" | "unknown" = "unknown";
  try {
    const r = await rpcClient().from("assessment_ai_runs").select("id").limit(0).abortSignal(AbortSignal.timeout(3000));
    const code = r.error?.code ?? "";
    if (code === "PGRST205" || code === "42P01") aiReliability = "not_applied";
    else if (!r.error || code === "42501") aiReliability = "ready";
  } catch {
    aiReliability = "unknown";
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
      database_schema: schema ?? "unknown",
      task_solution_files: taskSolutionFiles,
      question_evaluation: questionEvaluation,
      ai_evaluation_reliability: aiReliability,
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
