"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  BookOpen,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  Clock,
  CreditCard,
  UserCheck,
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
  Compass,
  ScrollText,
  MailCheck,
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
  Activity,
  Compass,
  BarChart3,
  Bell,
  Bot,
  BookOpen,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  Clock,
  CreditCard,
  UserCheck,
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
  MailCheck,
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
  /** Other routes grouped under this item (shown as tabs on those pages); the item stays active there. */
  also?: string[];
}

function isActive(pathname: string, item: NavItem) {
  const under = (href: string) => pathname === href || pathname.startsWith(href + "/");
  if (item.exact) return pathname === item.href;
  return under(item.href) || (item.also ?? []).some(under);
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
                active ? "text-foreground" : "text-muted hover:bg-surface hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId={`nav-active-${layoutKey}`}
                  className="bg-tone-blue absolute inset-0 -z-0 rounded-xl"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              {active && (
                <span className="bg-primary absolute start-0 top-2 bottom-2 w-1 rounded-full" aria-hidden />
              )}
              <Icon className={cn("relative size-4", active && "text-primary dark:text-lavender")} />
              <span className="relative flex-1">{item.label}</span>
              {item.badge ? (
                <span className="ltr-nums bg-primary text-primary-foreground relative rounded-full px-1.5 text-[0.65rem] font-bold">
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
  // Drawer: Escape closes it and the page behind does not scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

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
              className="bg-sidebar fixed inset-y-0 start-0 z-50 flex w-[min(18rem,85vw)] flex-col py-4 shadow-2xl"
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
                  className="hover:bg-surface-2 flex size-10 items-center justify-center rounded-full"
                  aria-label="Close"
                  autoFocus
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
                <Items items={items} onNavigate={() => setOpen(false)} layoutKey="mobile" />
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
