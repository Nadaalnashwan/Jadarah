import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/shell/preference-toggles";
import { requireCandidate } from "@/lib/auth/session";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { CandidateOnboardingForm } from "./form";

export default async function CandidateOnboarding() {
  const session = await requireCandidate();
  if (session.profile.onboarding_completed) redirect("/candidate");
  const { locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const [{ data: skills }, { data: cp }] = await Promise.all([
    supabase.from("skills").select("id, name_en, name_ar, category:skill_categories(slug)").order("name_en"),
    supabase.from("candidate_profiles").select("*").eq("user_id", session.userId).maybeSingle(),
  ]);
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6">
        <Logo />
        <LanguageSwitcher />
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 pb-20">
        <p className="eyebrow mb-3">{L("Welcome", "أهلًا بك")}</p>
        <h1 className="editorial text-4xl font-extrabold sm:text-5xl">{L("Let's build your evidence profile.", "لنبنِ ملفك المدعوم بالأدلة.")}</h1>
        <p className="mt-3 max-w-xl text-muted">
          {L("Three quick steps. You can save and finish the rest later from your profile.", "ثلاث خطوات سريعة. يمكنك الحفظ وإكمال البقية لاحقًا من ملفك.")}
        </p>
        <CandidateOnboardingForm
          defaults={{ full_name: session.profile.full_name, headline: cp?.headline ?? "", city: cp?.city ?? "", summary: cp?.summary ?? "" }}
          skills={(skills ?? []).map((s) => ({ id: s.id, name: locale === "ar" ? s.name_ar : s.name_en, category: s.category?.slug ?? "" }))}
        />
      </main>
    </div>
  );
}
