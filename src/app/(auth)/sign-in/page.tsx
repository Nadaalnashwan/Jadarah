import { redirect } from "next/navigation";
import { SignInForm } from "@/features/auth/forms";
import { getSession, homeFor } from "@/lib/auth/session";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; link?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (session && !sp.link) redirect(homeFor(session));
  return <SignInForm next={sp.next} linkError={sp.link} />;
}
