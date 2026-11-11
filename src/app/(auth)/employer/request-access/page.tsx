import { redirect } from "next/navigation";
import { EmployerAccessForm } from "@/features/auth/employer-access-form";
import { getSession, homeFor } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Employer access" };

export default async function EmployerAccessPage() {
  const session = await getSession();
  if (session) redirect(homeFor(session));
  const supabase = await createClient();
  const { data } = await supabase.rpc("access_request_companies");
  return <EmployerAccessForm companies={data ?? []} />;
}
