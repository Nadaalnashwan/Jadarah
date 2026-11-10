import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Membership = Database["public"]["Tables"]["company_memberships"]["Row"] & {
  company: Pick<
    Database["public"]["Tables"]["company_profiles"]["Row"],
    "id" | "name_en" | "name_ar" | "status" | "slug" | "status_reason"
  > | null;
};

export interface SessionContext {
  userId: string;
  email: string;
  emailConfirmed: boolean;
  profile: Profile;
  roles: string[];
  isSuperAdmin: boolean;
  isCandidate: boolean;
  memberships: Membership[];
  activeMembership: Membership | null;
}

/** Resolve the signed-in user with roles from the database (never from client claims). Cached per request. */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [{ data: profile }, { data: roles }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase
      .from("company_memberships")
      .select("*, company:company_profiles(id, name_en, name_ar, status, slug, status_reason)")
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);
  if (!profile) return null;

  const roleList = (roles ?? []).map((r) => r.role as string);
  const ms = (memberships ?? []) as unknown as Membership[];
  return {
    userId: user.id,
    email: user.email ?? profile.email,
    emailConfirmed: Boolean(user.email_confirmed_at),
    profile,
    roles: roleList,
    isSuperAdmin: roleList.includes("super_admin") && profile.status === "active",
    isCandidate: roleList.includes("candidate"),
    memberships: ms,
    activeMembership: ms[0] ?? null,
  };
});

export async function requireSession(next?: string): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect(`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (session.profile.status !== "active") redirect("/account-suspended");
  return session;
}

export async function requireCandidate(): Promise<SessionContext> {
  const session = await requireSession("/candidate");
  if (!session.isCandidate) redirect(homeFor(session));
  return session;
}

export async function requireCompanyMember(
  roles?: Array<"company_admin" | "recruiter" | "interviewer">,
): Promise<SessionContext & { activeMembership: Membership }> {
  const session = await requireSession("/company");
  const m = session.activeMembership;
  if (!m) {
    if (session.profile.account_type === "company") redirect("/onboarding/company");
    redirect(homeFor(session));
  }
  if (roles && !roles.includes(m.role)) redirect("/company");
  return session as SessionContext & { activeMembership: Membership };
}

export async function requireSuperAdmin(): Promise<SessionContext> {
  const session = await requireSession("/admin");
  if (!session.isSuperAdmin) redirect(homeFor(session));
  return session;
}

export function homeFor(session: SessionContext): string {
  if (session.isSuperAdmin) return "/admin";
  if (session.activeMembership) return "/company";
  if (session.profile.account_type === "company") return "/onboarding/company";
  if (session.isCandidate) return session.profile.onboarding_completed ? "/candidate" : "/onboarding/candidate";
  return "/";
}

export function canRecruit(session: SessionContext): boolean {
  const role = session.activeMembership?.role;
  return role === "company_admin" || role === "recruiter";
}
