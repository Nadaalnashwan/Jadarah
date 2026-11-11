import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
import type { NavItem } from "@/components/shell/workspace-nav";
import { requireCandidate } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCandidate();
  if (!session.profile.onboarding_completed) redirect("/onboarding/candidate");
  const { t } = await getI18n();
  const n = t.candidate.nav;
  const nav: NavItem[] = [
    { href: "/candidate", label: n.overview, icon: "LayoutDashboard", exact: true },
    { href: "/candidate/profile", label: n.profile, icon: "UserRound" },
    { href: "/candidate/cvs", label: n.cvs, icon: "FileText" },
    { href: "/candidate/companies", label: n.companies, icon: "Building2" },
    { href: "/candidate/jobs", label: n.jobs, icon: "Search" },
    { href: "/candidate/applications", label: n.applications, icon: "Send" },
    { href: "/candidate/interviews", label: n.interviews, icon: "CalendarClock" },
    { href: "/candidate/assessments", label: n.assessments, icon: "ClipboardCheck" },
    { href: "/candidate/skills", label: n.skills, icon: "Sparkles" },
    { href: "/candidate/career", label: n.career, icon: "Route" },
    { href: "/candidate/assistant", label: n.assistant, icon: "Bot" },
    { href: "/candidate/notifications", label: n.notifications, icon: "Bell" },
    { href: "/candidate/settings", label: n.settings, icon: "Settings" },
  ];
  return (
    <WorkspaceShell
      session={session}
      nav={nav}
      area={t.roles.candidate}
      notificationsHref="/candidate/notifications"
    >
      {children}
    </WorkspaceShell>
  );
}
