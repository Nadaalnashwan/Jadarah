"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  Bell,
  Bot,
  BookOpen,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  Clock,
  ClipboardCheck,
  Cpu,
  FileText,
  FlaskConical,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Menu,
  Route,
  ScrollText,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";

const ICONS = {
  BarChart3,
  Bell,
  Bot,
  BookOpen,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  Clock,
  ClipboardCheck,
  Cpu,
  FileText,
  FlaskConical,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Route,
  ScrollText,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} as const;
export type IconName = keyof typeof ICONS;
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  badge?: number;
}

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

function Items({
  items,
  onNavigate,
  layoutKey,
}: {
  items: NavItem[];
  onNavigate?: () => void;
  layoutKey: string;
}) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-0.5 px-3">
      {items.map((item) => {
        const active = isActive(pathname, item);
        const Icon = ICONS[item.icon];
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active ? "text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId={`nav-active-${layoutKey}`}
                  className="bg-accent-soft absolute inset-0 -z-0 rounded-xl"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              {active && (
                <span className="bg-primary absolute start-0 top-2 bottom-2 w-1 rounded-full" aria-hidden />
              )}
              <Icon className={cn("relative size-4", active && "text-primary dark:text-lavender")} />
              <span className="relative flex-1">{item.label}</span>
              {item.badge ? (
                <span className="ltr-nums bg-primary relative rounded-full px-1.5 text-[0.65rem] font-bold text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function WorkspaceNav({ items, mobile }: { items: NavItem[]; mobile?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [pathname]);

  if (!mobile) {
    return (
      <nav aria-label="Workspace" className="flex-1 overflow-y-auto">
        <Items items={items} layoutKey="desktop" />
      </nav>
    );
  }
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hover:bg-surface-2 flex size-9 items-center justify-center rounded-full"
        aria-label="Menu"
        aria-expanded={open}
      >
        <Menu className="size-5" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="bg-navy/40 fixed inset-0 z-50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.nav
              aria-label="Workspace"
              className="bg-surface fixed inset-y-0 start-0 z-50 flex w-72 flex-col py-4 shadow-2xl"
              initial={{ x: "var(--drawer-from)" }}
              animate={{ x: 0 }}
              exit={{ x: "var(--drawer-from)" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              style={{
                ["--drawer-from" as string]:
                  typeof document !== "undefined" && document.dir === "rtl" ? "100%" : "-100%",
              }}
            >
              <div className="mb-3 flex justify-end px-3">
                <button
                  onClick={() => setOpen(false)}
                  className="hover:bg-surface-2 flex size-9 items-center justify-center rounded-full"
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              </div>
              <Items items={items} onNavigate={() => setOpen(false)} layoutKey="mobile" />
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
