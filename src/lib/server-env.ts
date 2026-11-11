import "server-only";

/**
 * Server-only configuration. None of these may ever use the NEXT_PUBLIC_ prefix
 * (enforced by tests/unit/env.test.ts and the CI secret scan).
 */
export const serverEnv = {
  /** Narrow credential for server-only RPCs (internal_*). Registered in the DB as a SHA-256 hash. */
  serverKey: () => process.env.JADARAH_SERVER_KEY ?? "",
  /** Bearer secret for scheduled jobs (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). */
  cronSecret: () => process.env.CRON_SECRET ?? "",
  /** Daily.co webhook HMAC secret (base64), the `hmac` value used when the webhook was created. */
  dailyWebhookSecret: () => process.env.DAILY_WEBHOOK_SECRET ?? "",
  environment: () => process.env.JADARAH_ENV ?? "local",
};

export function hasServerKey(): boolean {
  return serverEnv.serverKey().length >= 32;
}

/** Server-only variable names the app reads (documented in .env.example and DEPLOYMENT.md). */
export const SERVER_ONLY_VARIABLES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "JADARAH_SERVER_KEY",
  "CRON_SECRET",
  "DAILY_API_KEY",
  "DAILY_WEBHOOK_SECRET",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "OPENAI_API_KEY",
  "EMAIL_PROVIDER",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_SECURE",
  "RESEND_API_KEY",
  "DEMO_USER_PASSWORD",
  "SUPABASE_DB_URL",
] as const;
