import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/features/auth/schemas";

/**
 * Handles Supabase email links:
 *  - PKCE:        ?code=...                       (default for @supabase/ssr)
 *  - token hash:  ?token_hash=...&type=signup|recovery|email_change|invite
 *  - implicit:    #access_token=...  (links generated outside a browser session, e.g. admin-triggered
 *                 recovery). Fragments never reach the server, so those go to /auth/confirm, a client
 *                 page that reads the fragment; browsers carry the fragment across the redirect.
 * On failure the user lands on /sign-in with an explanatory flag — never a fake success.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"), "/onboarding");
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }

  const target = url.clone();
  target.search = "";
  if (!code && !tokenHash && !url.searchParams.get("error_code")) {
    target.pathname = "/auth/confirm";
    target.searchParams.set("next", next);
    return NextResponse.redirect(target);
  }
  if (ok) {
    target.pathname = next;
    return NextResponse.redirect(target);
  }
  // The email may already be confirmed by Supabase even if the code exchange failed
  // (e.g. link opened in a different browser): ask the user to sign in.
  target.pathname = "/sign-in";
  target.searchParams.set(
    "link",
    url.searchParams.get("error_code") === "otp_expired" ? "expired" : "invalid",
  );
  return NextResponse.redirect(target);
}
