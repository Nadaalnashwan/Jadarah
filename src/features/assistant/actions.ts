"use server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AIUnavailableError, generateJSON } from "@/services/ai/provider";
import { assistantSystemPrompt, buildAssistantContext, ruleBased } from "./context";

const replySchema = z.object({
  reply: z.string().min(1).max(4000),
  suggestions: z.array(z.string().max(200)).max(4).default([]),
});
export type AssistantReply = {
  reply: string;
  suggestions: string[];
  mode: "ai" | "rule_based";
  provider: string;
};

/**
 * Candidate / company assistant. Context is built ONLY from records the signed-in user can read
 * through RLS (their own profile, applications or company data). Without a provider, it returns
 * clearly-labelled rule-based guidance — never a simulated AI answer.
 */
export async function askAssistant(scope: "candidate" | "company", message: string): Promise<AssistantReply> {
  const session = await requireSession();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const text = message.trim().slice(0, 1500);

  const context = await buildAssistantContext(supabase, session, scope);

  try {
    const { data, provider, model } = await generateJSON(
      {
        operation: `${scope}_assistant`,
        userId: session.userId,
        system: assistantSystemPrompt(scope, locale, "json"),
        prompt: `CONTEXT: ${context}\n\nQUESTION: ${text}`,
      },
      replySchema,
    );
    await supabase
      .from("ai_generation_records")
      .insert({
        user_id: session.userId,
        company_id: scope === "company" ? (session.activeMembership?.company_id ?? null) : null,
        kind: scope === "candidate" ? "candidate_assistant" : "company_assistant",
        provider,
        model,
        input_summary: text.slice(0, 200),
        output: { reply: data.reply.slice(0, 500) },
        review_status: "not_required",
      });
    return { ...data, mode: "ai", provider: `${provider} · ${model}` };
  } catch (e) {
    if (!(e instanceof AIUnavailableError)) throw e;
    return { ...ruleBased(scope, text, locale), mode: "rule_based", provider: "rule_based" };
  }
}
