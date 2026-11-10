import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/shell/preference-toggles";
import { requireSession } from "@/lib/auth/session";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { CompanyForm } from "@/features/company/company-form";

export default async function CompanyOnboarding() {
  const session = await requireSession("/onboarding/company");
  if (session.activeMembership) redirect("/company");
  if (session.profile.account_type !== "company") redirect("/");
  const { locale } = await getI18n();
  const L = tx(locale);
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6">
        <Logo />
        <LanguageSwitcher />
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 pb-20">
        <p className="eyebrow mb-3">{L("Company registration", "تسجيل الشركة")}</p>
        <h1 className="editorial text-4xl font-extrabold sm:text-5xl">
          {L("Tell us about your organisation.", "عرّفنا بمنشأتك.")}
        </h1>
        <p className="text-muted mt-3 max-w-xl">
          {L(
            "After registering, submit verification. A platform administrator reviews every company before it can publish jobs.",
            "بعد التسجيل، أرسل طلب التحقق. يراجع مسؤول المنصة كل شركة قبل أن تتمكن من نشر الوظائف.",
          )}
        </p>
        <div className="surface-card mt-8 p-6 sm:p-8">
          <CompanyForm mode="register" />
        </div>
      </main>
    </div>
  );
}
