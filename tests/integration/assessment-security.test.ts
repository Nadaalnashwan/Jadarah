import { describe, expect, it } from "vitest";
import { as, freshJob, integrationEnabled, userId } from "./helpers";

/** Confidential assessor material and reference library access (migration 0023), as real users. */
describe.skipIf(!integrationEnabled)("assessment materials & reference library security (live)", () => {
  it("candidates never reach assessor material; materials are scoped to assigned candidates and the owning company", async () => {
    const recruiter = await as("recruiter.elm");
    const { data: m } = await recruiter.from("company_memberships").select("company_id").eq("user_id", await userId(recruiter)).single();
    const cid = m!.company_id;

    // Draft assessment with one practical task, an assessor guide and two materials.
    const { data: a, error: aErr } = await recruiter
      .from("assessments")
      .insert({ company_id: cid, title_en: `Security test ${Date.now()}`, title_ar: "اختبار أمني", duration_minutes: 60, passing_score: 60, difficulty: "intermediate", category: "practical", status: "draft" })
      .select("id")
      .single();
    expect(aErr).toBeNull();
    const aid = a!.id;
    await recruiter.from("assessment_questions").insert({ assessment_id: aid, type: "case_study", prompt_en: "Analyse the data.", prompt_ar: "حلّل البيانات.", points: 5, position: 0 });
    await recruiter.from("assessment_assessor_guides").insert({ assessment_id: aid, company_id: cid, guide: { secret: "EXPECTED ANSWER 42" } });
    const up = async (aud: string, name: string, body: string) => {
      const path = `${aid}/${aud}/${name}`;
      const { error } = await recruiter.storage.from("assessment-materials").upload(path, new Blob([body], { type: "text/csv" }), { contentType: "text/csv" });
      expect(error).toBeNull();
      const { data, error: e2 } = await recruiter
        .from("assessment_materials")
        .insert({ assessment_id: aid, company_id: cid, audience: aud, file_name: name, storage_path: path, mime_type: "text/csv" })
        .select("id")
        .single();
      expect(e2).toBeNull();
      return { id: data!.id, path };
    };
    const cand = await up("candidate", "input.csv", "a,b\n1,2\n");
    const assr = await up("assessor", "answer_key.csv", "answer\n42\n");
    // Legacy-branded file names are refused by the database.
    expect((await recruiter.from("assessment_materials").insert({ assessment_id: aid, company_id: cid, audience: "candidate", file_name: "MIDAN_brief.pdf", storage_path: `${aid}/candidate/x.pdf`, mime_type: "application/pdf" })).error).not.toBeNull();
    await recruiter.from("assessments").update({ status: "published" }).eq("id", aid);

    // Candidate applies to a fresh Elm job and is assigned this assessment.
    const job = await freshJob(recruiter, cid);
    const candidate = await as("candidate12");
    const { data: appId } = await candidate.rpc("apply_to_job", { p_job: job.id, p_cv_document: null as unknown as string, p_cover_letter: "sec", p_answers: [] });
    expect((await recruiter.rpc("assign_assessment", { p_assessment: aid, p_application: appId as string, p_due_at: null as unknown as string })).error).toBeNull();

    // Assigned candidate: candidate material only.
    const { data: visible } = await candidate.from("assessment_materials").select("id, audience").eq("assessment_id", aid);
    expect((visible ?? []).map((v) => v.audience)).toEqual(["candidate"]);
    expect((await candidate.storage.from("assessment-materials").createSignedUrl(cand.path, 60)).error).toBeNull();
    expect((await candidate.storage.from("assessment-materials").createSignedUrl(assr.path, 60)).error).not.toBeNull();
    expect((await candidate.storage.from("assessment-materials").download(assr.path)).error).not.toBeNull();
    // No assessor guide, generations, references or reference assessor content for candidates.
    expect((await candidate.from("assessment_assessor_guides").select("guide").eq("assessment_id", aid)).data ?? []).toHaveLength(0);
    expect((await candidate.from("assessment_generations").select("id").limit(1)).data ?? []).toHaveLength(0);
    expect((await candidate.from("reference_assessments").select("id").limit(1)).data ?? []).toHaveLength(0);
    expect((await candidate.from("reference_assessment_assessor").select("reference_id").limit(1)).data ?? []).toHaveLength(0);
    expect((await candidate.rpc("reference_rubrics_for_builder", { p_ids: [] })).error).not.toBeNull();

    // A candidate who is NOT assigned sees nothing.
    const other = await as("candidate13");
    expect((await other.from("assessment_materials").select("id").eq("assessment_id", aid)).data ?? []).toHaveLength(0);
    expect((await other.storage.from("assessment-materials").createSignedUrl(cand.path, 60)).error).not.toBeNull();

    // Another company's recruiter sees nothing of Elm's assessment.
    const nawat = await as("recruiter.nawat");
    expect((await nawat.from("assessment_assessor_guides").select("guide").eq("assessment_id", aid)).data ?? []).toHaveLength(0);
    expect((await nawat.from("assessment_materials").select("id").eq("assessment_id", aid)).data ?? []).toHaveLength(0);

    // Recruiters may retrieve reference rubric STRUCTURE for grounding (no answer keys in the payload).
    const { data: refs } = await recruiter.from("reference_assessments").select("id").limit(2);
    const { data: rub, error: rErr } = await recruiter.rpc("reference_rubrics_for_builder", { p_ids: (refs ?? []).map((r) => r.id) });
    expect(rErr).toBeNull();
    expect(JSON.stringify(rub ?? [])).not.toMatch(/answer_expectations|assessor_guidance/);
    expect((await recruiter.from("reference_assessment_assessor").select("reference_id").limit(1)).data ?? []).toHaveLength(0);

    // Reference originals live in a private, Super Admin-only bucket.
    const original = "quality_engineer/assessor/ae46c3994ded-17_Quality_Engineer_Assessor_Guide_Answer_Key.pdf";
    for (const who of [recruiter, candidate]) {
      expect((await who.storage.from("reference-library").download(original)).error).not.toBeNull();
      expect((await who.storage.from("reference-library").createSignedUrl(original, 60)).error).not.toBeNull();
      expect((await who.storage.from("reference-library").list("quality_engineer/assessor")).data ?? []).toHaveLength(0);
    }
    const sa = await as("platform.admin");
    expect((await sa.storage.from("reference-library").createSignedUrl(original, 60)).error).toBeNull();
  }, 120_000);
});
