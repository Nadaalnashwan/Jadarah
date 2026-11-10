import { createHash } from "node:crypto";

const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 25_000);

/**
 * Core (environment-agnostic) embedding helpers — used by the app via `./embeddings` (server-only)
 * and by maintenance scripts. Never import this from client components.
 *
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

type Txt = string | null | undefined;
const clean = (parts: Txt[]) => parts.filter((p): p is string => Boolean(p && p.trim())).join("\n");

/** Candidate profile text for embedding (professional content only — no contact details). */
export function candidateEmbeddingText(d: {
  headline?: Txt;
  summary?: Txt;
  experience_level?: Txt;
  years?: number | null;
  skills: { name: string; level: number }[];
  experience: { title: Txt; company?: Txt; description?: Txt }[];
  projects: { title: Txt; description?: Txt }[];
}) {
  return clean([
    d.headline ? `Headline: ${d.headline}` : null,
    d.experience_level ? `Level: ${d.experience_level}${d.years != null ? `, ${d.years} years` : ""}` : null,
    d.summary ? `Summary: ${d.summary.slice(0, 1200)}` : null,
    d.skills.length ? `Skills: ${d.skills.map((s) => `${s.name} (level ${s.level}/5)`).join(", ")}` : null,
    ...d.experience.slice(0, 8).map((e) => `Experience: ${e.title ?? ""}${e.company ? ` at ${e.company}` : ""}. ${(e.description ?? "").slice(0, 400)}`),
    ...d.projects.slice(0, 5).map((p) => `Project: ${p.title ?? ""}. ${(p.description ?? "").slice(0, 300)}`),
  ]);
}

export function jobEmbeddingText(d: {
  title_en: Txt;
  experience_level?: Txt;
  min_years?: number | null;
  description_en?: Txt;
  responsibilities_en?: Txt | string[];
  qualifications_en?: Txt | string[];
  requirements: { text_en: Txt }[];
  skills: { name: string; importance: string; min_level: number }[];
}) {
  return clean([
    `Job: ${d.title_en ?? ""}`,
    d.experience_level ? `Level: ${d.experience_level}${d.min_years ? `, ${d.min_years}+ years` : ""}` : null,
    d.description_en ? `Description: ${d.description_en.slice(0, 1500)}` : null,
    d.responsibilities_en ? `Responsibilities: ${[d.responsibilities_en].flat().join("; ").slice(0, 800)}` : null,
    d.qualifications_en ? `Qualifications: ${[d.qualifications_en].flat().join("; ").slice(0, 800)}` : null,
    d.requirements.length ? `Requirements: ${d.requirements.map((r) => r.text_en).filter(Boolean).join("; ")}` : null,
    d.skills.length ? `Skills: ${d.skills.map((s) => `${s.name} (${s.importance}, level ${s.min_level}+)`).join(", ")}` : null,
  ]);
}

export const CANDIDATE_EMBED_SELECT = {
  profile: "headline, summary, years_experience, experience_level",
  skills: "level, skill:skills(name_en)",
  experience: "title, company, description",
  projects: "title, description",
} as const;

export const JOB_EMBED_SELECT =
  "id, title_en, experience_level, min_years, description_en, responsibilities_en, qualifications_en, job_requirements(text_en), job_skills(importance, min_level, skill:skills(name_en))";
