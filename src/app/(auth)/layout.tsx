import Link from "next/link";
import { BrandPattern, Logo } from "@/components/brand/logo";
import { SignatureLayers } from "@/components/brand/signature-layers";
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
      <aside className="relative hidden overflow-hidden bg-[var(--navy-800)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_70%_35%,rgb(59_108_255/0.35),transparent_70%),radial-gradient(40%_35%_at_20%_80%,rgb(169_184_255/0.25),transparent_70%)]" />
        <p className="relative text-sm font-semibold text-[var(--sky)]">{t.brand.tagline}</p>
        <SignatureLayers className="relative mx-auto w-full max-w-md" />
        <div className="relative">
          <p className="editorial max-w-md text-3xl font-extrabold">{L("You are more than your CV says.", "أنت أكثر مما تقوله سيرتك.")}</p>
          <BrandPattern className="mt-10 h-14 w-full text-[var(--sky)]" count={10} />
        </div>
      </aside>
    </div>
  );
}
