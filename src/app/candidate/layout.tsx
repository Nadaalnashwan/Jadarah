import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
import type { NavItem } from "@/components/shell/workspace-nav";
import { requireCandidate } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { groupRoutes } from "@/lib/nav-groups";

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCandidate();
  if (!session.profile.onboarding_completed) redirect("/onboarding/candidate");
  const { t, locale } = await getI18n();
  const n = t.candidate.nav;
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  // Main journey first (overview → jobs → companies), then the candidate's own progress, then profile & settings.
  // Grouped items show their related pages as tabs (lib/nav-groups.ts); no route or data was removed.
  const nav: NavItem[] = [
    { href: "/candidate", label: n.overview, icon: "LayoutDashboard", exact: true },
    { href: "/candidate/jobs", label: n.jobs, icon: "Search" },
    { href: "/candidate/companies", label: n.companies, icon: "Building2" },
    {
      href: "/candidate/applications",
      label: L("Applications & interviews", "طلباتي ومقابلاتي"),
      icon: "Send",
      also: groupRoutes("candidate-applications"),
    },
    { href: "/candidate/calendar", label: n.calendar, icon: "CalendarDays" },
    { href: "/candidate/assessments", label: n.assessments, icon: "ClipboardCheck" },
    {
      href: "/candidate/career",
      label: L("Career path", "مساري المهني"),
      icon: "Route",
      also: groupRoutes("candidate-career"),
    },
    { href: "/candidate/assistant", label: n.assistant, icon: "Bot" },
    {
      href: "/candidate/profile",
      label: L("Profile & CV", "ملفي وسيرتي"),
      icon: "UserRound",
      also: groupRoutes("candidate-profile"),
    },
    { href: "/candidate/settings", label: n.settings, icon: "Settings" },
  ];

  return (
    <WorkspaceShell session={session} nav={nav} area={t.roles.candidate}>
      {children}
    </WorkspaceShell>
  );
}
