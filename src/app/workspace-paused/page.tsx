import { redirect } from "next/navigation";
import { PauseCircle } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/shell/preference-toggles";
import { requireSession } from "@/lib/auth/session";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

/** Employer membership exists but the organization's service is not active (data is preserved). */
export default async function WorkspacePaused() {
  const session = await requireSession("/workspace-paused");
  if (!session.activeMembership) redirect("/onboarding/company");
  if (session.serviceActive) redirect("/company");
  const { locale } = await getI18n();
  const L = tx(locale);
  const c = session.activeMembership.company;
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-xl items-center justify-between px-4 py-6">
        <Logo />
        <LanguageSwitcher />
      </header>
      <main id="main" className="mx-auto max-w-xl px-4 pb-20">
        <div className="surface-card flex flex-col items-center gap-3 p-8 text-center">
          <span className="ink text-primary-ink flex size-14 items-center justify-center rounded-2xl">
            <PauseCircle className="size-7" />
          </span>
          <h1 className="text-2xl font-extrabold">{L("Workspace access paused", "الوصول إلى مساحة العمل موقوف")}</h1>
          <p className="text-muted">{c ? (locale === "ar" ? c.name_ar : c.name_en) : ""}</p>
          <p className="text-muted text-sm">{L("Contact JADARAH to reactivate the subscription", "تواصل مع جدارة لإعادة تفعيل الاشتراك")}</p>
        </div>
      </main>
    </div>
  );
}
