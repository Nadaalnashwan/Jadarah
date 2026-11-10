"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { safeNext } from "@/features/auth/schemas";

/**
 * Completes implicit-flow email links (#access_token=…&refresh_token=…). The session is set
 * through Supabase (which validates the tokens), then the user continues to `next`.
 * Invalid or missing tokens go to /sign-in — never a fake success.
 */
export default function ConfirmPage() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const search = new URLSearchParams(window.location.search);
    const next = safeNext(search.get("next"), "/onboarding");
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!access_token || !refresh_token) {
      window.location.replace(`/sign-in?link=${hash.get("error_code") === "otp_expired" ? "expired" : "invalid"}`);
      return;
    }
    getBrowserClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setFailed(true);
          window.location.replace("/sign-in?link=invalid");
        } else window.location.replace(next);
      });
  }, []);
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center" aria-busy={!failed}>
      <Loader2 className="text-primary size-8 animate-spin" aria-label="Loading" />
    </main>
  );
}
