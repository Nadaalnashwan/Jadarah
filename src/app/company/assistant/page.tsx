import { PageHeader } from "@/components/ui/primitives";
import { AssistantChat } from "@/features/assistant/chat";
import { requireCompanyMember } from "@/lib/auth/session";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { aiStatus } from "@/services/ai/provider";

export default async function CompanyAssistant() {
  await requireCompanyMember(["company_admin", "recruiter"]);
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const ai = aiStatus();
  return (
    <>
      <PageHeader
        title={L("Recruiting assistant", "مساعد التوظيف")}
        description={
          ai.configured
            ? L(
                "Uses only your organization's data. Your team decides",
                "يستخدم بيانات جهتك فقط. والقرار لفريقك",
              )
            : t.common.ruleBased
        }
      />
      <AssistantChat
        scope="company"
        starters={[
          L("How should I write a strong job description?", "كيف أكتب وصف وظيفة قويًا؟"),
          L("How do I structure interviews?", "كيف أنظّم المقابلات؟"),
          L("How do I compare candidates fairly?", "كيف أقارن المرشحين بإنصاف؟"),
        ]}
      />
    </>
  );
}
