import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { CompanyMark } from "@/components/app/company-mark";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
import type { NavItem } from "@/components/shell/workspace-nav";
import { requireCompanyMember } from "@/lib/auth/session";
import { pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { groupRoutes } from "@/lib/nav-groups";

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCompanyMember();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const n = t.company.nav;
  const role = session.activeMembership.role;
  const company = session.activeMembership.company;
  // Employer journey: overview → jobs → applicants → assessments → interviews → analytics → assistant → company.
  // Grouped items show their related pages as tabs (lib/nav-groups.ts); every route and permission is unchanged.
  const all: (NavItem & { roles?: string[] })[] = [
    { href: "/company", label: n.overview, icon: "LayoutDashboard", exact: true },
    { href: "/company/jobs", label: n.jobs, icon: "Briefcase", roles: ["company_admin", "recruiter"] },
    {
      href: "/company/applications",
      label: n.applications,
      icon: "Send",
      roles: ["company_admin", "recruiter"],
    },
    {
      href: "/company/assessments",
      label: n.assessments,
      icon: "ClipboardCheck",
      roles: ["company_admin", "recruiter"],
    },
    {
      href: "/company/interviews",
      label: L("Interviews & calendar", "المقابلات والتقويم"),
      icon: "CalendarClock",
      also: groupRoutes("company-interviews"),
    },
    {
      href: "/company/analytics",
      label: n.analytics,
      icon: "BarChart3",
      roles: ["company_admin", "recruiter"],
    },
    {
      href: "/company/assistant",
      label: t.candidate.nav.assistant,
      icon: "Bot",
      roles: ["company_admin", "recruiter"],
    },
    {
      href: "/company/profile",
      label: L("Company & team", "الشركة والفريق"),
      icon: "Building2",
      roles: ["company_admin"],
      also: groupRoutes("company-organization"),
    },
    { href: "/company/settings", label: n.settings, icon: "Settings" },
  ];

  const nav = all.filter((i) => !i.roles || i.roles.includes(role));
  const status = company?.status;
  const banner =
    status && status !== "approved" ? (
      <div className="bg-warning-soft text-warning flex items-center gap-3 border-b px-4 py-3 text-sm sm:px-6">
        <AlertTriangle className="size-4 shrink-0" />
        <p className="flex-1">
          {status === "pending" &&
            L(
              "Your company is awaiting platform approval. You can prepare jobs as drafts; publishing unlocks after approval",
              "شركتك بانتظار اعتماد المنصة. يمكنك إعداد الوظائف كمسودات، ويتاح النشر بعد الاعتماد",
            )}
          {status === "info_requested" &&
            L("The platform team requested more information", "طلب فريق المنصة معلومات إضافية")}
          {status === "rejected" && L("Your registration was not approved", "لم يتم اعتماد تسجيلك")}
          {status === "suspended" &&
            L(
              "Your workspace is suspended. Published jobs were paused",
              "مساحة عملك معلّقة. أُوقفت الوظائف المنشورة",
            )}
        </p>
        {role === "company_admin" && (
          <Link href="/company/verification" className="font-semibold underline">
            {L("Verification", "التحقق")}
          </Link>
        )}
      </div>
    ) : null;
  return (
    <WorkspaceShell
      session={session}
      nav={nav}
      area={t.roles[role]}
      contextLabel={pick(company, "name", locale)}
      contextMark={company ? <CompanyMark company={company} size="sm" /> : undefined}
      banner={banner}
    >
      {children}
    </WorkspaceShell>
  );
}
