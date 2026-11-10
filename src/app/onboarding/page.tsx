import { redirect } from "next/navigation";
import { homeFor, requireSession } from "@/lib/auth/session";

/** Post-confirmation router: sends each user to the right place based on database roles. */
export default async function OnboardingRouter() {
  const session = await requireSession("/onboarding");
  redirect(homeFor(session));
}
