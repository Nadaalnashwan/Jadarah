import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimitUser } from "@/lib/rate-limit";
import {
  AI_TIMEOUT_MS,
  aiStatus,
  routeFor,
  taskForOperation,
  type AIStatus,
  type AITask,
  type ProviderConfig,
  type ProviderName,
} from "./config";

export { aiStatus, type AIStatus, type AITask, type ProviderName };

export class AIUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "AIUnavailableError";
  }
}

/** Provider failure with a safe, loggable code (never contains prompt or key material). */
class ProviderError extends Error {
  constructor(
    public code: string,
    public retryable: boolean,
    public retryAfterMs = 0,
  ) {
    super(code);
  }
}

export interface CallInput {
  system: string;
  prompt: string;
  operation: string;
  userId: string;
  /** Override the operation's default task routing. */
  task?: AITask;
  /** Optional inline file (e.g. a PDF CV) — routed to Gemini (multimodal). */
  file?: { mimeType: string; base64: string };
  /** Cache identical requests from the same user for 10 minutes. */
  cacheable?: boolean;
  /** Minimum per-call timeout for long generations (e.g. full practical assessments). */
  timeoutMs?: number;
}

type RawOut = { text: string; inTok?: number; outTok?: number };

const MAX_RETRY_WAIT_MS = 4_000;

async function httpError(res: Response, provider: ProviderName): Promise<ProviderError> {
  const ra = Number(res.headers.get("retry-after"));
  const retryAfterMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1000;
  if (res.status === 429) {
    // Exhausted credits/quota is not a transient rate limit: never retry it.
    const body = await res.text().catch(() => "");
    if (/insufficient_quota|credit_balance|quota/i.test(body)) return new ProviderError(`${provider}_quota_exhausted`, false);
    return new ProviderError(`${provider}_rate_limited`, retryAfterMs <= MAX_RETRY_WAIT_MS, retryAfterMs);
  }
  if (res.status === 401 || res.status === 403) return new ProviderError(`${provider}_auth_${res.status}`, false);
  // 503 = model overloaded ("high demand"): move straight to the next model instead of retrying it.
  if (res.status === 503) return new ProviderError(`${provider}_overloaded`, false);
  if (res.status >= 500) return new ProviderError(`${provider}_http_${res.status}`, true, 800);
  return new ProviderError(`${provider}_http_${res.status}`, false);
}

function wrapFetchError(e: unknown, provider: ProviderName): ProviderError {
  if (e instanceof ProviderError) return e;
  const name = e instanceof Error ? e.name : "";
  // A timed-out model is not retried (that would double the wait); the next model in the route is tried.
  if (name === "TimeoutError" || name === "AbortError") return new ProviderError(`${provider}_timeout`, false);
  return new ProviderError(`${provider}_network`, true, 500);
}

// ---------- Gemini ----------
function geminiThinking(model: string) {
  const level = process.env.GEMINI_THINKING_LEVEL ?? "low";
  return /^gemini-3/.test(model) && level !== "default" ? { thinkingLevel: level } : undefined;
}

async function callGemini(input: CallInput, p: ProviderConfig, jsonSchema?: unknown): Promise<RawOut> {
  const model = p.model;
  const parts: unknown[] = [{ text: input.prompt }];
  if (input.file) parts.push({ inline_data: { mime_type: input.file.mimeType, data: input.file.base64 } });
  const generationConfig: Record<string, unknown> = { responseMimeType: "application/json", temperature: 0.2 };
  if (jsonSchema) generationConfig.responseJsonSchema = jsonSchema;
  const thinking = geminiThinking(model);
  if (thinking) generationConfig.thinkingConfig = thinking;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(p.timeoutMs),
    },
  );
  if (!res.ok) throw await httpError(res, "gemini");
  const json = await res.json();
  const text =
    json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!text) throw new ProviderError("gemini_empty", false);
  return { text, inTok: json?.usageMetadata?.promptTokenCount, outTok: json?.usageMetadata?.candidatesTokenCount };
}

