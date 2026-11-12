import { ContentPage } from "@/features/landing/content-page";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Terms" };
export default async function Terms() {
  const { locale } = await getI18n();
  const L = tx(locale);
  return (
    <ContentPage
      eyebrow={L("Terms of use", "شروط الاستخدام")}
      title={L("Fair use for everyone", "استخدام منصف للجميع")}
      intro={L(
        "Draft terms for the JADARAH platform. Legal review is required before production use",
        "مسودة شروط لمنصة جدارة. تلزم مراجعة قانونية قبل الاستخدام الفعلي",
      )}
      sections={[
        {
          title: L("Accounts", "الحسابات"),
          body: L(
            "Provide accurate information and keep your credentials private. Company workspaces require verification and platform approval",
            "قدّم معلومات دقيقة واحفظ بيانات دخولك. تتطلب مساحات الشركات التحقق واعتماد المنصة",
          ),
        },
        {
          title: L("Honest evidence", "أدلة صادقة"),
          body: L(
            "Candidates must not misrepresent skills or submit others' work in assessments",
            "يجب ألا يحرّف المرشحون مهاراتهم أو يقدّموا أعمال غيرهم في التقييمات",
          ),
        },
        {
          title: L("Responsible hiring", "توظيف مسؤول"),
          body: L(
            "Companies make their own hiring decisions and must not use the platform to discriminate on protected characteristics",
            "تتخذ الشركات قرارات التوظيف بنفسها ويجب ألا تستخدم المنصة للتمييز على أساس الخصائص المحمية",
          ),
        },
        {
          title: L("Listings and organizations", "الفرص والجهات"),
          body: L(
            "Opportunities are published by the organizations themselves; external vacancies show their source. Listing an organization does not imply a partnership or endorsement",
            "تنشر الجهات فرصها بنفسها، وتُظهر الشواغر الخارجية مصدرها. ظهور الجهة لا يعني شراكة أو اعتمادًا",
          ),
        },
      ]}
    />
  );
}
