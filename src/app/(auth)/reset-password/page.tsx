import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/features/auth/forms";
import { createClient } from "@/lib/supabase/server";
import { hasRecoverySession } from "@/lib/auth/recovery";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  // Only reachable with a fresh recovery session created by a reset link (/auth/callback or /auth/confirm).
  if (await hasRecoverySession(supabase)) return <ResetPasswordForm />;
  const { data } = await supabase.auth.getClaims();
  redirect(data?.claims?.sub ? "/" : "/sign-in?link=invalid");
}
