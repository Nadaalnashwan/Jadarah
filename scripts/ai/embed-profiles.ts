/**
 * Backfill candidate + job embeddings (pgvector). Idempotent via content hashes; only changed
 * content is re-embedded. Service-role key (scripts only). In the app, embeddings refresh
 * automatically under the user's own session when profiles/jobs are viewed.
 *
 *   npm run ai:embed-profiles
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import {
  CANDIDATE_EMBED_SELECT,
  JOB_EMBED_SELECT,
  candidateEmbeddingText,
  contentHash,
  embedTexts,
  embeddingConfig,
  jobEmbeddingText,
  toPgVector,
} from "../../src/services/ai/embeddings-core";

(async () => {
  const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const cfg = embeddingConfig();
  if (!cfg.configured) throw new Error("Embeddings not configured");

  // ---- candidates ----
  const [{ data: profiles }, { data: skills }, { data: exp }, { data: proj }, { data: ce }] = await Promise.all([
    db.from("candidate_profiles").select(`user_id, ${CANDIDATE_EMBED_SELECT.profile}`),
    db.from("candidate_skills").select(`candidate_id, ${CANDIDATE_EMBED_SELECT.skills}`),
    db.from("candidate_experience").select(`candidate_id, ${CANDIDATE_EMBED_SELECT.experience}`),
    db.from("candidate_projects").select(`candidate_id, ${CANDIDATE_EMBED_SELECT.projects}`),
    db.from("candidate_embeddings").select("candidate_id, content_hash").eq("model", cfg.model),
  ]);
  const group = <T extends { candidate_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) m.set(r.candidate_id, [...(m.get(r.candidate_id) ?? []), r]);
    return m;
  };
  const gS = group(skills), gE = group(exp), gP = group(proj);
  const haveC = new Map((ce ?? []).map((r) => [r.candidate_id, r.content_hash]));
  const cTodo = (profiles ?? [])
    .map((p) => {
      const text = candidateEmbeddingText({
        headline: p.headline,
        summary: p.summary,
        experience_level: p.experience_level,
        years: p.years_experience,
        skills: (gS.get(p.user_id) ?? []).flatMap((s) =>
          s.skill ? [{ name: s.skill.name_en, level: s.level }] : [],
        ),
        experience: gE.get(p.user_id) ?? [],
        projects: gP.get(p.user_id) ?? [],
      });
      return { id: p.user_id, text, hash: contentHash(text, cfg) };
    })
    .filter((x) => x.text && haveC.get(x.id) !== x.hash);

  // ---- jobs ----
  const [{ data: jobs }, { data: je }] = await Promise.all([
    db.from("jobs").select(JOB_EMBED_SELECT),
    db.from("job_embeddings").select("job_id, content_hash").eq("model", cfg.model),
  ]);
  const haveJ = new Map((je ?? []).map((r) => [r.job_id, r.content_hash]));
  const jTodo = (jobs ?? [])
    .map((j) => {
      const text = jobEmbeddingText({
        ...j,
        requirements: j.job_requirements ?? [],
        skills: (j.job_skills ?? []).flatMap((s) =>
          s.skill ? [{ name: s.skill.name_en, importance: s.importance, min_level: s.min_level }] : [],
        ),
      });
      return { id: j.id as string, text, hash: contentHash(text, cfg) };
    })
    .filter((x) => haveJ.get(x.id) !== x.hash);

  console.log(`model=${cfg.model} candidates_to_embed=${cTodo.length}/${profiles?.length} jobs_to_embed=${jTodo.length}/${jobs?.length}`);
  const t0 = Date.now();
  const [cv, jv] = await Promise.all([embedTexts(cTodo.map((x) => x.text), "SEMANTIC_SIMILARITY"), embedTexts(jTodo.map((x) => x.text), "SEMANTIC_SIMILARITY")]);
  console.log(`embedded ${cv.length + jv.length} texts in ${Date.now() - t0} ms`);
  const now = new Date().toISOString();
  if (cTodo.length) {
    const { error } = await db.from("candidate_embeddings").upsert(
      cTodo.map((x, i) => ({ candidate_id: x.id, model: cfg.model, dims: cfg.dims, content_hash: x.hash, embedding: toPgVector(cv[i]), updated_at: now })),
      { onConflict: "candidate_id,model" },
    );
    if (error) throw error;
  }
  if (jTodo.length) {
    const { error } = await db.from("job_embeddings").upsert(
      jTodo.map((x, i) => ({ job_id: x.id, model: cfg.model, dims: cfg.dims, content_hash: x.hash, embedding: toPgVector(jv[i]), updated_at: now })),
      { onConflict: "job_id,model" },
    );
    if (error) throw error;
  }
  console.log("done");
})().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
