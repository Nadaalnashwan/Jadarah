import type { SupabaseClient } from "@supabase/supabase-js";

/** How long after opening a reset link the user may still set a new password. */
const RECOVERY_WINDOW_SECONDS = 60 * 60;

type AmrEntry = { method?: string; timestamp?: number };

/**
 * True only for a session created by a password-recovery link (Supabase records the
 * authentication method "recovery" in the JWT `amr` claim) and opened within the last hour.
 * A normal password or OTP sign-in never qualifies, so the reset form is not reachable
 * just by being signed in.
 */
export async function hasRecoverySession(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return false;
  const amr = (Array.isArray(claims.amr) ? claims.amr : []) as AmrEntry[];
  const now = Math.floor(Date.now() / 1000);
  return amr.some(
    (e) =>
      e?.method === "recovery" &&
      typeof e.timestamp === "number" &&
      now - e.timestamp <= RECOVERY_WINDOW_SECONDS,
  );
}
