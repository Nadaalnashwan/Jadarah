import "server-only";
import { createHash } from "node:crypto";
import { AI_TIMEOUT_MS } from "./config";

/**
 * Text embeddings for semantic matching (Gemini embeddings, pgvector storage).
 * Vectors are L2-normalised (required when requesting reduced dimensions) and always
 * labelled with model + dims so incompatible vectors are never compared.
 */
export interface EmbeddingConfig {
  configured: boolean;
  provider: "gemini";
  model: string;
  dims: number;
}

export function embeddingConfig(): EmbeddingConfig {
  return {
    configured: process.env.EMBEDDING_PROVIDER !== "none" && Boolean(process.env.GEMINI_API_KEY),
    provider: "gemini",
    model: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
    dims: Number(process.env.EMBEDDING_DIMENSIONS || 768),
  };
}

export type EmbedTask = "SEMANTIC_SIMILARITY" | "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export function contentHash(text: string, cfg = embeddingConfig()) {
  return createHash("sha256").update(`${cfg.model}|${cfg.dims}|${text}`).digest("hex");
}

function normalise(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

export class EmbeddingError extends Error {}

/** Embed up to 100 texts in one request. */
export async function embedTexts(texts: string[], task: EmbedTask = "SEMANTIC_SIMILARITY"): Promise<number[][]> {
  const cfg = embeddingConfig();
  if (!cfg.configured) throw new EmbeddingError("not_configured");
  if (!texts.length) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:batchEmbedContents`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
        body: JSON.stringify({
          requests: batch.map((t) => ({
            model: `models/${cfg.model}`,
            content: { parts: [{ text: t.slice(0, 8000) }] },
            taskType: task,
            outputDimensionality: cfg.dims,
          })),
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      },
    );
    if (!res.ok) throw new EmbeddingError(`gemini_embed_http_${res.status}`);
    const json = (await res.json()) as { embeddings?: { values: number[] }[] };
    const vecs = json.embeddings ?? [];
    if (vecs.length !== batch.length || vecs.some((v) => v.values.length !== cfg.dims))
      throw new EmbeddingError("embedding_shape_mismatch");
    out.push(...vecs.map((v) => normalise(v.values)));
  }
  return out;
}

/** pgvector literal: '[0.1,0.2,...]' */
export function toPgVector(v: number[]): string {
  return `[${v.map((x) => Number(x.toFixed(7))).join(",")}]`;
}

export function skillEmbeddingText(s: { name_en: string; name_ar?: string | null; aliases?: string[] | null; kind?: string | null }) {
  return [`Skill: ${s.name_en}`, s.name_ar ? `(${s.name_ar})` : "", s.aliases?.length ? `Also known as: ${s.aliases.join(", ")}` : "", s.kind ? `Type: ${s.kind}` : ""]
    .filter(Boolean)
    .join(". ");
}
