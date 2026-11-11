import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, onTestFinished } from "vitest";
import type { Database } from "../../src/types/database";
import { as, integrationEnabled, KEY, URL, userId } from "./helpers";

/**
 * Corrected recruitment workflow + CV onboarding, end to end through the real RPCs, RLS and Storage.
 * It signs up throwaway candidates, so it runs ONLY against a local Supabase (never a hosted project):
 *   supabase start  →  load the demo seed  →  npm run test:integration
 */
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL);
const enabled = integrationEnabled && isLocal;

const PDF = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

async function newCandidate(): Promise<{ client: SupabaseClient<Database>; id: string }> {
  const client = createClient<Database>(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
  const { data, error } = await client.auth.signUp({
    email,
    password: `Pw-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    options: { data: { account_type: "candidate", full_name: "Workflow Test Candidate", consent: "true" } },
  });
  if (error || !data.session) throw new Error(`sign-up failed (local email confirmation must be off): ${error?.message}`);
  return { client, id: data.user!.id };
}

/** Same steps as registerCvUpload: storage upload → make sure the profile row exists → record the version. */
async function uploadCv(c: SupabaseClient<Database>, uid: string) {
  const path = `${uid}/${crypto.randomUUID()}-cv.pdf`;
  const up = await c.storage.from("candidate-cvs").upload(path, PDF, { contentType: "application/pdf", upsert: false });
  expect(up.error).toBeNull();
  const cp = await c.from("candidate_profiles").upsert({ user_id: uid }, { onConflict: "user_id", ignoreDuplicates: true });
  expect(cp.error).toBeNull();
  const { data, error } = await c
    .from("candidate_documents")
    .insert({ candidate_id: uid, kind: "cv", bucket: "candidate-cvs", storage_path: path, file_name: "cv.pdf", mime_type: "application/pdf", size_bytes: PDF.byteLength, version: 1, is_primary: true })
    .select("id")
    .single();
  expect(error).toBeNull();
  return { id: data!.id, path };
}

async function jobWithTask(recruiter: SupabaseClient<Database>) {
  const { data: m } = await recruiter.from("company_memberships").select("company_id").eq("user_id", await userId(recruiter)).single();
  const companyId = m!.company_id;
  const { data: a, error: aErr } = await recruiter
    .from("assessments")
    .insert({ title_en: "WF task", title_ar: "مهمة", duration_minutes: 30, passing_score: 50, difficulty: "intermediate", category: "technical", company_id: companyId, status: "draft" })
    .select("id")
    .single();
  expect(aErr).toBeNull();
  const { data: q1 } = await recruiter
    .from("assessment_questions")
    .insert({ assessment_id: a!.id, type: "multiple_choice", prompt_en: "2+2?", prompt_ar: "2+2؟", points: 2, position: 0 })
    .select("id")
    .single();
  const { error: oErr } = await recruiter.from("assessment_options").insert([
    { question_id: q1!.id, label_en: "4", label_ar: "4", is_correct: true, position: 0 },
    { question_id: q1!.id, label_en: "5", label_ar: "5", is_correct: false, position: 1 },
  ]);
  expect(oErr).toBeNull();
  const { data: q2 } = await recruiter
    .from("assessment_questions")
    .insert({ assessment_id: a!.id, type: "long_answer", prompt_en: "Explain", prompt_ar: "اشرح", points: 3, position: 1 })
    .select("id")
    .single();
  expect((await recruiter.from("assessments").update({ status: "published" }).eq("id", a!.id)).error).toBeNull();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { data: job, error: jErr } = await recruiter
    .from("jobs")
    .insert({ company_id: companyId, title_en: `WF role ${stamp}`, title_ar: `وظيفة ${stamp}`, city: "Riyadh", status: "draft", min_years: 0, created_by: await userId(recruiter) })
    .select("id, listing_type")
    .single();
  expect(jErr).toBeNull();
  expect((await recruiter.rpc("attach_job_task", { p_job: job!.id, p_assessment: a!.id })).error).toBeNull();
  expect((await recruiter.from("jobs").update({ status: "published" }).eq("id", job!.id)).error).toBeNull();
  onTestFinished(async () => {
    await recruiter.from("jobs").update({ status: "closed" }).eq("id", job!.id);
  });
  return { jobId: job!.id, assessmentId: a!.id, mcq: q1!.id, open: q2!.id, dbGuard: job!.listing_type === "employer" };
}

describe.skipIf(!enabled)("recruitment workflow + CV onboarding (local Supabase)", () => {
  it("a brand-new candidate can upload a CV before onboarding; the original file is preserved and private", async () => {
    const { client, id } = await newCandidate();
    const { data: before } = await client.from("candidate_profiles").select("user_id").eq("user_id", id).maybeSingle();
    if (!before) {
      // The original defect: candidate_documents references candidate_profiles, which did not exist yet.
      const path = `${id}/${crypto.randomUUID()}-early.pdf`;
      await client.storage.from("candidate-cvs").upload(path, PDF, { contentType: "application/pdf" });
      const { error } = await client.from("candidate_documents").insert({ candidate_id: id, kind: "cv", storage_path: path, file_name: "early.pdf", mime_type: "application/pdf", size_bytes: PDF.byteLength });
      expect(error?.code).toBe("23503");
    }
    const { path } = await uploadCv(client, id);
    const { data: blob } = await client.storage.from("candidate-cvs").download(path);
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(PDF);
    const other = await as("candidate07");
    const { data: leak } = await other.storage.from("candidate-cvs").download(path);
    expect(leak).toBeNull();
    const { data: rows } = await other.from("candidate_documents").select("id").eq("storage_path", path);
    expect(rows ?? []).toHaveLength(0);
  });

  it("apply → task assigned immediately (no employer step) → submit → employer evaluates CV + evidence", async () => {
    const recruiter = await as("recruiter.nawat");
    const t = await jobWithTask(recruiter);
    const { client: cand, id: candId } = await newCandidate();
    const cv = await uploadCv(cand, candId);

    // Before applying, the employer cannot see this candidate's CV.
    expect((await recruiter.from("candidate_documents").select("id").eq("id", cv.id)).data ?? []).toHaveLength(0);

    const { data: appId, error } = await cand.rpc("apply_to_job", { p_job: t.jobId, p_cv_document: cv.id, p_cover_letter: "", p_answers: [] });
    expect(error).toBeNull();
    const { data: app } = await cand.from("applications").select("status, requires_task, task_assignment_id, completed_at").eq("id", appId as string).single();
    expect(app).toMatchObject({ status: "assessment_pending", requires_task: true, completed_at: null });
    expect(app!.task_assignment_id).toBeTruthy();
    const { data: asg } = await cand.from("assessment_assignments").select("id, assigned_by, status").eq("id", app!.task_assignment_id!).single();
    expect(asg).toMatchObject({ assigned_by: null, status: "assigned" }); // nobody at the company had to approve

    // Duplicate applications are still rejected.
    const dup = await cand.rpc("apply_to_job", { p_job: t.jobId, p_cv_document: cv.id, p_cover_letter: "", p_answers: [] });
    expect(dup.error?.code).toBe("23505");

    // While the task is outstanding the employer cannot shortlist (DB guard from proposal 0030, when applied;
    // the application layer enforces the same rule through employerTargets()).
    if (t.dbGuard) {
      const early = await recruiter.rpc("change_application_status", { p_app: appId as string, p_to: "shortlisted", p_reason: "", p_candidate_message: "" });
      expect(early.error?.message).toMatch(/not submitted the practical task/);
    }

    // Another candidate cannot open this task.
    const intruder = await as("candidate06");
    expect((await intruder.rpc("start_assessment", { p_assignment: asg!.id })).error?.code).toBe("42501");

    // The candidate starts immediately; the payload carries no answer keys.
    const { data: attempt, error: sErr } = await cand.rpc("start_assessment", { p_assignment: asg!.id });
    expect(sErr).toBeNull();
    const payload = JSON.stringify(attempt);
    expect(payload).not.toMatch(/is_correct|accepted_answers|explanation_/);
    const options = (attempt as { questions: { id: string; options: { id: string; label_en: string }[] }[] }).questions.find((q) => q.id === t.mcq)!.options;
    const right = options.find((o) => o.label_en === "4")!.id;
    expect((await cand.rpc("save_assessment_answer", { p_assignment: asg!.id, p_question: t.mcq, p_selected: [right] })).error).toBeNull();
    expect((await cand.rpc("save_assessment_answer", { p_assignment: asg!.id, p_question: t.open, p_selected: [], p_text: "My approach…" })).error).toBeNull();
    const { data: result, error: subErr } = await cand.rpc("submit_assessment", { p_assignment: asg!.id });
    expect(subErr).toBeNull();
    expect(result).toMatchObject({ auto_score: 2, needs_review: true });

    // Application complete; the employer now has the CV and the assessment evidence.
    const { data: done } = await recruiter.from("applications").select("status, completed_at, cv_document_id").eq("id", appId as string).single();
    expect(done!.status).toBe("assessment_completed");
    expect(done!.completed_at).toBeTruthy();
    const { data: sub } = await recruiter.from("assessment_submissions").select("id, status, auto_score, assessment_answers(question_id, text_answer)").eq("assignment_id", asg!.id).single();
    expect(sub!.status).toBe("submitted");
    expect(sub!.assessment_answers.find((a) => a.question_id === t.open)?.text_answer).toBe("My approach…");
    const signed = await recruiter.storage.from("candidate-cvs").createSignedUrl(cv.path, 60);
    expect(signed.error).toBeNull();

    // Interviews still require a shortlist; shortlisting is allowed now that the evidence is in.
    const iv = await recruiter.rpc("create_interview", {
      p_application: appId as string, p_title: "Too early", p_type: "video", p_scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
      p_duration: 30, p_timezone: "Asia/Riyadh", p_location: "", p_meeting_url: "", p_instructions: "", p_interviewers: [],
    });
    expect(iv.error?.message).toMatch(/shortlist/i);
    expect((await recruiter.rpc("change_application_status", { p_app: appId as string, p_to: "shortlisted", p_reason: "", p_candidate_message: "" })).error).toBeNull();
  });

  it("a Hired decision never needs a shortlist — even while the task is outstanding", async () => {
    const recruiter = await as("recruiter.nawat");
    const t = await jobWithTask(recruiter);
    const { client: cand } = await newCandidate();
    const { data: appId, error } = await cand.rpc("apply_to_job", { p_job: t.jobId, p_cv_document: null as unknown as string, p_cover_letter: "", p_answers: [] });
    expect(error).toBeNull();
    const hire = await recruiter.rpc("change_application_status", { p_app: appId as string, p_to: "hired", p_reason: "Direct hire", p_candidate_message: "" });
    expect(hire.error).toBeNull();
    const { data } = await recruiter.from("applications").select("status, was_shortlisted").eq("id", appId as string).single();
    expect(data).toMatchObject({ status: "hired", was_shortlisted: false });
  });
});
