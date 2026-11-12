/**
 * Employer review of the exhibition submissions, as each organization's recruiter, through the same RPCs the review
 * screen uses: accept the stored AI suggestion (Q2), accept or adjust it with a reason (Q3), score Q4 independently,
 * share feedback with some candidates, shortlist strong candidates and schedule their interviews (create_interview).
 * DGDA, Sipchem and SIDF submissions are left unreviewed for live demonstration. Idempotent.
 *
 *   npx tsx scripts/exhibition/review.ts <private dir>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { JOBS } from "./data-jobs";
import { SUBMISSIONS } from "./data-submissions";

config({ path: ".env.local", quiet: true });
const PRIV = process.argv[2];
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const creds: Record<string, { password: string }> = JSON.parse(readFileSync(join(PRIV, "credentials.json"), "utf8"));
const MANIFEST = join(PRIV, "demo-manifest.json");
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
manifest.reviews ??= {};
manifest.interviews ??= {};
const LIVE_REVIEW = new Set(["dgda-procurement", "sipchem-supply", "sidf-audit"]);
const ADJUST = new Set(["elm-ta|sarah.alharbi@jadarah.example", "stc-cx|joud.alshammari@jadarah.example", "mof-budget|reem.almutairi@jadarah.example"]);
const SHARE = new Set(["moc-legal|noura.alotaibi@jadarah.example", "moc-legal|haya.aldosari@jadarah.example", "elm-ta|joud.alshammari@jadarah.example", "gea-pr|khalid.alanazi@jadarah.example", "mof-budget|turki.alsubaie@jadarah.example", "sdaia-strategy|haya.aldosari@jadarah.example"]);
// Strong candidates at organizations that had no interviews yet: shortlist and interview tomorrow (Asia/Riyadh).
const INTERVIEWS: Record<string, { at: string; type: "technical" | "behavioral"; title: string }> = {
  "moc-legal|noura.alotaibi@jadarah.example": { at: "2026-11-13T10:00:00+03:00", type: "technical", title: "Legal case interview — Legal Specialist" },
  "mof-budget|turki.alsubaie@jadarah.example": { at: "2026-11-13T11:00:00+03:00", type: "technical", title: "Technical interview — Budget Analyst" },
  "gea-pr|sarah.alharbi@jadarah.example": { at: "2026-11-13T12:00:00+03:00", type: "behavioral", title: "Behavioural interview — Public Relations Specialist" },
};
const Q4_SCORE: Record<string, number> = { excellent: 4, good: 3, average: 2, partial: 0, weak: 1 };

const sessions = new Map<string, SupabaseClient>();
async function as(email: string) {
  if (sessions.has(email)) return sessions.get(email)!;
  const c = createClient(URL, KEY, { auth: { persistSession: false } });
  if (creds[email]) {
    const { error } = await c.auth.signInWithPassword({ email, password: creds[email].password });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;
    const { error: e2 } = await c.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
    if (e2) throw e2;
  }
  sessions.set(email, c);
  return c;
}
const list = (x: unknown) => (Array.isArray(x) ? (x as unknown[]).map(String).slice(0, 3).join(" ") : "");
const save = () => writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1), { mode: 0o600 });

(async () => {
  for (const s of SUBMISSIONS) {
    const key = `${s.job}|${s.candidate}`;
    if (LIVE_REVIEW.has(s.job)) continue;
    const job = JOBS.find((j) => j.key === s.job)!;
    const rec = await as(`recruiter.${job.short}@jadarah.example`);
    const app = manifest.applications[key];
    const qids: string[] = manifest.jobs[s.job].questions;
    const done = manifest.reviews[key] ?? {};
    for (const qn of [2, 3, 4]) {
      if (done[`q${qn}`]) continue;
      const qid = qids[qn - 1];
      const { count: reviewed } = await admin.from("assessment_evaluations").select("id", { count: "exact", head: true }).eq("submission_id", app.submission).eq("question_id", qid);
      if (reviewed) {
        done[`q${qn}`] = "existing";
        continue;
      }
      let points: number;
      let rubric: Record<string, number> = {};
      let comments: string;
      let feedback = { strengths: "", missing: "", improvements: "" };
      let aiId: string | undefined;
      if (qn < 4) {
        const { data: ai } = await admin.from("assessment_ai_evaluations").select("id, status, score, max_score, criteria, strengths, issues, improvements").eq("submission_id", app.submission).eq("question_id", qid).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!ai || ai.status !== "completed" || ai.score === null) {
          console.log(`no AI result ${key} Q${qn} — left for review`);
          continue;
        }
        aiId = ai.id;
        rubric = Object.fromEntries(((ai.criteria as { key: string; score: number }[]) ?? []).map((c) => [c.key, Number(c.score)]));
        feedback = { strengths: list(ai.strengths), missing: list(ai.issues), improvements: list(ai.improvements) };
        points = Number(ai.score);
        comments = "AI suggestion reviewed against the submission; accepted.";
        if (qn === 3 && ADJUST.has(key)) {
          const issue = (ai.issues as string[] | null)?.[0] ?? "the main gap in the file";
          points = Math.max(0, points - 1);
          // Lower the largest criterion so the criterion scores still add up to the approved total.
          const top = Object.entries(rubric).sort((a, b) => b[1] - a[1])[0];
          if (top && top[1] >= 1) rubric[top[0]] = top[1] - 1;
          comments = `Adjusted by 1 point: the reviewer weighs this issue more heavily for the role — ${issue}`;
        }
      } else {
        // Question 4 has no AI run: an independent reviewer score against the question's criteria.
        const q = job.task.questions[3];
        points = Q4_SCORE[s.quality];
        const per = q.criteria!.map((c) => c.max);
        let left = points;
        rubric = Object.fromEntries(q.criteria!.map((c, i) => {
          const v = Math.min(per[i], left);
          left -= v;
          return [c.key, v];
        }));
        comments = "Independent reviewer assessment against the question criteria (no AI suggestion used).";
        feedback = { strengths: points >= 3 ? "Clear, specific answer that meets the criteria." : "", missing: points < 4 ? (s.q4 ? "Some required elements are missing or not specific enough." : "No answer was submitted for this question.") : "", improvements: points < 4 ? "Address every element in the question with concrete figures or examples." : "" };
      }
      const { error } = await rec.rpc("review_assessment_question", { p_submission: app.submission, p_question: qid, p_points: points, p_rubric_scores: rubric, p_comments: comments, p_candidate_feedback: feedback, p_ai_evaluation: aiId ?? null });
      if (error) {
        console.log(`review failed ${key} Q${qn}: ${error.message}`);
        continue;
      }
      done[`q${qn}`] = qn === 4 ? "independent" : ADJUST.has(key) && qn === 3 ? "ai_adjusted" : "ai_accepted";
      manifest.reviews[key] = done;
      save();
      console.log(`reviewed ${key} Q${qn}: ${points} (${done[`q${qn}`]})`);
    }
    if (SHARE.has(key) && !done.shared && done.q2 && done.q3) {
      const strong = s.quality === "excellent" || s.quality === "good";
      const text = strong
        ? "Thank you for your practical task. Your work was complete, well structured and supported by the data. We would like to continue with the next stage."
        : "Thank you for completing the practical task. Several required parts were missing or incomplete; the per-question feedback lists what to strengthen for future applications.";
      const { error } = await rec.rpc("share_assessment_feedback", { p_submission: app.submission, p_feedback: text });
      if (error) console.log(`share failed ${key}: ${error.message}`);
      else {
        done.shared = true;
        manifest.reviews[key] = done;
        save();
        console.log(`feedback shared ${key}`);
      }
    }
    const iv = INTERVIEWS[key];
    if (iv && !manifest.interviews[key]) {
      const { data: a } = await admin.from("applications").select("status").eq("id", app.application).single();
      if (a && a.status !== "shortlisted" && a.status !== "interview_scheduled") {
        const { error } = await rec.rpc("change_application_status", { p_app: app.application, p_to: "shortlisted", p_reason: "Strong practical task result", p_candidate_message: "Your application has been shortlisted. We will contact you about an interview." });
        if (error) {
          console.log(`shortlist failed ${key}: ${error.message}`);
          continue;
        }
      }
      const interviewer = (await admin.from("profiles").select("id").eq("email", `interviewer.${job.short}@jadarah.example`).single()).data!.id;
      const { data: id, error } = await rec.rpc("create_interview", { p_application: app.application, p_title: iv.title, p_type: iv.type, p_scheduled_at: iv.at, p_duration: 45, p_timezone: "Asia/Riyadh", p_location: `${job.city} office`, p_meeting_url: null, p_instructions: "Bring your practical task; we will discuss your approach.", p_interviewers: [interviewer] });
      if (error) console.log(`interview failed ${key}: ${error.message}`);
      else {
        manifest.interviews[key] = id;
        save();
        console.log(`interview ${key} at ${iv.at}`);
      }
    }
  }
  save();
  console.log("done");
})().catch((e) => {
  save();
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
