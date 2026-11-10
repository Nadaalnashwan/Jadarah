import { redirect } from "next/navigation";
import { SignUpForm } from "@/features/auth/forms";
import { getSession, homeFor } from "@/lib/auth/session";

export const metadata = { title: "Sign up" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const sp = await searchParams;
  const session = await getSession();
  if (session) redirect(homeFor(session));
  return <SignUpForm initialType={sp.type === "company" ? "company" : "candidate"} />;
}
