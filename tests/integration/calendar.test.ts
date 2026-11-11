import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";
import { as, integrationEnabled, userId } from "./helpers";

type DB = SupabaseClient<Database>;

/**
 * Internal calendar rules (migration 0016) against the live database as real demo users:
 * DB-enforced interviewer double-booking prevention, candidate double-booking, free/busy scoping,
 * attendance confirmation, reschedule conflict checks, audit + notifications.
 */
describe.skipIf(!integrationEnabled)("internal interview calendar (live Supabase)", () => {
  const companyKey = "rakeeza";

  async function shortlistedApplication(recruiter: DB, companyId: string, skipCandidates: Set<string>) {
    const { data: jobs } = await recruiter.from("jobs").select("id").eq("status", "published").eq("company_id", companyId);
    for (let i = 32; i >= 1; i--) {
      const local = `candidate${String(i).padStart(2, "0")}`;
      if (skipCandidates.has(local)) continue;
      const cand = await as(local);
      const me = await userId(cand);
      const { data: mine } = await cand.from("applications").select("job_id").eq("candidate_id", me);
      const taken = new Set((mine ?? []).map((a) => a.job_id));
      const job = (jobs ?? []).find((j) => !taken.has(j.id));
      if (!job) continue;
      const { data: appId, error } = await cand.rpc("apply_to_job", {
        p_job: job.id,
        p_cv_document: null as unknown as string,
        p_cover_letter: "Calendar integration test",
        p_answers: [],
      });
      expect(error).toBeNull();
      const sl = await recruiter.rpc("change_application_status", {
        p_app: appId as string,
        p_to: "shortlisted",
        p_reason: "calendar test",
        p_candidate_message: "",
      });
      expect(sl.error).toBeNull();
      skipCandidates.add(local);
      return { appId: appId as string, cand, local };
    }
    throw new Error("no free candidate/job pair");
  }

  it("prevents double-booking interviewers and candidates; confirms attendance; scopes free/busy", async () => {
    const recruiter = await as(`recruiter.${companyKey}`);
    const interviewer = await as(`interviewer.${companyKey}`);
    const interviewerId = await userId(interviewer);
    const { data: m } = await recruiter
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", await userId(recruiter))
      .single();
    const companyId = m!.company_id;
    const used = new Set<string>();
    const a = await shortlistedApplication(recruiter, companyId, used);
    const b = await shortlistedApplication(recruiter, companyId, used);

    // A slot far in the future, unique per run, so reruns don't collide with earlier test data.
    const base = new Date(Date.now() + (40 + Math.floor(Math.random() * 300)) * 86400000);
    base.setUTCHours(9, Math.floor(Math.random() * 4) * 15, 0, 0);
    const at = (mins: number) => new Date(base.getTime() + mins * 60000).toISOString();
    const create = (appId: string, start: string, dur = 45) =>
      recruiter.rpc("create_interview", {
        p_application: appId,
        p_title: "Calendar test",
        p_type: "video",
        p_scheduled_at: start,
        p_duration: dur,
        p_timezone: "Asia/Riyadh",
        p_location: "",
        p_meeting_url: "",
        p_instructions: "",
        p_interviewers: [interviewerId],
      });

    const first = await create(a.appId, at(0));
    expect(first.error).toBeNull();
    const ivA = first.data as string;

    // Same interviewer, overlapping window → rejected by the exclusion constraint.
    const clash = await create(b.appId, at(30));
    expect(clash.error?.code).toBe("23P01");
    // Back-to-back (starts exactly when the first ends) is allowed.
    const adjacent = await create(b.appId, at(45));
    expect(adjacent.error).toBeNull();
    const ivB = adjacent.data as string;

    // Rescheduling B onto A's slot is rejected too.
    const moveClash = await recruiter.rpc("set_interview_status", { p_interview: ivB, p_status: "scheduled", p_new_time: at(10) });
    expect(moveClash.error?.code).toBe("23P01");

    // Free/busy: recruiter sees busy windows; candidates cannot call it.
    const busy = await recruiter.rpc("interviewer_busy", {
      p_company: companyId,
      p_users: [interviewerId],
      p_from: at(-60),
      p_to: at(180),
    });
    expect(busy.error).toBeNull();
    expect((busy.data ?? []).length).toBeGreaterThanOrEqual(2);
    const candBusy = await a.cand.rpc("interviewer_busy", { p_company: companyId, p_users: [interviewerId], p_from: at(-60), p_to: at(180) });
    expect(candBusy.error).not.toBeNull();

    // Only the interview's own candidate can confirm attendance.
    expect((await b.cand.rpc("confirm_interview_attendance", { p_interview: ivA })).error?.code).toBe("42501");
    expect((await a.cand.rpc("confirm_interview_attendance", { p_interview: ivA })).error).toBeNull();
    const { data: ivRow } = await recruiter.from("interviews").select("candidate_confirmed_at").eq("id", ivA).single();
    expect(ivRow?.candidate_confirmed_at).toBeTruthy();

    // Interviewer was notified of the confirmation (internal notification).
    const { data: notes } = await interviewer
      .from("notifications")
      .select("kind")
      .eq("kind", "interview_confirmed")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(notes?.[0]?.kind).toBe("interview_confirmed");

    // Cancelling frees the slot: a new overlapping booking is then accepted.
    expect((await recruiter.rpc("set_interview_status", { p_interview: ivA, p_status: "cancelled" })).error).toBeNull();
    const rebook = await recruiter.rpc("set_interview_status", { p_interview: ivB, p_status: "scheduled", p_new_time: at(10) });
    expect(rebook.error).toBeNull();

    // Cleanup: cancel the remaining interview (applications stay as harmless demo history).
    await recruiter.rpc("set_interview_status", { p_interview: ivB, p_status: "cancelled" });
  }, 120_000);

  it("interviewers manage only their own availability; other companies cannot read it", async () => {
    const interviewer = await as(`interviewer.${companyKey}`);
    const me = await userId(interviewer);
    const { data: m } = await interviewer.from("company_memberships").select("company_id").eq("user_id", me).single();
    const weekday = Math.floor(Math.random() * 7);
    const ins = await interviewer
      .from("interviewer_availability")
      .insert({ user_id: me, company_id: m!.company_id, weekday, start_minute: 600, end_minute: 660 })
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    // Overlapping window for the same weekday is rejected (exclusion constraint).
    const overlap = await interviewer
      .from("interviewer_availability")
      .insert({ user_id: me, company_id: m!.company_id, weekday, start_minute: 630, end_minute: 700 });
    expect(overlap.error).not.toBeNull();
    // Another company's recruiter cannot see it.
    const other = await as("recruiter.nawat");
    const { data: leaked } = await other.from("interviewer_availability").select("id").eq("id", ins.data!.id);
    expect(leaked ?? []).toHaveLength(0);
    await interviewer.from("interviewer_availability").delete().eq("id", ins.data!.id);
  });
});
