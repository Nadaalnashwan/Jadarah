import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { getSession, homeFor } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { getPlatformContact } from "@/services/showcase";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [{ t }, session, contact] = await Promise.all([getI18n(), getSession(), getPlatformContact()]);
  return (
    <>
      <SiteHeader dashboardHref={session ? homeFor(session) : null} />
      <main id="main">{children}</main>
      <SiteFooter t={t} contactEmail={contact} />
    </>
  );
}
