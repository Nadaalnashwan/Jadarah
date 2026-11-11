/**
 * Navigation consolidation: related routes grouped under one sidebar item and shown as tabs on each of those pages.
 * The routes themselves are unchanged (deep links, permissions and data access stay exactly as they were).
 */
type Pair = [string, string];
export type NavGroup = keyof typeof NAV_GROUPS;

export const NAV_GROUPS = {
  /** Candidate: profile, CV versions and skills in one place ("My profile"). */
  "candidate-profile": {
    label: ["My profile sections", "أقسام ملفي"] as Pair,
    tabs: [
      { href: "/candidate/profile", label: ["Profile", "الملف الشخصي"] as Pair },
      { href: "/candidate/cvs", label: ["CVs", "السير الذاتية"] as Pair },
      { href: "/candidate/skills", label: ["Skills", "المهارات"] as Pair },
    ],
  },
  /** Candidate: applications and the interviews that belong to them. */
  "candidate-applications": {
    label: ["Applications sections", "أقسام الطلبات"] as Pair,
    tabs: [
      { href: "/candidate/applications", label: ["Applications", "الطلبات"] as Pair },
      { href: "/candidate/interviews", label: ["Interviews", "المقابلات"] as Pair },
    ],
  },
  /** Candidate: development plan and career-path exploration. */
  "candidate-career": {
    label: ["Career sections", "أقسام المسار المهني"] as Pair,
    tabs: [
      { href: "/candidate/career", label: ["My plan", "خطتي"] as Pair },
      { href: "/candidate/discover", label: ["Explore paths", "استكشف المسارات"] as Pair },
    ],
  },
  /** Company: interviews, the calendar view and the interviewer's own availability. */
  "company-interviews": {
    label: ["Interview sections", "أقسام المقابلات"] as Pair,
    tabs: [
      { href: "/company/interviews", label: ["Interviews", "المقابلات"] as Pair },
      { href: "/company/calendar", label: ["Calendar", "التقويم"] as Pair },
      { href: "/company/availability", label: ["My availability", "أوقات توفّري"] as Pair },
    ],
  },
  /** Company (admins): organization profile and team members. */
  "company-organization": {
    label: ["Company sections", "أقسام الشركة"] as Pair,
    tabs: [
      { href: "/company/profile", label: ["Company profile", "ملف الشركة"] as Pair },
      { href: "/company/team", label: ["Team", "الفريق"] as Pair },
    ],
  },
} as const;

/** Routes grouped under a sidebar item (keeps the item active on every tab). */
export const groupRoutes = (g: NavGroup) => NAV_GROUPS[g].tabs.map((t) => t.href).slice(1);
