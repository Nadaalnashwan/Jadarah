import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AIUnavailableError, streamText } from "@/services/ai/provider";
import {
  SUGGESTIONS_MARKER,
  assistantSystemPrompt,
  buildAssistantContext,
  ruleBased,
} from "@/features/assistant/context";

const bodySchema = z.object({
  scope: z.enum(["candidate", "company"]),
  message: z.string().trim().min(1).max(1500),
});

/**
 * Streaming assistant (fast task → Groq by default). Text streams as it is generated; the client
 * splits trailing follow-up suggestions at SUGGESTIONS_MARKER. Headers carry the provider/model
 * that answered. With no provider available, returns the labelled rule-based guidance as JSON.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.profile.status !== "active") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { scope, message } = parsed.data;

  // Same access rules as the assistant pages.
  if (scope === "candidate" && !session.isCandidate)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (scope === "company" && !["company_admin", "recruiter"].includes(session.activeMembership?.role ?? ""))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { locale } = await getI18n();
  const supabase = await createClient();
  const context = await buildAssistantContext(supabase, session, scope);

  let result;
  try {
    result = await streamText({
      operation: `${scope}_assistant`,
      userId: session.userId,
      system: assistantSystemPrompt(scope, locale, "text"),
      prompt: `CONTEXT: ${context}\n\nQUESTION: ${message}`,
    });
  } catch (e) {
    if (!(e instanceof AIUnavailableError)) throw e;
    return NextResponse.json({ mode: "rule_based", ...ruleBased(scope, message, locale) });
  }

  const { provider, model, stream } = result;
  const encoder = new TextEncoder();
  let full = "";
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await stream.next();
      if (done) {
        controller.close();
        const reply = full.split(SUGGESTIONS_MARKER)[0].trim();
        if (reply)
          await supabase.from("ai_generation_records").insert({
            user_id: session.userId,
            company_id: scope === "company" ? (session.activeMembership?.company_id ?? null) : null,
            kind: scope === "candidate" ? "candidate_assistant" : "company_assistant",
            provider,
            model,
            input_summary: message.slice(0, 200),
            output: { reply: reply.slice(0, 500) },
            review_status: "not_required",
          });
        return;
      }
      full += value;
      controller.enqueue(encoder.encode(value));
    },
    async cancel() {
      await stream.return(undefined);
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-AI-Mode": "ai",
      "X-AI-Provider": provider,
      "X-AI-Model": model,
    },
  });
}
