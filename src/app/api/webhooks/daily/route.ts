import { NextResponse, type NextRequest } from "next/server";
import { hasServerKey, serverEnv } from "@/lib/server-env";
import { rpcClient } from "@/lib/supabase/rpc-client";
import { parseDailyEvent, verifyDailySignature } from "@/services/daily-webhook";

export const dynamic = "force-dynamic";

/**
 * Daily.co meeting lifecycle webhook. Nothing in an unverified request is trusted or stored.
 * Verified events go to public.internal_ingest_daily_event (server key), which is idempotent and
 * order-independent. Daily expects a 200 within 8 s; processing is a single RPC.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 64_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const verdict = verifyDailySignature({
    secret: serverEnv.dailyWebhookSecret(),
    signature: req.headers.get("x-webhook-signature"),
    timestamp: req.headers.get("x-webhook-timestamp"),
    rawBody: raw,
  });
  if (!verdict.ok) {
    const status = verdict.reason === "not_configured" ? 503 : 401;
    return NextResponse.json({ error: verdict.reason }, { status });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  // Verification request Daily sends when the webhook is created or re-activated.
  if (body && typeof body === "object" && (body as { test?: unknown }).test === "test") return NextResponse.json({ ok: true });

  const ev = parseDailyEvent(body);
  if (!ev) return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  if (!hasServerKey()) return NextResponse.json({ error: "server_key_missing" }, { status: 503 });

  const { data, error } = await rpcClient().rpc("internal_ingest_daily_event", {
    p_service_key: serverEnv.serverKey(),
    p_event_id: ev.eventId ?? "",
    p_type: ev.type,
    p_occurred_at: ev.occurredAt,
    p_room: ev.room,
    p_session_id: ev.sessionId,
    p_user_id: ev.userId,
    p_joined_at: ev.joinedAt,
    p_duration_seconds: ev.durationSeconds,
  });
  if (error) {
    console.warn(`[daily-webhook] ingest failed (${error.code ?? "error"})`);
    return NextResponse.json({ error: "ingest_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, outcome: data });
}
