import { PageHeader } from "@/components/ui/primitives";
import { AssistantChat } from "@/features/assistant/chat";
import { requireCandidate } from "@/lib/auth/session";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { aiStatus } from "@/services/ai/provider";

export default async function AssistantPage() {
  await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const ai = aiStatus();
  return (
    <>
      <PageHeader
        eyebrow={t.candidate.nav.assistant}
        title={L("Your career assistant", "مساعدك المهني")}
        description={
          ai.configured
            ? L(
                "Uses only your profile data. You decide.",
                "يستخدم بيانات ملفك فقط. والقرار لك.",
              )
            : t.common.ruleBased
        }
      />
      <AssistantChat
        scope="candidate"
        starters={[
          L("How can I improve my profile?", "كيف أحسّن ملفي؟"),
          L("What are my skill gaps?", "ما فجوات مهاراتي؟"),
          L("How do I prepare for an interview?", "كيف أستعد لمقابلة؟"),
        ]}
      />
    </>
  );
}
