import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Daily.co webhook verification (docs.daily.co → REST API → Webhooks):
 *   signature = base64( HMAC-SHA256( key = base64decode(secret), `${X-Webhook-Timestamp}.${body}` ) )
 * compared with the X-Webhook-Signature header. Daily's reference code signs JSON.stringify(event),
 * so both the raw body and its canonical re-serialization are accepted (both are signed by the secret).
 */
export const MAX_SKEW_MS = 60 * 60_000; // Daily retries for ~13 min; replays are harmless (idempotent ingest).

function sign(secretB64: string, timestamp: string, body: string): Buffer {
  return createHmac("sha256", Buffer.from(secretB64, "base64")).update(`${timestamp}.${body}`).digest();
}

function equalB64(expected: Buffer, providedB64: string): boolean {
  let provided: Buffer;
  try {
    provided = Buffer.from(providedB64.trim(), "base64");
  } catch {
    return false;
  }
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function timestampMs(ts: string): number | null {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1e12 ? n : n * 1000; // seconds or milliseconds
}

export type VerifyResult = { ok: true } | { ok: false; reason: "not_configured" | "missing_headers" | "stale" | "bad_signature" };

export function verifyDailySignature(opts: {
  secret: string;
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
  now?: number;
}): VerifyResult {
  if (!opts.secret) return { ok: false, reason: "not_configured" };
  if (!opts.signature || !opts.timestamp) return { ok: false, reason: "missing_headers" };
  const ms = timestampMs(opts.timestamp);
  if (ms === null || Math.abs((opts.now ?? Date.now()) - ms) > MAX_SKEW_MS) return { ok: false, reason: "stale" };
  if (equalB64(sign(opts.secret, opts.timestamp, opts.rawBody), opts.signature)) return { ok: true };
  try {
    const canonical = JSON.stringify(JSON.parse(opts.rawBody));
    if (canonical !== opts.rawBody && equalB64(sign(opts.secret, opts.timestamp, canonical), opts.signature)) return { ok: true };
  } catch {
    // not JSON → cannot match the canonical form
  }
  return { ok: false, reason: "bad_signature" };
}

/** Test helper / documentation of the scheme. */
export function signDailyPayload(secret: string, timestamp: string, body: string): string {
  return sign(secret, timestamp, body).toString("base64");
}

export interface DailyEventFields {
  eventId: string | null;
  type: string;
  occurredAt: string;
  room: string | null;
  sessionId: string | null;
  userId: string | null;
  joinedAt: string | null;
  durationSeconds: number | null;
}

const isoFromSeconds = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null);

/** Extract only the fields we store. Unknown/extra payload data is ignored. */
export function parseDailyEvent(raw: unknown): DailyEventFields | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as { id?: unknown; type?: unknown; event_ts?: unknown; payload?: Record<string, unknown> };
  if (typeof e.type !== "string" || e.type.length > 60) return null;
  const p = e.payload ?? {};
  const joinedAt = isoFromSeconds(p.joined_at);
  const duration = typeof p.duration === "number" && Number.isFinite(p.duration) ? p.duration : null;
  const occurredAt =
    (e.type === "meeting.started" && isoFromSeconds(p.start_ts)) ||
    (e.type === "meeting.ended" && isoFromSeconds(p.end_ts)) ||
    (e.type === "participant.joined" && joinedAt) ||
    (e.type === "participant.left" && joinedAt && duration !== null && new Date(Date.parse(joinedAt) + duration * 1000).toISOString()) ||
    isoFromSeconds(e.event_ts) ||
    new Date().toISOString();
  const str = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 ? v.slice(0, max) : null);
  return {
    eventId: str(e.id, 150),
    type: e.type,
    occurredAt,
    room: str(p.room, 100),
    sessionId: str(p.session_id, 100),
    userId: str(p.user_id, 64),
    joinedAt,
    durationSeconds: duration,
  };
}
