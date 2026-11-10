import { describe, expect, it } from "vitest";
import { anon, as, integrationEnabled, userId } from "./helpers";

/**
 * Security tests against the real database with real Auth identities (demo users).
 * They prove isolation through RLS + grants, not through mocked responses.
 */
describe.skipIf(!integrationEnabled)("RLS & authorization (live Supabase)", () => {
  it("candidate A cannot read candidate B's private records", async () => {
    const a = await as("candidate01");
    const me = await userId(a);
    const { data: apps } = await a.from("applications").select("candidate_id");
    expect(apps!.length).toBeGreaterThan(0);
    expect(new Set(apps!.map((r) => r.candidate_id))).toEqual(new Set([me]));
    const { data: docs } = await a.from("candidate_documents").select("candidate_id");
    expect(docs!.every((d) => d.candidate_id === me)).toBe(true);
    const { data: profiles } = await a.from("candidate_profiles").select("user_id");
    expect(profiles!.map((p) => p.user_id)).toEqual([me]);
  });

  it("candidates cannot see internal notes, status reasons, evaluations or answer keys", async () => {
    const c = await as("candidate01");
    for (const table of [
      "application_notes",
      "application_status_history",
      "interview_evaluations",
      "assessment_options",
      "assessment_questions",
      "assessment_evaluations",
    ] as const) {
      const { data, error } = await c.from(table).select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });

  it("company A cannot access company B's applications", async () => {
    const nawat = await as("recruiter.nawat");
    const ofuq = await as("recruiter.ofuq");
    const { data: a } = await nawat.from("applications").select("company_id");
    const { data: b } = await ofuq.from("applications").select("company_id");
    expect(a!.length).toBeGreaterThan(0);
    expect(new Set(a!.map((r) => r.company_id)).size).toBe(1);
    expect(new Set(b!.map((r) => r.company_id)).size).toBe(1);
    expect(a![0].company_id).not.toBe(b![0].company_id);
  });

  it("interviewers only see assigned interviews and never internal notes", async () => {
    const i = await as("interviewer.nawat");
    const me = await userId(i);
    const { data: interviews } = await i.from("interviews").select("id, interview_participants(user_id)");
    expect(interviews!.length).toBeGreaterThan(0);
    for (const iv of interviews!) expect(iv.interview_participants.some((p) => p.user_id === me)).toBe(true);
    const { data: notes } = await i.from("application_notes").select("id");
    expect(notes).toEqual([]);
  });

  it("users cannot promote themselves", async () => {
    const c = await as("candidate02");
    const me = await userId(c);
    const { error: e1 } = await c.from("user_roles").insert({ user_id: me, role: "super_admin" });
    expect(e1).not.toBeNull();
    const { error: e2 } = await c.from("profiles").update({ account_type: "admin" }).eq("id", me);
    expect(e2?.message).toMatch(/protected/);
    const { error: e3 } = await c.rpc("admin_grant_role", { p_user: me, p_role: "super_admin" });
    expect(e3?.message).toMatch(/super admin only/);
  });

  it("super admin RPCs reject non-admins and work for admins", async () => {
    const c = await as("candidate03");
    const { error } = await c.rpc("admin_platform_stats");
    expect(error?.message).toMatch(/super admin only/);
    const admin = await as("platform.admin");
    const { data, error: e2 } = await admin.rpc("admin_platform_stats");
    expect(e2).toBeNull();
    expect((data as { companies: number }).companies).toBeGreaterThanOrEqual(10);
  });

  it("anonymous users only see public catalogue data", async () => {
    const a = anon();
    const { data: jobs } = await a.from("jobs").select("status");
    expect(jobs!.every((j) => j.status === "published" || j.status === "closed")).toBe(true);
    const { error } = await a.from("applications").select("id");
    expect(error).not.toBeNull();
    const { error: e2 } = await a.from("candidate_profiles").select("user_id");
    expect(e2).not.toBeNull();
  });

  it("internal helper functions are not callable through the API", async () => {
    const c = await as("candidate01");
    const { error } = await c.rpc("seed_demo" as never, { p_password: "x".repeat(20) } as never);
    expect(error).not.toBeNull();
  });
});
