import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar, Badge } from "@/components/ui/primitives";
import { signOutAction } from "@/features/auth/actions";
import type { SessionContext } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { LanguageSwitcher, ThemeToggle } from "./preference-toggles";
import { WorkspaceNav, type NavItem } from "./workspace-nav";

export async function WorkspaceShell({
  session,
  nav,
  area,
  contextLabel,
  notificationsHref,
  banner,
  children,
}: {
  session: SessionContext;
  nav: NavItem[];
  area: string;
  contextLabel?: string;
  notificationsHref: string;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = await getI18n();
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.userId)
    .is("read_at", null);
  const unread = count ?? 0;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-e bg-surface lg:flex">
        <div className="flex h-20 items-center px-6">
          <Link href="/" aria-label="JADARAH home">
            <Logo />
          </Link>
        </div>
        <div className="px-6 pb-4">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-subtle rtl:tracking-normal">{area}</p>
          {contextLabel && <p className="mt-1 truncate text-sm font-semibold">{contextLabel}</p>}
        </div>
        <WorkspaceNav items={nav} />
        <div className="mt-auto border-t p-4">
          <div className="flex items-center gap-3">
            <Avatar name={session.profile.full_name || session.email} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{session.profile.full_name || session.email}</p>
              <p className="truncate text-xs text-subtle" dir="ltr">
                {session.email}
              </p>
            </div>
            <form action={signOutAction}>
              <button className="flex size-9 items-center justify-center rounded-full text-subtle hover:bg-surface-2 hover:text-foreground" aria-label={t.common.signOut}>
                <LogOut className="size-4 rtl:rotate-180" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b bg-background/85 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <WorkspaceNav items={nav} mobile />
            <Link href="/" aria-label="JADARAH home">
              <Logo compact />
            </Link>
          </div>
          <div className="hidden min-w-0 lg:block">
            {session.profile.is_demo && <Badge tone="accent">{t.common.demoBadge}</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link
              href={notificationsHref}
              className="relative flex size-9 items-center justify-center rounded-full hover:bg-surface-2"
              aria-label={`${t.common.notifications}${unread ? ` (${unread})` : ""}`}
            >
              <Bell className="size-4" />
              {unread > 0 && (
                <span className="ltr-nums absolute -end-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <form action={signOutAction} className="lg:hidden">
              <button className="flex size-9 items-center justify-center rounded-full hover:bg-surface-2" aria-label={t.common.signOut}>
                <LogOut className="size-4 rtl:rotate-180" />
              </button>
            </form>
          </div>
        </header>
        {banner}
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
