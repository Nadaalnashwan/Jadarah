import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { PortalField } from "@/components/brand/portal-art";
import { LanguageSwitcher, ThemeToggle } from "@/components/shell/preference-toggles";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t, locale } = await getI18n();
  const L = tx(locale);
  return (
    <div className="brand-hero-bg grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="JADARAH home">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          {children}
        </main>
      </div>
      <aside className="ink ink-aura relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between">

        <p className="relative text-sm font-semibold text-[var(--sky)]">{t.brand.tagline}</p>
        <PortalField className="relative mx-auto w-full max-w-lg" />
        <div className="relative">
          <p className="editorial max-w-md text-3xl font-extrabold">{L("You are more than your CV says", "أنت أكثر مما تقوله سيرتك")}</p>
        </div>
      </aside>
    </div>
  );
}
