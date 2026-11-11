import { WorkspaceShell } from "@/components/shell/workspace-shell";
import type { NavItem } from "@/components/shell/workspace-nav";
import { requireSuperAdmin } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSuperAdmin();
  const { t } = await getI18n();
  const n = t.admin.nav;
  const nav: NavItem[] = [
    { href: "/admin", label: n.overview, icon: "Gauge", exact: true },
    { href: "/admin/companies", label: n.companies, icon: "Building2" },
    { href: "/admin/access-requests", label: n.accessRequests, icon: "UserCheck" },
    { href: "/admin/subscriptions", label: n.subscriptions, icon: "CreditCard" },
    { href: "/admin/users", label: n.users, icon: "Users" },
    { href: "/admin/jobs", label: n.jobs, icon: "Briefcase" },
    { href: "/admin/assessments", label: n.assessments, icon: "ClipboardCheck" },
    { href: "/admin/resources", label: n.resources, icon: "GraduationCap" },
    { href: "/admin/reports", label: n.reports, icon: "BarChart3" },
    { href: "/admin/monitoring", label: n.ai, icon: "Activity" },
    { href: "/admin/audit", label: n.audit, icon: "ScrollText" },
    { href: "/admin/emails", label: n.emails, icon: "MailCheck" },
    { href: "/admin/settings", label: n.settings, icon: "Settings" },
    { href: "/admin/demo", label: n.demo, icon: "FlaskConical" },
    { href: "/admin/notifications", label: t.common.notifications, icon: "Bell" },
  ];
  return (
    <WorkspaceShell
      session={session}
      nav={nav}
      area={t.roles.super_admin}
      notificationsHref="/admin/notifications"
    >
      {children}
    </WorkspaceShell>
  );
}
