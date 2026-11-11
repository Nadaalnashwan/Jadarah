import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/shell/preference-toggles";
import { requireCandidate } from "@/lib/auth/session";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { CandidateOnboardingForm } from "./form";
import { CvFirstStep } from "./cv-step";

export default async function CandidateOnboarding({ searchParams }: { searchParams: Promise<{ cv?: string }> }) {
  const sp = await searchParams;
  const session = await requireCandidate();
  if (session.profile.onboarding_completed) redirect("/candidate");
  const { locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const [{ data: skills }, { data: cp }, { count: reviewed }, { count: cvSkills }] = await Promise.all([
    supabase.from("skills").select("id, name_en, name_ar, category:skill_categories(slug)").order("name_en"),
    supabase.from("candidate_profiles").select("*").eq("user_id", session.userId).maybeSingle(),
    supabase
      .from("candidate_documents")
      .select("id", { count: "exact", head: true })
      .eq("candidate_id", session.userId)
      .eq("kind", "cv")
      .eq("parse_status", "reviewed"),
    supabase.from("candidate_skills").select("id", { count: "exact", head: true }).eq("candidate_id", session.userId),
  ]);
  // CV first: shown until the candidate reviewed a CV or chose to continue manually.
  const showCvStep = !sp.cv && !reviewed;
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6">
        <Logo />
        <LanguageSwitcher />
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 pb-20">
        <p className="eyebrow mb-3">{L("Welcome", "أهلًا بك")}</p>
        <h1 className="editorial text-4xl font-extrabold sm:text-5xl">
          {L("Let's build your evidence profile.", "لنبنِ ملفك المدعوم بالأدلة.")}
        </h1>
        <p className="text-muted mt-3 max-w-xl">
          {L(
            "Start from your CV or fill in a few details. You can finish the rest later from your profile.",
            "ابدأ من سيرتك الذاتية أو أدخل بعض البيانات. يمكنك إكمال البقية لاحقًا من ملفك.",
          )}
        </p>
        {showCvStep ? (
          <CvFirstStep userId={session.userId} />
        ) : (
        <>
        {(sp.cv === "done" || reviewed) ? (
          <p className="bg-success-soft text-success mt-8 rounded-xl px-4 py-3 text-sm font-semibold">
            {L(
              "Your approved CV information is in your profile. Confirm the details below — no need to repeat anything.",
              "أصبحت معلومات سيرتك المعتمدة في ملفك. أكّد البيانات أدناه دون الحاجة لتكرار أي شيء.",
            )}
          </p>
        ) : null}
        <CandidateOnboardingForm
          existingSkills={cvSkills ?? 0}
          defaults={{
            full_name: session.profile.full_name,
            headline: cp?.headline ?? "",
            city: cp?.city ?? "",
            summary: cp?.summary ?? "",
            years_experience: cp?.years_experience ?? null,
          }}
          skills={(skills ?? []).map((s) => ({
            id: s.id,
            name: locale === "ar" ? s.name_ar : s.name_en,
            category: s.category?.slug ?? "",
          }))}
        />
        </>
        )}
      </main>
    </div>
  );
}