// ---------- OpenAI-compatible (OpenAI + Groq) ----------
function compatEndpoint(provider: "openai" | "groq") {
  return provider === "groq"
    ? { url: "https://api.groq.com/openai/v1/chat/completions", key: process.env.GROQ_API_KEY! }
    : { url: "https://api.openai.com/v1/chat/completions", key: process.env.OPENAI_API_KEY! };
}

function compatBody(
  provider: "openai" | "groq",
  model: string,
  input: CallInput,
  json: boolean,
  stream: boolean,
  jsonSchema?: unknown,
) {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.prompt },
    ],
    stream,
  };
  // Structured outputs: the provider constrains generation to the schema (Zod still validates).
  if (json)
    body.response_format = jsonSchema
      ? { type: "json_schema", json_schema: { name: "result", schema: jsonSchema, strict: false } }
      : { type: "json_object" };
  if (provider === "groq") {
    body.temperature = 0.3;
    // gpt-oss reasoning models: keep reasoning short for chat latency.
    if (model.startsWith("openai/gpt-oss")) body.reasoning_effort = taskOf(input) === "fast" ? "low" : "medium";
  }
  // OpenAI reasoning models reject custom temperature, so it is left at the provider default.
  if (stream && provider === "openai") body.stream_options = { include_usage: true };
  return body;
}

