/**
 * Embed the skill taxonomy into public.skill_embeddings (pgvector). Idempotent: skips skills whose
 * content hash for the configured model is unchanged. Uses the service-role key (scripts only).
 *
 *   npm run ai:embed-skills
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { contentHash, embedTexts, embeddingConfig, skillEmbeddingText, toPgVector } from "../../src/services/ai/embeddings-core";

(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const cfg = embeddingConfig();
  if (!cfg.configured) throw new Error("Embeddings not configured (GEMINI_API_KEY)");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const [{ data: skills, error }, { data: existing }] = await Promise.all([
    db.from("skills").select("id, name_en, name_ar, aliases, kind"),
    db.from("skill_embeddings").select("skill_id, content_hash").eq("model", cfg.model),
  ]);
  if (error) throw error;
  const have = new Map((existing ?? []).map((e) => [e.skill_id, e.content_hash]));
  const todo = (skills ?? [])
    .map((s) => ({ s, text: skillEmbeddingText(s) }))
    .map((x) => ({ ...x, hash: contentHash(x.text, cfg) }))
    .filter((x) => have.get(x.s.id) !== x.hash);
  console.log(`model=${cfg.model} dims=${cfg.dims} skills=${skills?.length} to_embed=${todo.length}`);
  if (!todo.length) return;

  const started = Date.now();
  const vecs = await embedTexts(todo.map((t) => t.text), "SEMANTIC_SIMILARITY");
  console.log(`embedded ${vecs.length} in ${Date.now() - started} ms`);
  const rows = todo.map((t, i) => ({
    skill_id: t.s.id,
    model: cfg.model,
    dims: cfg.dims,
    content_hash: t.hash,
    embedding: toPgVector(vecs[i]),
    updated_at: new Date().toISOString(),
  }));
  const { error: upErr } = await db.from("skill_embeddings").upsert(rows, { onConflict: "skill_id,model" });
  if (upErr) throw upErr;
  console.log(`upserted ${rows.length} skill embeddings`);
})().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
