import { ContentPage } from "@/features/landing/content-page";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "About" };
export default async function About() {
  const { locale } = await getI18n();
  const L = tx(locale);
  return (
    <ContentPage
      eyebrow={L("About", "عن جدارة")}
      title={L("Merit, made visible", "الجدارة، مرئية")}
      intro={L(
        "JADARAH (جدارة, “merit”) exists so that what people can actually do is what gets them hired. We combine structured profiles, practical assessment and explainable intelligence — and keep people in charge of every decision",
        "وُجدت جدارة ليكون ما يستطيع الناس فعله فعلًا هو ما يُوظَّفون لأجله. نجمع بين الملفات المنظّمة والتقييم العملي والذكاء القابل للتفسير — ونُبقي البشر مسؤولين عن كل قرار",
      )}
      sections={[
        {
          title: L("Evidence over keywords", "الأدلة قبل الكلمات المفتاحية"),
          body: L(
            "Every skill on JADARAH carries its source: self-declared, extracted from a reviewed CV, demonstrated in an assessment, or verified",
            "كل مهارة في جدارة تحمل مصدرها: تصريح ذاتي، أو مستخرجة من سيرة مراجَعة، أو مثبتة في تقييم، أو موثّقة",
          ),
        },
        {
          title: L("Explainable by design", "قابل للتفسير بالتصميم"),
          body: L(
            "Matching classifies each requirement as matched, partial, missing or unverified. Scores are transparent rules, not opaque rankings",
            "تصنّف المطابقة كل متطلب: مطابق أو جزئي أو مفقود أو غير موثّق. الدرجات قواعد شفافة لا تصنيفات غامضة",
          ),
        },
        {
          title: L("Humans decide", "البشر يقررون"),
          body: L(
            "AI drafts, extracts and suggests — always labelled. It never shortlists, rejects or hires anyone",
            "يصوغ الذكاء الاصطناعي ويستخرج ويقترح — مع الوسم دائمًا. ولا يضيف أحدًا للقائمة المختصرة أو يرفضه أو يوظّفه",
          ),
        },
        {
          title: L("Bilingual from the first line", "ثنائي اللغة من السطر الأول"),
          body: L(
            "Arabic and English are equal citizens across every screen, form, chart and notification",
            "العربية والإنجليزية متساويتان في كل شاشة ونموذج ومخطط وإشعار",
          ),
        },
      ]}
      cta={[
        { href: "/sign-up", label: L("Get started", "ابدأ الآن") },
        { href: "/how-it-works", label: L("How it works", "كيف تعمل") },
      ]}
    />
  );
}
