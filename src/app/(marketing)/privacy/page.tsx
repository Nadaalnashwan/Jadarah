import { ContentPage } from "@/features/landing/content-page";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Privacy" };
export default async function Privacy() {
  const { locale } = await getI18n();
  const L = tx(locale);
  return <ContentPage eyebrow={L("Privacy policy", "سياسة الخصوصية")} title={L("Your data, your control.", "بياناتك تحت سيطرتك.")} intro={L("This policy describes how the JADARAH platform processes personal data. It is a product draft and must be reviewed by legal counsel before production use.", "تصف هذه السياسة كيفية معالجة منصة جدارة للبيانات الشخصية. وهي مسودة للمنتج ويجب أن يراجعها مستشار قانوني قبل الاستخدام الفعلي.")}
    sections={[
      { title: L("What we collect", "ما نجمعه"), body: [L("Account details (name, email)", "بيانات الحساب (الاسم، البريد)"), L("Profile, education, experience, skills and documents you add", "الملف والتعليم والخبرة والمهارات والمستندات التي تضيفها"), L("Applications, assessment answers and interview records", "الطلبات وإجابات التقييمات وسجلات المقابلات")] },
      { title: L("Who can see it", "من يمكنه رؤيتها"), body: L("Companies see your profile and chosen CV only when you apply, or when you opt in to discovery by approved companies. Internal notes and interviewer evaluations are never shown to candidates.", "ترى الشركات ملفك والسيرة التي تختارها فقط عند التقديم أو عند اختيارك الظهور للشركات المعتمدة. لا تُعرض الملاحظات الداخلية وتقييمات المُقابِلين على المرشحين أبدًا.") },
      { title: L("Storage and security", "التخزين والأمان"), body: L("Files are stored in private buckets and opened only through short-lived signed links. Access rules are enforced in the database with row-level security.", "تُحفظ الملفات في حاويات خاصة ولا تُفتح إلا عبر روابط موقّعة مؤقتة. وتُفرض قواعد الوصول في قاعدة البيانات بأمان على مستوى الصف.") },
      { title: L("AI processing", "المعالجة بالذكاء الاصطناعي"), body: L("When an AI provider is configured, CV text and job context may be sent to it to generate suggestions. Outputs are labelled and reviewed by people; AI never makes hiring decisions.", "عند ضبط مزوّد ذكاء اصطناعي، قد يُرسل نص السيرة وسياق الوظيفة إليه لتوليد اقتراحات. تُوسم المخرجات ويراجعها أشخاص، ولا يتخذ الذكاء الاصطناعي قرارات التوظيف.") },
      { title: L("Your rights", "حقوقك"), body: L("You can edit your data at any time, switch your profile to private, and request deactivation and deletion from Settings.", "يمكنك تعديل بياناتك في أي وقت، وجعل ملفك خاصًا، وطلب التعطيل والحذف من الإعدادات.") },
    ]} />;
}
