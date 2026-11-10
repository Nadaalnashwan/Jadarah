import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import type { Messages } from "@/lib/i18n/messages";

export function SiteFooter({ t, contactEmail }: { t: Messages; contactEmail?: string | null }) {
  const year = new Date().getFullYear();
  const cols = [
    {
      title: t.nav.product,
      links: [
        { href: "/how-it-works", label: t.nav.howItWorks },
        { href: "/for-companies", label: t.nav.forCompanies },
        { href: "/for-candidates", label: t.nav.forCandidates },
      ],
    },
    {
      title: t.nav.about,
      links: [
        { href: "/about", label: t.nav.about },
        { href: "/privacy", label: t.landing.footerPrivacy },
        { href: "/terms", label: t.landing.footerTerms },
      ],
    },
  ];
  return (
    <footer className="bg-surface border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="text-muted mt-4 max-w-xs text-sm">{t.brand.tagline}</p>
          {contactEmail && (
            <p className="mt-4 text-sm">
              <span className="text-subtle">{t.landing.footerContact}: </span>
              <a
                className="text-primary dark:text-lavender font-semibold hover:underline"
                href={`mailto:${contactEmail}`}
              >
                {contactEmail}
              </a>
            </p>
          )}
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h2 className="text-sm font-bold">{c.title}</h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted hover:text-foreground text-sm transition">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="text-subtle mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs sm:flex-row sm:justify-between sm:px-6">
          <p>
            © <span className="ltr-nums">{year}</span> JADARAH · جدارة. {t.landing.footerRights}
          </p>
          <p>{t.landing.footerNote}</p>
        </div>
      </div>
    </footer>
  );
}
