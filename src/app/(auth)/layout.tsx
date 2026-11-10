import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SignatureLayers } from "@/components/brand/signature-layers";
import { LanguageSwitcher, ThemeToggle } from "@/components/shell/preference-toggles";
import { getI18n } from "@/lib/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
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
      <aside className="relative hidden overflow-hidden bg-navy p-12 text-ivory lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(var(--ivory)_1px,transparent_1px),linear-gradient(90deg,var(--ivory)_1px,transparent_1px)] [background-size:48px_48px]" />
        <p className="eyebrow relative !text-lavender">{t.brand.tagline}</p>
        <SignatureLayers labels={t.landing.layers} className="relative mx-auto aspect-[52/46] w-full max-w-lg" />
        <p className="editorial relative max-w-md text-3xl font-extrabold">{t.landing.closingTitle}</p>
      </aside>
    </div>
  );
}
