"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { LanguageSwitcher, ThemeToggle } from "./preference-toggles";

export function SiteHeader({ dashboardHref }: { dashboardHref?: string | null }) {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "/#product", label: t.nav.product },
    { href: "/how-it-works", label: t.nav.howItWorks },
    { href: "/for-companies", label: t.nav.forCompanies },
    { href: "/for-candidates", label: t.nav.forCandidates },
    { href: "/about", label: t.nav.about },
  ];

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background,box-shadow,backdrop-filter] duration-300",
        scrolled || open
          ? "bg-background/85 shadow-[0_1px_0_var(--border)] backdrop-blur-xl"
          : "bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-20">
        <Link href="/" className="shrink-0" aria-label="JADARAH home">
          <Logo />
        </Link>
        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="group relative rounded-full px-3.5 py-2 text-sm font-semibold text-muted transition hover:text-foreground"
              >
                {l.label}
                <span className="absolute inset-x-3.5 -bottom-0.5 h-px origin-center scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-1 lg:flex">
          <LanguageSwitcher />
          <ThemeToggle />
          {dashboardHref ? (
            <Button asChild size="md">
              <Link href={dashboardHref}>{t.nav.dashboard}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/sign-in">{t.nav.signIn}</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">{t.nav.getStarted}</Link>
              </Button>
            </>
          )}
        </div>
        <button
          className="inline-flex size-10 items-center justify-center rounded-full hover:bg-surface-2 lg:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? t.common.close : "Menu"}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t lg:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4">
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-base font-semibold hover:bg-surface-2">
                  {l.label}
                </Link>
              ))}
              <div className="mt-2 flex items-center gap-2">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {dashboardHref ? (
                  <Button asChild className="col-span-2">
                    <Link href={dashboardHref}>{t.nav.dashboard}</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline">
                      <Link href="/sign-in">{t.nav.signIn}</Link>
                    </Button>
                    <Button asChild>
                      <Link href="/sign-up">{t.nav.getStarted}</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