async function callCompat(
  provider: "openai" | "groq",
  input: CallInput,
  p: ProviderConfig,
  jsonSchema?: unknown,
): Promise<RawOut> {
  const model = p.model;
  if (input.file && input.file.mimeType !== "text/plain") throw new ProviderError(`${provider}_file_unsupported`, false);
  const ep = compatEndpoint(provider);
  const res = await fetch(ep.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ep.key}` },
    body: JSON.stringify(compatBody(provider, model, input, true, false, jsonSchema)),
    signal: AbortSignal.timeout(p.timeoutMs),
  });
  if (!res.ok) throw await httpError(res, provider);
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new ProviderError(`${provider}_empty`, false);
  return { text, inTok: json?.usage?.prompt_tokens, outTok: json?.usage?.completion_tokens };
}

function taskOf(input: CallInput): AITask {
  return input.task ?? taskForOperation(input.operation);
}

// ---------- circuit breaker ----------
/**
 * Skip a model temporarily after failures that will predictably repeat: overloaded/timeouts
 * (3 min — e.g. Gemini 3.8 "high demand") and exhausted quota / rejected key (10 min).
 * It re-enters the route automatically afterwards. If every model is cooling down, all are tried.
 */
// Process-wide (globalThis): Next bundles server actions per route, so module-level state would not be shared.
const g = globalThis as typeof globalThis & {
  __jadarahAiCooldown?: Map<string, number>;
  __jadarahAiCache?: Map<string, { at: number; value: unknown }>;
};
const cooldown = (g.__jadarahAiCooldown ??= new Map<string, number>());
const COOLDOWN_MS: [RegExp, number][] = [
  [/_(quota_exhausted|auth_\d+)$/, 10 * 60_000],
  [/_(overloaded|timeout)$/, 3 * 60_000],
];
function noteFailure(p: ProviderConfig, code: string) {
  const ms = COOLDOWN_MS.find(([re]) => re.test(code))?.[1];
  if (ms) cooldown.set(`${p.name}:${p.model}`, Date.now() + ms);
}
function available(chain: ProviderConfig[]) {
  const now = Date.now();
  const live = chain.filter((p) => (cooldown.get(`${p.name}:${p.model}`) ?? 0) < now);
  return live.length ? live : chain;
}

// ---------- logging ----------
async function logCall(row: {
  provider: ProviderName;
  model: string;
  operation: string;
  user_id: string;
  latency_ms: number;
  input_tokens?: number | null;
  output_tokens?: number | null;
  success: boolean;
  error_code?: string | null;
}) {
  try {
    const supabase = await createClient();
    await supabase.from("ai_provider_logs").insert({
      ...row,
      input_tokens: row.input_tokens ?? null,
      output_tokens: row.output_tokens ?? null,
      error_code: row.error_code ?? null,
    });
  } catch {
    // Logging must never break the user-facing request.
  }
}

// ---------- per-user response cache ----------
const cache = (g.__jadarahAiCache ??= new Map<string, { at: number; value: unknown }>());
const CACHE_TTL = 10 * 60_000;
function cacheKey(input: CallInput, model: string) {
  return createHash("sha256")
    .update([input.userId, input.operation, model, input.system, input.prompt].join("\u0000"))
    .digest("hex");
}

function jsonSchemaFor(schema: z.ZodTypeAny): unknown | undefined {
  if (process.env.GEMINI_JSON_SCHEMA === "false") return undefined;
  try {
    const s = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
    delete s.$schema;
    return s;
  } catch {
    return undefined;
  }
}

function parseJson(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new ProviderError("invalid_json", true, 0);
  }
}

/**
 * Call the provider routed for this task and validate the JSON result against a Zod schema.
 * Bounded retries (max 2 attempts per provider, ≤4 s backoff, overall deadline), then the next
 * configured provider in the task's route. Throws AIUnavailableError when nothing succeeds —
 * callers then fall back to clearly-labelled rule-based behaviour, never fabricated AI output.
 */
export async function generateJSON<T extends z.ZodTypeAny>(
  input: CallInput,
  schema: T,
): Promise<{ data: z.infer<T>; provider: ProviderName; model: string; latencyMs: number }> {
  const chain = available(
    routeFor(taskOf(input), { needsFile: Boolean(input.file && input.file.mimeType !== "text/plain") }),
  );
  if (!chain.length) throw new AIUnavailableError("not_configured");
  if (!(await rateLimitUser("ai", input.userId, 20, 60_000))) throw new AIUnavailableError("rate_limited");

  const deadline = Date.now() + Math.max(AI_TIMEOUT_MS, input.timeoutMs ?? 0) * 3;
  let lastError = "unknown";
  for (const p of chain) {
    if (input.cacheable) {
      const hit = cache.get(cacheKey(input, p.model));
      if (hit && Date.now() - hit.at < CACHE_TTL)
        return { data: hit.value as z.infer<T>, provider: p.name, model: p.model, latencyMs: 0 };
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0 && Date.now() > deadline) break;
      const started = Date.now();
      try {
        const out = await callProvider(p, input, schema);
        const parsed = schema.safeParse(parseJson(out.text));
        const latency = Date.now() - started;
        void logCall({
          provider: p.name,
          model: p.model,
          operation: input.operation,
          user_id: input.userId,
          latency_ms: latency,
          input_tokens: out.inTok,
          output_tokens: out.outTok,
          success: parsed.success,
          error_code: parsed.success ? null : "schema_mismatch",
        });
        if (parsed.success) {
          if (input.cacheable) {
            cache.set(cacheKey(input, p.model), { at: Date.now(), value: parsed.data });
            if (cache.size > 500) cache.delete(cache.keys().next().value!);
          }
          return { data: parsed.data, provider: p.name, model: p.model, latencyMs: latency };
        }
        lastError = "schema_mismatch";
      } catch (e) {
        const err = e instanceof ProviderError ? e : wrapFetchError(e, p.name);
        lastError = err.code;
        void logCall({
          provider: p.name,
          model: p.model,
          operation: input.operation,
          user_id: input.userId,
          latency_ms: Date.now() - started,
          success: false,
          error_code: err.code,
        });
        noteFailure(p, err.code);
        if (!err.retryable) break;
        if (err.retryAfterMs) await new Promise((r) => setTimeout(r, Math.min(err.retryAfterMs, MAX_RETRY_WAIT_MS)));
      }
    }
  }
  throw new AIUnavailableError(lastError);
}

async function callProvider(base: ProviderConfig, input: CallInput, schema: z.ZodTypeAny): Promise<RawOut> {
  const p = input.timeoutMs ? { ...base, timeoutMs: Math.max(base.timeoutMs, input.timeoutMs) } : base;
  try {
    if (p.name === "gemini") return await callGemini(input, p, jsonSchemaFor(schema));
    return await callCompat(p.name, input, p, jsonSchemaFor(schema));
  } catch (e) {
    throw wrapFetchError(e, p.name);
  }
}

// ---------- streaming text (assistants) ----------
export interface StreamResult {
  provider: ProviderName;
  model: string;
  stream: AsyncGenerator<string>;
}

async function* sseLines(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line.startsWith("data:")) yield line.slice(5).trim();
    }
  }
}

async function openStream(p: ProviderConfig, input: CallInput): Promise<Response> {
  if (p.name === "gemini") {
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model)}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.system }] },
          contents: [{ role: "user", parts: [{ text: input.prompt }] }],
          generationConfig: { temperature: 0.4, ...(geminiThinking(p.model) ? { thinkingConfig: geminiThinking(p.model) } : {}) },
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS * 2),
      },
    );
  }
  const ep = compatEndpoint(p.name);
  return fetch(ep.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ep.key}` },
    body: JSON.stringify(compatBody(p.name, p.model, input, false, true)),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS * 2),
  });
}

