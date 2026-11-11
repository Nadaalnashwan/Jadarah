import "server-only";
import { after } from "next/server";
import { publicEnv } from "@/lib/env";
import { hasServerKey, serverEnv } from "@/lib/server-env";
import { rpcClient } from "@/lib/supabase/rpc-client";
import { emailConfig, getEmailProvider, type EmailProvider } from "./provider";
import { renderEmail, type Locale } from "./templates";

export interface DispatchSummary {
  status: "ok" | "skipped";
  reason?: string;
  claimed: number;
  sent: number;
  retrying: number;
  failed: number;
}

/**
 * Deliver due emails from public.email_outbox.
 * - Claiming uses a 2-minute lease with SKIP LOCKED, so parallel workers never send the same row.
 * - Each row has a stable idempotency key (Resend Idempotency-Key / deterministic SMTP Message-ID).
 * - Transient failures are re-queued with exponential backoff (1, 2, 4 … 60 min, 5 attempts);
 *   permanent failures stop and are shown to Super Admins (/admin/notifications).
 * Without a provider or server key nothing is claimed: emails stay queued until configured.
 */
export async function dispatchEmails(opts: { limit?: number; provider?: EmailProvider } = {}): Promise<DispatchSummary> {
  const empty = { claimed: 0, sent: 0, retrying: 0, failed: 0 };
  const provider = opts.provider ?? getEmailProvider();
  if (!provider) {
    const c = emailConfig();
    return { status: "skipped", reason: c.configured ? "unknown" : c.reason, ...empty };
  }
  if (!hasServerKey()) return { status: "skipped", reason: "server_key_missing", ...empty };
  const db = rpcClient();
  const key = serverEnv.serverKey();
  const { data: rows, error } = await db.rpc("internal_claim_emails", { p_service_key: key, p_limit: opts.limit ?? 20 });
  if (error) return { status: "skipped", reason: `claim_failed_${error.code ?? "error"}`, ...empty };

  const summary: DispatchSummary = { status: "ok", ...empty, claimed: rows?.length ?? 0 };
  for (const row of rows ?? []) {
    const locale: Locale = row.locale === "en" ? "en" : "ar";
    const rendered = renderEmail(row.template, locale, row.payload, publicEnv.siteUrl);
    const result = rendered
      ? await provider.send({ to: row.recipient_email, idempotencyKey: row.idempotency_key, locale, ...rendered })
      : ({ ok: false, error: "unknown_template", retryable: false } as const);
    const { data: state } = await db.rpc("internal_complete_email", {
      p_service_key: key,
      p_id: row.id,
      p_ok: result.ok,
      p_provider: provider.name,
      p_message_id: result.ok ? result.messageId : null,
      p_error: result.ok ? null : result.error,
      p_retryable: result.ok ? false : result.retryable,
    });
    if (state === "sent") summary.sent++;
    else if (state === "queued") summary.retrying++;
    else if (state === "failed") summary.failed++;
  }
  if (summary.claimed) console.info(`[email] claimed ${summary.claimed} sent ${summary.sent} retrying ${summary.retrying} failed ${summary.failed} via ${provider.name}`);
  return summary;
}

/**
 * Deliver right after the current response (so invitations and interview emails go out within
 * seconds instead of waiting for the scheduled job). Safe to call from any Server Action.
 */
export function kickEmailDispatch(): void {
  if (!emailConfig().configured || !hasServerKey()) return;
  try {
    after(async () => {
      await dispatchEmails({ limit: 10 }).catch(() => undefined);
    });
  } catch {
    // Outside a request scope (scripts): the scheduled job delivers instead.
  }
}
