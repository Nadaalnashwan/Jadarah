import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "../../src/types/database";
import { KEY, URL, anon, as, freshJob, integrationEnabled, userId } from "./helpers";

/**
 * B2B access model (migration 0020) against the live database. The service-role key is used ONLY to
 * create throwaway employer accounts with confirmed emails (setup); every assertion runs as a real
 * signed-in user through RLS and RPCs.
 */
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
describe.skipIf(!integrationEnabled || !SERVICE)("B2B provisioning, access requests and subscriptions (live)", () => {
  const admin = createClient<Database>(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  async function employer(tag: string) {
    const email = `it-employer-${tag}-${Date.now()}@jadarah-demo.test`;
    const password = `Itest-${Math.random().toString(36).slice(2)}-9x`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Integration employer ${tag}`, account_type: "company" },
    });
    if (error) throw error;
    await admin.from("profiles").update({ is_demo: true }).eq("id", data.user.id);
    const c = createClient<Database>(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: e2 } = await c.auth.signInWithPassword({ email, password });
    if (e2) throw e2;
    return c;
  }

  it("provision → request → pending → approve → subscription gates access; rejection and isolation hold", async () => {
    const sa = await as("platform.admin");
    const name = `Integration Test Org ${Date.now()}`;
    const { data: orgId, error: pErr } = await sa.rpc("admin_provision_company", { p_name_en: name, p_name_ar: `جهة اختبار ${Date.now()}`, p_sector_en: "Testing" });
    expect(pErr).toBeNull();
    const org = orgId as string;
    const { data: sub0 } = await sa.from("company_subscriptions").select("status").eq("company_id", org).single();
    expect(sub0?.status).toBe("pending");

    // Not accepting requests yet → refused. Candidates can never request employer access.
    const emp = await employer("a");
    expect((await emp.rpc("request_company_access", { p_company: org, p_job_title: "Recruiter", p_role: "recruiter" })).error).not.toBeNull();
    const cand = await as("candidate07");
    await sa.from("company_profiles").update({ accepts_access_requests: true }).eq("id", org);
    expect((await cand.rpc("request_company_access", { p_company: org, p_job_title: "x", p_role: "recruiter" })).error).not.toBeNull();

    // Pending request → no workspace.
    const { data: reqId, error: rErr } = await emp.rpc("request_company_access", { p_company: org, p_job_title: "Talent Partner", p_role: "company_admin" });
    expect(rErr).toBeNull();
    expect((await emp.rpc("request_company_access", { p_company: org, p_job_title: "dup", p_role: "recruiter" })).error).not.toBeNull();
    expect((await emp.from("company_memberships").select("id").eq("company_id", org)).data ?? []).toHaveLength(0);
    // The employee cannot approve themselves.
    expect((await emp.rpc("review_access_request", { p_request: reqId as string, p_decision: "approve" })).error).not.toBeNull();

    // Super Admin approves with an adjusted role.
    expect((await sa.rpc("review_access_request", { p_request: reqId as string, p_decision: "approve", p_role: "recruiter" })).error).toBeNull();
    const { data: mem } = await emp.from("company_memberships").select("role, status").eq("company_id", org).single();
    expect(mem).toEqual({ role: "recruiter", status: "active" });

    // Approved but subscription pending → employer data is not accessible.
    await expect(freshJob(emp, org)).rejects.toThrow();
    // Activate → works.
    await sa.from("company_subscriptions").update({ status: "active", is_demo: true, payment_status: "demo" }).eq("company_id", org);
    const job = await freshJob(emp, org);
    expect((await emp.from("jobs").select("id").eq("id", job.id)).data).toHaveLength(1);
    // Suspend → blocked; data preserved (Super Admin still sees it).
    await sa.from("company_subscriptions").update({ status: "suspended" }).eq("company_id", org);
    expect((await emp.from("jobs").select("id").eq("company_id", org)).data ?? []).toHaveLength(0);
    expect((await sa.from("jobs").select("id").eq("id", job.id)).data).toHaveLength(1);
    // Active but past its expiry date → blocked.
    await sa.from("company_subscriptions").update({ status: "active", starts_on: "2020-01-01", expires_on: "2020-12-31" }).eq("company_id", org);
    expect((await emp.from("jobs").select("id").eq("company_id", org)).data ?? []).toHaveLength(0);
    await sa.from("company_subscriptions").update({ expires_on: null }).eq("company_id", org);
    expect((await emp.from("jobs").select("id").eq("company_id", org)).data ?? []).toHaveLength(1);

    // Cross-company isolation: this recruiter cannot read another organization's applications.
    const { data: elm } = await sa.from("company_profiles").select("id").eq("registry_id", "ALM-003").single();
    expect((await emp.from("applications").select("id").eq("company_id", elm!.id)).data ?? []).toHaveLength(0);

    // Rejected request → no access.
    const emp2 = await employer("b");
    const { data: req2 } = await emp2.rpc("request_company_access", { p_company: org, p_job_title: "Interviewer", p_role: "interviewer" });
    expect((await sa.rpc("review_access_request", { p_request: req2 as string, p_decision: "reject", p_note: "Not verified" })).error).toBeNull();
    expect((await emp2.from("company_memberships").select("id").eq("company_id", org)).data ?? []).toHaveLength(0);
    expect((await emp2.from("jobs").select("id").eq("company_id", org)).data ?? []).toHaveLength(0);

    // Public self-service company creation is closed for employer accounts too.
    expect((await emp2.rpc("create_company" as never, { p_name_en: "Free", p_name_ar: "مجاني" } as never)).error).not.toBeNull();

    // Tidy: cancel the throwaway organization's access (nothing deleted).
    await sa.from("company_subscriptions").update({ status: "cancelled" }).eq("company_id", org);
    expect(await userId(emp)).toBeTruthy();
  }, 120_000);

  it("public catalogue lists only listed organizations; credits are enforced", async () => {
    const a = anon();
    const { data: jobs } = await a.from("jobs").select("id, company:company_profiles!inner(listed, registry_id)").eq("status", "published");
    expect((jobs ?? []).length).toBeGreaterThan(0);
    expect((jobs ?? []).every((j) => j.company?.listed)).toBe(true);

    // Credits: exhausting the allowance blocks new assessment assignments.
    const sa = await as("platform.admin");
    const recruiter = await as("recruiter.madar");
    const { data: m } = await recruiter.from("company_memberships").select("company_id").eq("user_id", await userId(recruiter)).single();
    const cid = m!.company_id;
    const { data: sub } = await sa.from("company_subscriptions").select("credits_used, assessment_credits").eq("company_id", cid).single();
    await sa.from("company_subscriptions").update({ assessment_credits: sub!.credits_used }).eq("company_id", cid);
    try {
      const job = await freshJob(recruiter, cid);
      const cand = await as("candidate09");
      const { data: appId } = await cand.rpc("apply_to_job", { p_job: job.id, p_cv_document: null as unknown as string, p_cover_letter: "credits", p_answers: [] });
      const { data: asmt } = await recruiter.from("assessments").select("id").eq("status", "published").is("company_id", null).limit(1).single();
      const res = await recruiter.rpc("assign_assessment", { p_assessment: asmt!.id, p_application: appId as string, p_due_at: null as unknown as string });
      expect(res.error?.message).toMatch(/credits exhausted/);
    } finally {
      await sa.from("company_subscriptions").update({ assessment_credits: sub!.assessment_credits }).eq("company_id", cid);
    }
  }, 120_000);
});
