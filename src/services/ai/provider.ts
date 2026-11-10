import "server-only";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimitUser } from "@/lib/rate-limit";

export type ProviderName = "gemini" | "openai";

export class AIUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "AIUnavailableError";
  }
}

export interface AIStatus {
  configured: boolean;
  provider: ProviderName | null;
  model: string | null;
}

/** Which provider is configured (keys never leave the server). */
export function aiStatus(): AIStatus {
  const preferred = (process.env.AI_PROVIDER ?? "gemini") as ProviderName;
  const gemini = Boolean(process.env.GEMINI_API_KEY);
  const openai = Boolean(process.env.OPENAI_API_KEY);
  if (preferred === "openai" && openai) return { configured: true, provider: "openai", model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini" };
  if (gemini) return { configured: true, provider: "gemini", model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash" };
  if (openai) return { configured: true, provider: "openai", model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini" };
  return { configured: false, provider: null, model: null };
}

interface CallInput {
  system: string;
  prompt: string;
  operation: string;
  userId: string;
  /** Optional inline file (e.g. a PDF CV) for multimodal providers. */
  file?: { mimeType: string; base64: string };
}

const TIMEOUT = Number(process.env.AI_TIMEOUT_MS ?? 25_000);

async function callGemini(input: CallInput, model: string): Promise<{ text: string; inTok?: number; outTok?: number }> {
  const parts: unknown[] = [{ text: input.prompt }];
  if (input.file) parts.push({ inline_data: { mime_type: input.file.mimeType, data: input.file.base64 } });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`gemini_http_${res.status}`);
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  return { text, inTok: json?.usageMetadata?.promptTokenCount, outTok: json?.usageMetadata?.candidatesTokenCount };
}

async function callOpenAI(input: CallInput, model: string): Promise<{ text: string; inTok?: number; outTok?: number }> {
  if (input.file && input.file.mimeType !== "text/plain") throw new Error("openai_file_unsupported");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.prompt },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`openai_http_${res.status}`);
  const json = await res.json();
  return { text: json?.choices?.[0]?.message?.content ?? "", inTok: json?.usage?.prompt_tokens, outTok: json?.usage?.completion_tokens };
}

/**
 * Call the configured provider and validate the JSON result against a Zod schema.
 * Throws AIUnavailableError when no provider is configured or the call ultimately fails —
 * callers must then fall back to clearly-labelled rule-based behaviour, never fabricate AI output.
 */
export async function generateJSON<T extends z.ZodTypeAny>(input: CallInput, schema: T): Promise<{ data: z.infer<T>; provider: ProviderName; model: string }> {
  const status = aiStatus();
  if (!status.configured || !status.provider || !status.model) throw new AIUnavailableError("not_configured");
  if (!(await rateLimitUser("ai", input.userId, 20, 60_000))) throw new AIUnavailableError("rate_limited");

  const supabase = await createClient();
  let lastError = "unknown";
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    try {
      const out = status.provider === "gemini" ? await callGemini(input, status.model) : await callOpenAI(input, status.model);
      const parsed = schema.safeParse(JSON.parse(out.text));
      await supabase.from("ai_provider_logs").insert({
        provider: status.provider, model: status.model, operation: input.operation, user_id: input.userId,
        latency_ms: Date.now() - started, input_tokens: out.inTok ?? null, output_tokens: out.outTok ?? null,
        success: parsed.success, error_code: parsed.success ? null : "schema_mismatch",
      });
      if (parsed.success) return { data: parsed.data, provider: status.provider, model: status.model };
      lastError = "schema_mismatch";
    } catch (e) {
      lastError = e instanceof Error ? e.message.slice(0, 60) : "error";
      await supabase.from("ai_provider_logs").insert({
        provider: status.provider, model: status.model, operation: input.operation, user_id: input.userId,
        latency_ms: Date.now() - started, success: false, error_code: lastError,
      });
    }
  }
  throw new AIUnavailableError(lastError);
}
