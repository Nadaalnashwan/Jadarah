import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Membership = Database["public"]["Tables"]["company_memberships"]["Row"] & {
  company: Pick<
    Database["public"]["Tables"]["company_profiles"]["Row"],
    "id" | "name_en" | "name_ar" | "status" | "slug" | "status_reason" | "sector_en" | "sector_ar" | "organization_type"
  > & {
    company_brand_profiles?: { identity_status: string; usage_permission: string; logo_source_url: string | null; primary_hex: string | null } | null;
    company_identity?: { logo_path: string | null; primary_hex: string | null; secondary_hex: string | null; accent_hex: string | null } | null;
  } | null;
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
  /** Active membership's organization is approved AND has an active, in-date subscription. */
  serviceActive: boolean;
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
      .select(
        "*, company:company_profiles(id, name_en, name_ar, status, slug, status_reason, sector_en, sector_ar, organization_type, company_brand_profiles(identity_status, usage_permission, logo_source_url, primary_hex), company_identity(logo_path, primary_hex, secondary_hex, accent_hex))",
      )
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);
  if (!profile) return null;

  const roleList = (roles ?? []).map((r) => r.role as string);
  const ms = (memberships ?? []) as unknown as Membership[];
  const serviceActive = ms[0]
    ? Boolean((await supabase.rpc("company_service_active", { p_company: ms[0].company_id })).data)
    : false;
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
    serviceActive,
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
  // Paid employer services need an approved organization with an active subscription
  // (also enforced in the database for every employer query and RPC).
  if (!session.serviceActive) redirect("/workspace-paused");
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
  if (session.activeMembership) return session.serviceActive ? "/company" : "/workspace-paused";
  if (session.profile.account_type === "company") return "/onboarding/company";
  if (session.isCandidate)
    return session.profile.onboarding_completed ? "/candidate" : "/onboarding/candidate";
  return "/";
}

export function canRecruit(session: SessionContext): boolean {
  const role = session.activeMembership?.role;
  return role === "company_admin" || role === "recruiter";
}
