import { describe, expect, it } from "vitest";
import { as, integrationEnabled, userId } from "./helpers";

describe.skipIf(!integrationEnabled)("company assessments + semantic data (live Supabase)", () => {
  it("a recruiter can create a company assessment (INSERT … RETURNING, migration 0015); other companies cannot see it", async () => {
    const recruiter = await as("recruiter.nawat");
    const { data: m } = await recruiter
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", await userId(recruiter))
      .single();
    const { data, error } = await recruiter
      .from("assessments")
      .insert({
        title_en: "Integration test assessment",
        title_ar: "تقييم اختبار التكامل",
        duration_minutes: 20,
        passing_score: 60,
        difficulty: "intermediate",
        category: "technical",
        company_id: m!.company_id,
        status: "draft",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();

    const other = await as("recruiter.ofuq");
    const { data: leaked } = await other.from("assessments").select("id").eq("id", data!.id);
    expect(leaked ?? []).toHaveLength(0);
    const cand = await as("candidate03");
    const { data: candLeak } = await cand.from("assessments").select("id").eq("id", data!.id);
    expect(candLeak ?? []).toHaveLength(0);

    await recruiter.from("assessments").delete().eq("id", data!.id);
  });

  it("candidates cannot write another candidate's embedding; companies cannot write other companies' job embeddings", async () => {
    const a = await as("candidate04");
    const b = await as("candidate05");
    const bId = await userId(b);
    const vec = `[${Array.from({ length: 768 }, () => 0.01).join(",")}]`;
    const { error } = await a.from("candidate_embeddings").upsert({
      candidate_id: bId,
      model: "gemini-embedding-2",
      dims: 768,
      content_hash: "forged",
      embedding: vec,
    });
    expect(error).not.toBeNull();

    const other = await as("recruiter.ofuq");
    const nawat = await as("recruiter.nawat");
    const { data: nm } = await nawat
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", await userId(nawat))
      .single();
    const { data: nawatJob } = await nawat
      .from("jobs")
      .select("id")
      .eq("company_id", nm!.company_id)
      .limit(1)
      .single();
    const { error: jobErr } = await other.from("job_embeddings").upsert({
      job_id: nawatJob!.id,
      model: "gemini-embedding-2",
      dims: 768,
      content_hash: "forged",
      embedding: vec,
    });
    expect(jobErr).not.toBeNull();
  });

  it("semantic RPCs return only what the caller may see", async () => {
    const cand = await as("candidate01");
    const { data: ranking, error } = await cand.rpc("semantic_job_ranking", { p_model: "gemini-embedding-2", p_limit: 5 });
    expect(error).toBeNull();
    expect((ranking ?? []).length).toBeGreaterThan(0);
    // Another candidate's fit is not readable (their embedding is hidden by RLS) → null.
    const other = await userId(await as("candidate02"));
    const { data: fit } = await cand.rpc("semantic_fit", { p_candidate: other, p_job: ranking![0].job_id, p_model: "gemini-embedding-2" });
    expect(fit).toBeNull();
  });
});
