import { redirect } from "next/navigation";
import { SignUpForm } from "@/features/auth/forms";
import { getSession, homeFor } from "@/lib/auth/session";

export const metadata = { title: "Sign up" };

/** Candidate registration. Employers request access instead (organizations are provisioned by JADARAH). */
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const sp = await searchParams;
  if (sp.type === "company") redirect("/employer/request-access");
  const session = await getSession();
  if (session) redirect(homeFor(session));
  return <SignUpForm />;
}
