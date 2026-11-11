import "server-only";
import { randomUUID } from "node:crypto";

/**
 * Provider abstraction for outbound email. Business logic only sees `EmailProvider.send()`;
 * the provider is chosen by configuration:
 *   EMAIL_PROVIDER=smtp    → SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_SECURE
 *   EMAIL_PROVIDER=resend  → RESEND_API_KEY
 *   EMAIL_PROVIDER=log     → no delivery; logs a redacted line (local testing only, refused in production)
 *   unset                  → smtp if SMTP_HOST is set, resend if RESEND_API_KEY is set, else disabled
 * EMAIL_FROM (e.g. "JADARAH <no-reply@your-domain>") is required for real providers.
 */
export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Stable per outbox row: providers that support it use it to drop duplicate sends. */
  idempotencyKey: string;
  locale: "ar" | "en";
}

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; retryable: boolean };

export interface EmailProvider {
  name: "smtp" | "resend" | "log";
  send(mail: OutboundEmail): Promise<SendResult>;
}

export type EmailConfigStatus =
  | { configured: true; provider: EmailProvider["name"] }
  | { configured: false; provider: null; reason: string };

function from() {
  return process.env.EMAIL_FROM ?? "";
}

export function emailConfig(): EmailConfigStatus {
  const explicit = process.env.EMAIL_PROVIDER?.toLowerCase();
  const choice = explicit || (process.env.SMTP_HOST ? "smtp" : process.env.RESEND_API_KEY ? "resend" : "");
  if (!choice || choice === "disabled") return { configured: false, provider: null, reason: "no_provider" };
  if (choice === "log") {
    if (process.env.JADARAH_ENV === "production") return { configured: false, provider: null, reason: "log_provider_refused_in_production" };
    return { configured: true, provider: "log" };
  }
  if (!from()) return { configured: false, provider: null, reason: "email_from_missing" };
  if (choice === "smtp") return process.env.SMTP_HOST ? { configured: true, provider: "smtp" } : { configured: false, provider: null, reason: "smtp_host_missing" };
  if (choice === "resend") return process.env.RESEND_API_KEY ? { configured: true, provider: "resend" } : { configured: false, provider: null, reason: "resend_key_missing" };
  return { configured: false, provider: null, reason: "unknown_provider" };
}

// ---------------------------------------------------------------- SMTP
/** SMTP reply codes 4xx and connection problems are transient; 5xx is permanent. */
export function smtpRetryable(e: unknown): boolean {
  const err = e as { responseCode?: number; code?: string };
  if (typeof err?.responseCode === "number") return err.responseCode < 500;
  return ["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ECONNRESET", "ECONNREFUSED"].includes(err?.code ?? "ECONNECTION");
}

function smtpProvider(): EmailProvider {
  return {
    name: "smtp",
    async send(mail) {
      const nodemailer = await import("nodemailer");
      const port = Number(process.env.SMTP_PORT ?? 587);
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
      try {
        const info = await transport.sendMail({
          from: from(),
          replyTo: process.env.EMAIL_REPLY_TO || undefined,
          to: mail.to,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          // Deterministic Message-ID: a resend after a crash carries the same id (receivers can collapse it).
          messageId: `<${mail.idempotencyKey.replace(/[^a-zA-Z0-9.-]/g, ".")}@jadarah.mail>`,
          headers: { "X-Entity-Ref-ID": mail.idempotencyKey },
        });
        return { ok: true, messageId: String(info.messageId ?? "") };
      } catch (e) {
        const code = (e as { responseCode?: number; code?: string })?.responseCode ?? (e as { code?: string })?.code ?? "error";
        return { ok: false, error: `smtp_${String(code).toLowerCase()}`, retryable: smtpRetryable(e) };
      } finally {
        transport.close();
      }
    },
  };
}

// ---------------------------------------------------------------- Resend (HTTP API, no SDK)
function resendProvider(): EmailProvider {
  return {
    name: "resend",
    async send(mail) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            // Resend drops a second request with the same key (24 h) → no duplicate after a retry.
            "Idempotency-Key": mail.idempotencyKey.slice(0, 256),
          },
          body: JSON.stringify({
            from: from(),
            to: [mail.to],
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
            reply_to: process.env.EMAIL_REPLY_TO || undefined,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) {
          const j = (await res.json().catch(() => ({}))) as { id?: string };
          return { ok: true, messageId: j.id ?? "" };
        }
        return { ok: false, error: `resend_http_${res.status}`, retryable: res.status === 429 || res.status >= 500 };
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        return { ok: false, error: name === "TimeoutError" ? "resend_timeout" : "resend_network", retryable: true };
      }
    },
  };
}

// ---------------------------------------------------------------- log (mock for local testing)
function logProvider(): EmailProvider {
  return {
    name: "log",
    async send(mail) {
      // Recipient and content are not printed (privacy); only the outbox key and subject length.
      console.info(`[email:log] would send ${mail.idempotencyKey} (${mail.locale}, subject ${mail.subject.length} chars)`);
      return { ok: true, messageId: `log-${randomUUID()}` };
    },
  };
}

export function getEmailProvider(): EmailProvider | null {
  const c = emailConfig();
  if (!c.configured) return null;
  return c.provider === "smtp" ? smtpProvider() : c.provider === "resend" ? resendProvider() : logProvider();
}