/**
 * Stream plain text from the provider routed for the task (default: fast → Groq).
 * Connection-level failures fall through to the next configured provider before any
 * text is emitted; mid-stream failures end the stream (logged).
 */
export async function streamText(input: CallInput): Promise<StreamResult> {
  const chain = available(routeFor(taskOf(input)));
  if (!chain.length) throw new AIUnavailableError("not_configured");
  if (!(await rateLimitUser("ai", input.userId, 20, 60_000))) throw new AIUnavailableError("rate_limited");

  let lastError = "unknown";
  for (const p of chain) {
    const started = Date.now();
    let res: Response;
    try {
      res = await openStream(p, input);
      if (!res.ok || !res.body) throw await httpError(res, p.name);
    } catch (e) {
      const err = wrapFetchError(e, p.name);
      lastError = err.code;
      noteFailure(p, err.code);
      void logCall({
        provider: p.name,
        model: p.model,
        operation: input.operation,
        user_id: input.userId,
        latency_ms: Date.now() - started,
        success: false,
        error_code: err.code,
      });
      continue;
    }
    const body = res;
    async function* gen(): AsyncGenerator<string> {
      let firstTokenMs: number | null = null;
      let inTok: number | undefined;
      let outTok: number | undefined;
      let ok = true;
      try {
        for await (const data of sseLines(body)) {
          if (data === "[DONE]") break;
          let j: Record<string, unknown>;
          try {
            j = JSON.parse(data);
          } catch {
            continue;
          }
          let delta = "";
          if (p.name === "gemini") {
            const c = (j as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates;
            delta = c?.[0]?.content?.parts?.map((x) => x.text ?? "").join("") ?? "";
            const u = (j as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } })
              .usageMetadata;
            if (u) [inTok, outTok] = [u.promptTokenCount, u.candidatesTokenCount];
          } else {
            const c = (j as { choices?: { delta?: { content?: string } }[] }).choices;
            delta = c?.[0]?.delta?.content ?? "";
            const u =
              (j as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage ??
              (j as { x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number } } }).x_groq?.usage;
            if (u) [inTok, outTok] = [u.prompt_tokens, u.completion_tokens];
          }
          if (delta) {
            firstTokenMs ??= Date.now() - started;
            yield delta;
          }
        }
      } catch {
        ok = false;
      } finally {
        void logCall({
          provider: p.name,
          model: p.model,
          operation: input.operation,
          user_id: input.userId,
          // Time to first token is the latency users feel; total is recorded in error_code-free rows.
          latency_ms: firstTokenMs ?? Date.now() - started,
          input_tokens: inTok,
          output_tokens: outTok,
          success: ok && firstTokenMs !== null,
          error_code: ok ? (firstTokenMs === null ? "empty_stream" : null) : "stream_interrupted",
        });
      }
    }
    return { provider: p.name, model: p.model, stream: gen() };
  }
  throw new AIUnavailableError(lastError);
}
