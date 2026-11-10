import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/features/auth/forms";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  // Only reachable with the recovery session created by /auth/callback.
  if (!data.user) redirect("/sign-in?link=invalid");
  return <ResetPasswordForm />;
}
