import { ContentPage } from "@/features/landing/content-page";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "For candidates" };
export default async function ForCandidates() {
  const { t, locale } = await getI18n();
  const L = tx(locale);
  return (
    <ContentPage
      eyebrow={t.nav.forCandidates}
      title={t.landing.audiencesCandidatesTitle}
      intro={t.landing.audiencesCandidatesBody}
      sections={[
        {
          title: L("An evidence profile", "ملف مدعوم بالأدلة"),
          body: L(
            "Upload CV versions privately, review what's extracted, and attach evidence to each skill",
            "ارفع نسخ سيرتك بشكل خاص، وراجع ما يُستخرج، وأرفق دليلًا لكل مهارة",
          ),
        },
        {
          title: L("Understand every match", "افهم كل مطابقة"),
          body: L(
            "See exactly which requirements you meet, partially meet or miss — before you apply",
            "اعرف بالضبط ما تحققه من المتطلبات جزئيًا أو كليًا أو ما ينقصك — قبل التقديم",
          ),
        },
        {
          title: L("Show, don't tell", "أظهر ولا تكتفِ بالقول"),
          body: L(
            "Timed practical assessments with autosave. Results and explanations after submission",
            "تقييمات عملية محددة الوقت مع حفظ تلقائي. النتائج والشروح بعد التسليم",
          ),
        },
        {
          title: L("Grow on purpose", "تطوّر بهدف"),
          body: L(
            "Pick a target role and follow a plan built from verified learning resources",
            "اختر دورًا مستهدفًا واتبع خطة مبنية على مصادر تعلّم موثّقة",
          ),
        },
      ]}
      cta={[
        { href: "/sign-up?type=candidate", label: t.landing.closingCandidate },
        { href: "/jobs", label: L("Browse open jobs", "تصفّح الوظائف المتاحة") },
      ]}
    />
  );
}
