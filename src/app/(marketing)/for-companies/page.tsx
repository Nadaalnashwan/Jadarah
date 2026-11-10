import { ContentPage } from "@/features/landing/content-page";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "For companies" };
export default async function ForCompanies() {
  const { t, locale } = await getI18n();
  const L = tx(locale);
  return (
    <ContentPage
      eyebrow={t.nav.forCompanies}
      title={t.landing.audiencesCompaniesTitle}
      intro={t.landing.audiencesCompaniesBody}
      sections={[
        {
          title: L("Verified workspace", "مساحة عمل موثّقة"),
          body: L(
            "Register, submit verification and get approved by the platform team before publishing.",
            "سجّل، وأرسل التحقق، واحصل على اعتماد فريق المنصة قبل النشر.",
          ),
        },
        {
          title: L("Structured jobs", "وظائف منظّمة"),
          body: L(
            "Bilingual posts with required and preferred skills at minimum levels — the basis for explainable matching.",
            "إعلانات ثنائية اللغة بمهارات مطلوبة ومفضّلة بمستويات دنيا — أساس المطابقة القابلة للتفسير.",
          ),
        },
        {
          title: L("Practical assessments", "تقييمات عملية"),
          body: L(
            "Use 15 library assessments or build your own: auto-scored objective items, rubric-reviewed open work.",
            "استخدم 15 تقييمًا من المكتبة أو ابنِ تقييمك: بنود موضوعية تُصحَّح آليًا وأعمال مفتوحة تُراجع بالمعايير.",
          ),
        },
        {
          title: L("Fair, auditable decisions", "قرارات منصفة قابلة للتدقيق"),
          body: [
            L("Requirement-by-requirement comparison", "مقارنة متطلبًا بمتطلب"),
            L("Shortlist before interview — enforced", "القائمة المختصرة قبل المقابلة — إلزامي"),
            L("Confidential interviewer evaluations", "تقييمات سرية للمُقابِلين"),
            L("Every status change recorded", "تسجيل كل تغيير في الحالة"),
          ],
        },
      ]}
      cta={[{ href: "/sign-up?type=company", label: t.landing.closingCompany }]}
    />
  );
}
