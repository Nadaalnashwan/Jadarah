import "server-only";
import type { MatchResult } from "@/lib/domain/matching";
import type { Locale } from "@/lib/i18n/config";
import type { createClient } from "@/lib/supabase/server";
import {
  CANDIDATE_EMBED_SELECT,
  JOB_EMBED_SELECT,
  candidateEmbeddingText,
  contentHash,
  embedTexts,
  embeddingConfig,
  jobEmbeddingText,
  toPgVector,
} from "@/services/ai/embeddings";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Measured on the 63-skill taxonomy with gemini-embedding-2 @768d (2026-11-11): unrelated skill
 * pairs have median cosine 0.78 and p99 0.88 (Java↔JavaScript = 0.90). 0.92 keeps only genuinely
 * related pairs (e.g. Machine Learning↔Deep Learning 0.96, Critical Thinking↔Problem Solving 0.92).
 */
export const RELATED_SKILL_MIN = Number(process.env.SEMANTIC_RELATED_MIN ?? 0.92);

/** Re-embed the signed-in candidate's profile if its content changed (RLS: own row only). */
export async function ensureCandidateEmbedding(supabase: ServerSupabase, candidateId: string) {
  const cfg = embeddingConfig();
  if (!cfg.configured) return false;
  const [{ data: profile }, { data: skills }, { data: experience }, { data: projects }, { data: existing }] =
    await Promise.all([
      supabase.from("candidate_profiles").select(CANDIDATE_EMBED_SELECT.profile).eq("user_id", candidateId).maybeSingle(),
      supabase.from("candidate_skills").select(CANDIDATE_EMBED_SELECT.skills).eq("candidate_id", candidateId),
      supabase.from("candidate_experience").select(CANDIDATE_EMBED_SELECT.experience).eq("candidate_id", candidateId),
      supabase.from("candidate_projects").select(CANDIDATE_EMBED_SELECT.projects).eq("candidate_id", candidateId),
      supabase
        .from("candidate_embeddings")
        .select("content_hash")
        .eq("candidate_id", candidateId)
        .eq("model", cfg.model)
        .maybeSingle(),
    ]);
  const text = candidateEmbeddingText({
    headline: profile?.headline,
    summary: profile?.summary,
    experience_level: profile?.experience_level,
    years: profile?.years_experience,
    skills: (skills ?? []).flatMap((s) => (s.skill ? [{ name: s.skill.name_en, level: s.level }] : [])),
    experience: experience ?? [],
    projects: projects ?? [],
  });
  if (!text) return false;
  const hash = contentHash(text, cfg);
  if (existing?.content_hash === hash) return true;
  const [vec] = await embedTexts([text]);
  const { error } = await supabase.from("candidate_embeddings").upsert(
    {
      candidate_id: candidateId,
      model: cfg.model,
      dims: cfg.dims,
      content_hash: hash,
      embedding: toPgVector(vec),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "candidate_id,model" },
  );
  return !error;
}

/** Re-embed a job if its content changed. Only succeeds for the job's own recruiters (RLS). */
export async function ensureJobEmbedding(supabase: ServerSupabase, jobId: string) {
  const cfg = embeddingConfig();
  if (!cfg.configured) return false;
  const [{ data: job }, { data: existing }] = await Promise.all([
    supabase.from("jobs").select(JOB_EMBED_SELECT).eq("id", jobId).maybeSingle(),
    supabase.from("job_embeddings").select("content_hash").eq("job_id", jobId).eq("model", cfg.model).maybeSingle(),
  ]);
  if (!job) return false;
  const text = jobEmbeddingText({
    ...job,
    requirements: job.job_requirements ?? [],
    skills: (job.job_skills ?? []).flatMap((s) =>
      s.skill ? [{ name: s.skill.name_en, importance: s.importance, min_level: s.min_level }] : [],
    ),
  });
  const hash = contentHash(text, cfg);
  if (existing?.content_hash === hash) return true;
  const [vec] = await embedTexts([text]);
  const { error } = await supabase.from("job_embeddings").upsert(
    { job_id: jobId, model: cfg.model, dims: cfg.dims, content_hash: hash, embedding: toPgVector(vec), updated_at: new Date().toISOString() },
    { onConflict: "job_id,model" },
  );
  return !error;
}

/**
 * Add semantic context to an explainable match: related skills for missing/partial requirements
 * and an overall profile↔job similarity. Never changes the evidence-based score or statuses.
 * Any failure leaves the match unchanged (semantic info is optional).
 */
export async function withSemantics(
  supabase: ServerSupabase,
  match: MatchResult,
  opts: { candidateId: string; jobId: string; candidateSkillIds: string[]; locale: Locale; refreshCandidate?: boolean; refreshJob?: boolean },
): Promise<MatchResult> {
  const cfg = embeddingConfig();
  if (!cfg.configured) return match;
  try {
    await Promise.all([
      opts.refreshCandidate ? ensureCandidateEmbedding(supabase, opts.candidateId).catch(() => false) : null,
      opts.refreshJob ? ensureJobEmbedding(supabase, opts.jobId).catch(() => false) : null,
    ]);
    const gaps = match.requirements.filter((r) => r.status === "missing" || r.status === "partial").map((r) => r.skill_id);
    const [related, fit] = await Promise.all([
      gaps.length && opts.candidateSkillIds.length
        ? supabase.rpc("related_skills", {
            p_required: gaps,
            p_have: opts.candidateSkillIds,
            p_model: cfg.model,
            p_min: RELATED_SKILL_MIN,
          })
        : Promise.resolve({ data: [] as { required_skill_id: string; related_skill_id: string; similarity: number }[] }),
      supabase.rpc("semantic_fit", { p_candidate: opts.candidateId, p_job: opts.jobId, p_model: cfg.model }),
    ]);
    const rel = related.data ?? [];
    const names = new Map<string, string>();
    if (rel.length) {
      const { data } = await supabase
        .from("skills")
        .select("id, name_en, name_ar")
        .in("id", rel.map((r) => r.related_skill_id));
      for (const s of data ?? []) names.set(s.id, opts.locale === "ar" ? s.name_ar : s.name_en);
    }
    const byReq = new Map(rel.map((r) => [r.required_skill_id, r]));
    return {
      ...match,
      requirements: match.requirements.map((r) => {
        const x = byReq.get(r.skill_id);
        return x
          ? { ...r, related: { skill_id: x.related_skill_id, name: names.get(x.related_skill_id) ?? "", similarity: x.similarity } }
          : r;
      }),
      semantic: {
        fit: typeof fit.data === "number" ? fit.data : null,
        model: cfg.model,
        relatedThreshold: RELATED_SKILL_MIN,
      },
    };
  } catch {
    return match;
  }
}
