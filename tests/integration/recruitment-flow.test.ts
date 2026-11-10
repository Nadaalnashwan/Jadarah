import { describe, expect, it } from "vitest";
import { as, integrationEnabled, userId } from "./helpers";

/**
 * Full recruitment journey against the live database, executed as real demo users:
 * apply → assessment (assign/start/save/submit/evaluate) → shortlist → interview (enforced) → evaluation → hire.
 * Every step goes through the production RPCs; nothing is mocked.
 */
describe.skipIf(!integrationEnabled)("recruitment business rules (live Supabase)", () => {
  async function freshApplication(companyKey: string) {
    const recruiter = await as(`recruiter.${companyKey}`);
    const { data: membership } = await recruiter
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", await userId(recruiter))
      .single();
    const { data: jobs } = await recruiter
      .from("jobs")
      .select("id, company_id")
      .eq("status", "published")
      .eq("company_id", membership!.company_id);
    for (let i = 1; i <= 32; i++) {
      const cand = await as(`candidate${String(i).padStart(2, "0")}`);
      const me = await userId(cand);
      const { data: mine } = await cand.from("applications").select("job_id").eq("candidate_id", me);
      const taken = new Set((mine ?? []).map((a) => a.job_id));
      const job = (jobs ?? []).find((j) => !taken.has(j.id));
      if (!job) continue;
      const { data: appId, error } = await cand.rpc("apply_to_job", {
        p_job: job.id,
        p_cv_document: null as unknown as string,
        p_cover_letter: "Integration test application",
        p_answers: [],
      });
      expect(error).toBeNull();
      return { cand, recruiter, appId: appId as string, jobId: job.id, candidateId: me };
    }
    throw new Error("no free candidate/job pair left for this company");
  }

  it("prevents duplicate applications", async () => {
    const { cand, jobId } = await freshApplication("rakeeza");
    const { error } = await cand.rpc("apply_to_job", {
      p_job: jobId,
      p_cv_document: null as unknown as string,
      p_cover_letter: "",
      p_answers: [],
    });
    expect(error?.message).toMatch(/already applied/);
  });

  it("allows hiring without prior shortlisting", async () => {
    const { recruiter, appId } = await freshApplication("souqa");
    const { error } = await recruiter.rpc("change_application_status", {
      p_app: appId,
      p_to: "hired",
      p_reason: "Direct hire (test)",
      p_candidate_message: "",
    });
    expect(error).toBeNull();
    const { data } = await recruiter
      .from("applications")
      .select("status, was_shortlisted")
      .eq("id", appId)
      .single();
    expect(data).toEqual({ status: "hired", was_shortlisted: false });
  });

  it("enforces the full journey and the shortlist-before-interview rule", async () => {
    const { cand, recruiter, appId } = await freshApplication("nawat");
    const interviewer = await as("interviewer.nawat");
    const interviewerId = await userId(interviewer);

    // 1. interview before shortlist is rejected by the database
    const early = await recruiter.rpc("create_interview", {
      p_application: appId,
      p_title: "Too early",
      p_type: "video",
      p_scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      p_duration: 30,
      p_timezone: "Asia/Riyadh",
      p_location: "",
      p_meeting_url: "",
      p_instructions: "",
      p_interviewers: [interviewerId],
    });
    expect(early.error?.message).toMatch(/shortlisted before an interview/);

    // 2. workflow-only statuses cannot be set manually
    const manual = await recruiter.rpc("change_application_status", {
      p_app: appId,
      p_to: "interview_scheduled",
      p_reason: "",
      p_candidate_message: "",
    });
    expect(manual.error?.message).toMatch(/set automatically/);

    // 3. assign a library assessment
    const { data: lib } = await recruiter
      .from("assessments")
      .select("id")
      .eq("slug", "programming-fundamentals")
      .single();
    const { data: asgId, error: asgErr } = await recruiter.rpc("assign_assessment", {
      p_assessment: lib!.id,
      p_application: appId,
    });
    expect(asgErr).toBeNull();
    expect(
      (await recruiter.from("applications").select("status").eq("id", appId).single()).data?.status,
    ).toBe("assessment_pending");

    // 4. candidate starts: no answer keys in the payload
    const { data: attempt, error: startErr } = await cand.rpc("start_assessment", {
      p_assignment: asgId as string,
    });
    expect(startErr).toBeNull();
    const raw = JSON.stringify(attempt);
    expect(raw).not.toMatch(/is_correct/);
    expect(raw).not.toMatch(/accepted_answers/);
    expect(raw).not.toMatch(/explanation_/);
    const qs = (attempt as { questions: { id: string; type: string; options: { id: string }[] }[] })
      .questions;

    // 5. save answers, then submit
    for (const q of qs) {
      const r = await cand.rpc("save_assessment_answer", {
        p_assignment: asgId as string,
        p_question: q.id,
        p_selected: q.options.length ? [q.options[0].id] : [],
        p_text: q.options.length ? undefined : "return",
      });
      expect(r.error).toBeNull();
    }
    const { data: submitted, error: subErr } = await cand.rpc("submit_assessment", {
      p_assignment: asgId as string,
    });
    expect(subErr).toBeNull();
    expect((submitted as { needs_review: boolean }).needs_review).toBe(true); // contains a coding question
    expect(
      (await recruiter.from("applications").select("status").eq("id", appId).single()).data?.status,
    ).toBe("assessment_completed");
    const resubmit = await cand.rpc("submit_assessment", { p_assignment: asgId as string });
    expect(resubmit.error).not.toBeNull();

    // 6. answer keys are visible after submission
    const { data: result } = await cand.rpc("get_assessment_result", { p_assignment: asgId as string });
    expect(JSON.stringify(result)).toMatch(/is_correct/);

    // 7. human rubric review of the open answer completes evaluation
    const { data: sub } = await recruiter
      .from("assessment_submissions")
      .select("id")
      .eq("assignment_id", asgId as string)
      .single();
    const coding = qs.find((q) => q.type === "coding")!;
    const ev = await recruiter.rpc("evaluate_assessment_answer", {
      p_submission: sub!.id,
      p_question: coding.id,
      p_points: 7,
      p_rubric_scores: { correctness: 3, reasoning: 2, clarity: 2 },
      p_comments: "Solid",
    });
    expect(ev.error).toBeNull();
    const { data: evaluated } = await recruiter
      .from("assessment_submissions")
      .select("status, percentage")
      .eq("id", sub!.id)
      .single();
    expect(evaluated?.status).toBe("evaluated");
    expect(evaluated?.percentage).not.toBeNull();
    const tooMany = await recruiter.rpc("evaluate_assessment_answer", {
      p_submission: sub!.id,
      p_question: coding.id,
      p_points: 999,
    });
    expect(tooMany.error).not.toBeNull();

    // 8. shortlist, then the interview is allowed
    expect(
      (
        await recruiter.rpc("change_application_status", {
          p_app: appId,
          p_to: "shortlisted",
          p_reason: "Strong evidence",
          p_candidate_message: "You're on our shortlist.",
        })
      ).error,
    ).toBeNull();
    const { data: ivId, error: ivErr } = await recruiter.rpc("create_interview", {
      p_application: appId,
      p_title: "Technical interview",
      p_type: "technical",
      p_scheduled_at: new Date(Date.now() + 2 * 86400000).toISOString(),
      p_duration: 45,
      p_timezone: "Asia/Riyadh",
      p_location: "",
      p_meeting_url: "https://meet.example.com/test",
      p_instructions: "",
      p_interviewers: [interviewerId],
    });
    expect(ivErr).toBeNull();
    expect(
      (await recruiter.from("applications").select("status").eq("id", appId).single()).data?.status,
    ).toBe("interview_scheduled");

    // 9. interviewer evaluates; the candidate can see the interview but not the evaluation
    expect(
      (
        await interviewer
          .from("interview_evaluations")
          .insert({
            interview_id: ivId as string,
            interviewer_id: interviewerId,
            recommendation: "yes",
            ratings: { technical: 4 },
          })
      ).error,
    ).toBeNull();
    expect(
      (
        await cand
          .from("interviews")
          .select("id")
          .eq("id", ivId as string)
      ).data,
    ).toHaveLength(1);
    expect(
      (
        await cand
          .from("interview_evaluations")
          .select("id")
          .eq("interview_id", ivId as string)
      ).data,
    ).toEqual([]);

    // 10. complete and hire; history and notification are recorded
    expect(
      (await recruiter.rpc("set_interview_status", { p_interview: ivId as string, p_status: "completed" }))
        .error,
    ).toBeNull();
    expect(
      (
        await recruiter.rpc("change_application_status", {
          p_app: appId,
          p_to: "hired",
          p_reason: "",
          p_candidate_message: "Welcome aboard!",
        })
      ).error,
    ).toBeNull();
    const { data: timeline } = await cand.rpc("get_application_timeline", { p_app: appId });
    expect((timeline ?? []).map((h) => h.to_status)).toEqual([
      "submitted",
      "assessment_pending",
      "assessment_completed",
      "shortlisted",
      "interview_scheduled",
      "interview_completed",
      "hired",
    ]);
    expect(JSON.stringify(timeline)).not.toMatch(/Strong evidence/); // internal reason never reaches the candidate
    const { data: notes } = await cand.from("notifications").select("kind").ilike("link", `%${appId}%`);
    expect((notes ?? []).length).toBeGreaterThan(3);

    // 11. closed applications cannot be withdrawn or moved
    expect((await cand.rpc("withdraw_application", { p_app: appId })).error?.message).toMatch(
      /no longer be withdrawn/,
    );
    expect(
      (await recruiter.rpc("change_application_status", { p_app: appId, p_to: "rejected" })).error?.message,
    ).toMatch(/invalid status transition/);
  });

  it("blocks unapproved companies from publishing", async () => {
    const pendingAdmin = await as("admin.imtidad");
    const { data: jobs } = await pendingAdmin.from("jobs").select("id").eq("status", "draft").limit(1);
    const { error } = await pendingAdmin.from("jobs").update({ status: "published" }).eq("id", jobs![0].id);
    expect(error?.message).toMatch(/approved before publishing/);
  });
});
