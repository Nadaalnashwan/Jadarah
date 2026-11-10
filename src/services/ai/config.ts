import "server-only";

/**
 * AI provider configuration and task-based routing. Keys are read from server env only and
 * never leave the server. Model IDs come from env so they can be verified against each
 * provider's model list before activation (see `scripts/ai/verify-providers.ts`).
 */
export type ProviderName = "gemini" | "groq" | "openai";

/**
 * - fast:       low-latency chat (assistants, quick suggestions)        → Groq
 * - structured: extraction + generation with schema output             → Gemini
 * - deep:       evidence-heavy evaluation (rubric analysis, final eval) → OpenAI
 */
export type AITask = "fast" | "structured" | "deep";

export interface ProviderConfig {
  name: ProviderName;
  configured: boolean;
  model: string;
}

export function providerConfig(name: ProviderName): ProviderConfig {
  switch (name) {
    case "gemini":
      return {
        name,
        configured: Boolean(process.env.GEMINI_API_KEY),
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      };
    case "groq":
      return {
        name,
        configured: Boolean(process.env.GROQ_API_KEY),
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      };
    case "openai":
      return {
        name,
        configured: Boolean(process.env.OPENAI_API_KEY),
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      };
  }
}

/** Preferred provider first; later entries are used only when earlier ones are not configured. */
const ROUTES: Record<AITask, ProviderName[]> = {
  fast: ["groq", "gemini", "openai"],
  structured: ["gemini", "openai", "groq"],
  deep: ["openai", "gemini", "groq"],
};

/** Default task for each logged operation name (callers may override). */
const OPERATION_TASK: Record<string, AITask> = {
  candidate_assistant: "fast",
  company_assistant: "fast",
  interview_questions: "fast",
  skill_explanation: "fast",
  cv_parse: "structured",
  job_description: "structured",
  assessment_generation: "structured",
  rubric_generation: "structured",
  career_plan: "structured",
  assessment_evaluation: "deep",
  final_evaluation: "deep",
};

export function taskForOperation(operation: string): AITask {
  return OPERATION_TASK[operation] ?? "structured";
}

/**
 * When AI_STRICT_ROUTING=true, a task only runs on its preferred provider (no cross-provider
 * fallback). Default: fall back to the next configured provider; the provider/model actually
 * used is always recorded in logs and shown in the UI badge, never hidden.
 */
function strict() {
  return process.env.AI_STRICT_ROUTING === "true";
}

export function routeFor(task: AITask, opts: { needsFile?: boolean } = {}): ProviderConfig[] {
  const chain = ROUTES[task].map(providerConfig).filter((p) => p.configured);
  const eligible = opts.needsFile ? chain.filter((p) => p.name === "gemini") : chain;
  return strict() ? eligible.filter((p) => p.name === ROUTES[task][0]) : eligible;
}

export interface AIStatus {
  configured: boolean;
  /** Provider used for structured work (kept for existing pages). */
  provider: ProviderName | null;
  model: string | null;
  providers: ProviderConfig[];
  routes: Record<AITask, { provider: ProviderName; model: string } | null>;
}

export function aiStatus(): AIStatus {
  const providers = (["gemini", "groq", "openai"] as const).map(providerConfig);
  const pick = (t: AITask) => {
    const p = routeFor(t)[0];
    return p ? { provider: p.name, model: p.model } : null;
  };
  const routes = { fast: pick("fast"), structured: pick("structured"), deep: pick("deep") };
  const primary = routes.structured ?? routes.fast ?? routes.deep;
  return {
    configured: providers.some((p) => p.configured),
    provider: primary?.provider ?? null,
    model: primary?.model ?? null,
    providers,
    routes,
  };
}

export const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 25_000);
