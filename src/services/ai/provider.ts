import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimitUser } from "@/lib/rate-limit";
import { hasServerKey, serverEnv } from "@/lib/server-env";
import { rpcClient } from "@/lib/supabase/rpc-client";
import {
  AI_TIMEOUT_MS,
  aiStatus,
  routeForOperation,
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
  // Client errors (bad request/schema) are not retried; log the provider's reason (never the prompt).
  const reason = await res.text().catch(() => "");
  const msg = (() => {
    try {
      return String(JSON.parse(reason)?.error?.message ?? "").slice(0, 300);
    } catch {
      return "";
    }
  })();
  console.warn(`[ai] ${provider} HTTP ${res.status}: ${msg}`);
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
/**
 * Lite models reject size constraints (min/max length/items/values, patterns) in response schemas
 * with HTTP 400. They are removed from the request only; Zod still validates the full schema.
 */
const SIZE_KEYS = new Set(["pattern", "minItems", "maxItems", "minimum", "maximum", "minLength", "maxLength", "exclusiveMinimum", "exclusiveMaximum"]);
const HINT: Record<string, string> = {
  pattern: "must match",
  minItems: "at least {} items",
  maxItems: "at most {} items",
  minimum: "minimum {}",
  maximum: "maximum {}",
  minLength: "at least {} characters",
  maxLength: "at most {} characters",
  exclusiveMinimum: "greater than {}",
  exclusiveMaximum: "less than {}",
};
function relaxSchema(o: unknown): unknown {
  if (Array.isArray(o)) return o.map(relaxSchema);
  if (!o || typeof o !== "object") return o;
  const entries = Object.entries(o as Record<string, unknown>);
  // The constraint stays visible to the model as a description hint.
  const hints = entries.filter(([k]) => SIZE_KEYS.has(k)).map(([k, v]) => (k === "pattern" ? `${HINT[k]} ${v}` : HINT[k].replace("{}", String(v))));
  const out = Object.fromEntries(entries.filter(([k]) => !SIZE_KEYS.has(k)).map(([k, v]) => [k, k === "properties" ? Object.fromEntries(Object.entries(v as object).map(([pk, pv]) => [pk, relaxSchema(pv)])) : relaxSchema(v)]));
  if (hints.length) out.description = [out.description, `Constraint: ${hints.join("; ")}.`].filter(Boolean).join(" ");
  return out;
}

function geminiThinking(model: string) {
  const level = process.env.GEMINI_THINKING_LEVEL ?? "low";
  // Lite models are called without thinking options.
  return /^gemini-3/.test(model) && !/lite/.test(model) && level !== "default" ? { thinkingLevel: level } : undefined;
}

async function callGemini(input: CallInput, p: ProviderConfig, jsonSchema?: unknown): Promise<RawOut> {
  const model = p.model;
  const parts: unknown[] = [{ text: input.prompt }];
  if (input.file) parts.push({ inline_data: { mime_type: input.file.mimeType, data: input.file.base64 } });
  const generationConfig: Record<string, unknown> = { responseMimeType: "application/json", temperature: 0.2 };
  if (jsonSchema) generationConfig.responseJsonSchema = /lite/.test(model) ? relaxSchema(jsonSchema) : jsonSchema;
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
/**
 * Cooldowns are keyed by provider + model + a fingerprint of the API key in use, so replacing a key
 * (e.g. a new Gemini key with fresh quota) takes effect immediately instead of inheriting the old
 * key's "quota exhausted" cooldown. The fingerprint is a short hash and never leaves the process.
 */
const KEY_ENV: Record<ProviderName, string> = { gemini: "GEMINI_API_KEY", groq: "GROQ_API_KEY", openai: "OPENAI_API_KEY" };
function cooldownKey(p: ProviderConfig) {
  const fp = createHash("sha256").update(process.env[KEY_ENV[p.name]] ?? "").digest("hex").slice(0, 12);
  return `${p.name}:${p.model}:${fp}`;
}
function noteFailure(p: ProviderConfig, code: string) {
  const ms = COOLDOWN_MS.find(([re]) => re.test(code))?.[1];
  if (!ms) return;
  const key = cooldownKey(p);
  cooldown.set(key, Date.now() + ms);
  // Shared with every instance, so an exhausted quota is not retried by each server separately.
  if (hasServerKey())
    void rpcClient()
      .rpc("internal_ai_cooldown_note", { p_service_key: serverEnv.serverKey(), p_key: key, p_seconds: Math.round(ms / 1000), p_reason: code.slice(0, 80) })
      .then(() => undefined, () => undefined);
}

/** Pull cooldowns noted by other instances (at most every 20 s; never blocks a request for long). */
const SHARED_REFRESH_MS = 20_000;
const gs = globalThis as typeof globalThis & { __jadarahAiCooldownSync?: number };
async function syncSharedCooldowns() {
  if (!hasServerKey() || Date.now() - (gs.__jadarahAiCooldownSync ?? 0) < SHARED_REFRESH_MS) return;
  gs.__jadarahAiCooldownSync = Date.now();
  try {
    const { data } = await rpcClient()
      .rpc("internal_ai_cooldowns", { p_service_key: serverEnv.serverKey() })
      .abortSignal(AbortSignal.timeout(1000));
    for (const row of data ?? []) {
      const until = Date.parse(row.until);
      if (until > (cooldown.get(row.key) ?? 0)) cooldown.set(row.key, until);
    }
  } catch {
    // Local cooldowns still apply.
  }
}
function available(chain: ProviderConfig[]) {
  const now = Date.now();
  const live = chain.filter((p) => (cooldown.get(cooldownKey(p)) ?? 0) < now);
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
  await syncSharedCooldowns();
  const chain = available(
    routeForOperation(taskOf(input), input.operation, { needsFile: Boolean(input.file && input.file.mimeType !== "text/plain") }),
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
    let repair = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0 && Date.now() > deadline) break;
      const started = Date.now();
      try {
        // Repair pass: the second attempt is told which fields failed validation (paths only, no content).
        const out = await callProvider(p, repair ? { ...input, prompt: `${input.prompt}\n\n${repair}` } : input, schema);
        const parsed = schema.safeParse(parseJson(out.text));
        const latency = Date.now() - started;
        if (!parsed.success)
          console.warn(`[ai] ${p.model} schema mismatch: ${parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}:${i.code}`).join(", ")}`);
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
        repair = repairInstruction(parsed.error.issues);
      } catch (e) {
        const err = e instanceof ProviderError ? e : wrapFetchError(e, p.name);
        lastError = err.code;
        if (process.env.AI_DEBUG === "1") console.warn(`[ai] ${p.model} ${err.code}`);
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

/** A short, content-free description of validation failures for one repair attempt. */
export function repairInstruction(issues: { path: PropertyKey[]; message: string }[]): string {
  const list = issues
    .slice(0, 8)
    .map((i) => `- ${i.path.map(String).join(".") || "(root)"}: ${i.message.slice(0, 120)}`)
    .join("\n");
  return `IMPORTANT: your previous response did not match the required JSON schema.\nFix these fields and return ONLY the corrected JSON object:\n${list}`;
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
  await syncSharedCooldowns();
  const chain = available(routeForOperation(taskOf(input), input.operation));
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
