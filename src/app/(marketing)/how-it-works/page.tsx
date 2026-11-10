import { ContentPage } from "@/features/landing/content-page";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "How it works" };
export default async function HowItWorks() {
  const { t, locale } = await getI18n();
  const L = tx(locale);
  return <ContentPage eyebrow={t.nav.howItWorks} title={t.landing.solutionTitle} intro={L("From profile to decision, every step leaves a record that both sides can understand.", "من الملف إلى القرار، تترك كل خطوة سجلًا يفهمه الطرفان.")}
    sections={t.landing.stages.map((s) => ({ title: s.title, body: s.body }))}
    cta={[{ href: "/sign-up?type=candidate", label: t.landing.closingCandidate }, { href: "/sign-up?type=company", label: t.landing.closingCompany }]} />;
}
