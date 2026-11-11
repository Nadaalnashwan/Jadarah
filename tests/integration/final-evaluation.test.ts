import { describe, expect, it } from "vitest";
import { as, integrationEnabled, userId } from "./helpers";

/** Final Candidate Evaluation rules (migration 0019) against the live database as demo users. */
describe.skipIf(!integrationEnabled)("final candidate evaluation (live Supabase)", () => {
  it("is company-internal, workflow-guarded, locks on finalize, and shares only explicit feedback", async () => {
    const recruiter = await as("recruiter.madar");
    const { data: m } = await recruiter.from("company_memberships").select("company_id").eq("user_id", await userId(recruiter)).single();
    const companyId = m!.company_id;
    const { data: jobs } = await recruiter.from("jobs").select("id").eq("status", "published").eq("company_id", companyId);

    // fresh application (NOT shortlisted) so we can prove hire-without-shortlist through the report
    let appId = "";
    let candLocal = "";
    for (let i = 1; i <= 32 && !appId; i++) {
      const local = `candidate${String(i).padStart(2, "0")}`;
      const cand = await as(local);
      const me = await userId(cand);
      const { data: mine } = await cand.from("applications").select("job_id").eq("candidate_id", me);
      const job = (jobs ?? []).find((j) => !(mine ?? []).some((a) => a.job_id === j.id));
      if (!job) continue;
      const { data, error } = await cand.rpc("apply_to_job", { p_job: job.id, p_cv_document: null as unknown as string, p_cover_letter: "final eval test", p_answers: [] });
      expect(error).toBeNull();
      appId = data as string;
      candLocal = local;
    }
    expect(appId).not.toBe("");

    const { data: fe, error: insErr } = await recruiter
      .from("final_evaluations")
      .insert({ application_id: appId, company_id: companyId, summary: "Initial panel notes" })
      .select("id")
      .single();
    expect(insErr).toBeNull();

    // Another company cannot read it; the candidate cannot read it either.
    const other = await as("recruiter.nawat");
    expect((await other.from("final_evaluations").select("id").eq("id", fe!.id)).data ?? []).toHaveLength(0);
    const cand = await as(candLocal);
    expect((await cand.from("final_evaluations").select("id").eq("id", fe!.id)).data ?? []).toHaveLength(0);
    // Candidate cannot decide; a direct status/decision write is refused.
    expect((await cand.rpc("decide_final_evaluation", { p_eval: fe!.id, p_decision: "hire", p_rationale: "self-hire attempt" })).error).not.toBeNull();
    expect((await recruiter.from("final_evaluations").update({ status: "finalized", decision: "hire" }).eq("id", fe!.id)).error).not.toBeNull();
    // Inserting with a forged company is refused.
    expect((await other.from("final_evaluations").insert({ application_id: appId, company_id: companyId })).error).not.toBeNull();

    // Comment attribution.
    const c = await recruiter.from("final_evaluation_comments").insert({ final_evaluation_id: fe!.id, body: "Strong SQL in the task." }).select("author_id").single();
    expect(c.error).toBeNull();
    expect(c.data?.author_id).toBe(await userId(recruiter));

    // Rationale is required.
    expect((await recruiter.rpc("decide_final_evaluation", { p_eval: fe!.id, p_decision: "hire", p_rationale: "ok" })).error).not.toBeNull();
    // Human decision: hire WITHOUT prior shortlisting (business rule preserved) → finalized + locked.
    const decided = await recruiter.rpc("decide_final_evaluation", {
      p_eval: fe!.id,
      p_decision: "hire",
      p_rationale: "Hire: strong evidence across the panel.",
      p_candidate_message: "Congratulations!",
    });
    expect(decided.error).toBeNull();
    const { data: app } = await recruiter.from("applications").select("status, was_shortlisted").eq("id", appId).single();
    expect(app).toEqual({ status: "hired", was_shortlisted: false });
    expect((await recruiter.from("final_evaluations").update({ summary: "edit after finalize" }).eq("id", fe!.id)).error).not.toBeNull();

    // Explicit feedback sharing → only the owning candidate can read it.
    expect((await recruiter.rpc("share_final_feedback", { p_eval: fe!.id, p_feedback: "Your SQL task stood out; keep building on data modelling." })).error).toBeNull();
    const mine = await cand.rpc("get_shared_final_feedback", { p_app: appId });
    expect(mine.data?.[0]?.feedback).toMatch(/SQL task/);
    const stranger = await as(candLocal === "candidate01" ? "candidate02" : "candidate01");
    expect((await stranger.rpc("get_shared_final_feedback", { p_app: appId })).data ?? []).toHaveLength(0);
  }, 120_000);
});
