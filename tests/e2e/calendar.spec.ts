import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { DEMO_PASSWORD, signIn } from "./helpers";

test.setTimeout(150_000);

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
async function api(local: string) {
  const c = createClient(SB_URL, KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: `${local}@jadarah-demo.test`, password: DEMO_PASSWORD });
  if (error) throw error;
  return c;
}

/** Fresh shortlisted application at Rakeeza (setup through the real RPCs; the UI flow is tested below). */
async function shortlisted() {
  const recruiter = await api("recruiter.rakeeza");
  const { data: me } = await recruiter.auth.getUser();
  const { data: m } = await recruiter.from("company_memberships").select("company_id").eq("user_id", me.user!.id).single();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { data: job } = await recruiter.from("jobs").insert({ company_id: m!.company_id, title_en: `Test role ${stamp}`, title_ar: `وظيفة اختبار ${stamp}`, city: "Riyadh", status: "published", min_years: 0 }).select("id").single();
  const jobs = [job!];
  for (let i = 1; i <= 32; i++) {
    const local = `candidate${String(i).padStart(2, "0")}`;
    const cand = await api(local);
    const { data: cu } = await cand.auth.getUser();
    const { data: mine } = await cand.from("applications").select("job_id").eq("candidate_id", cu.user!.id);
    const job = (jobs ?? []).find((j) => !(mine ?? []).some((a) => a.job_id === j.id));
    if (!job) continue;
    const { data: appId, error } = await cand.rpc("apply_to_job", { p_job: job.id, p_cv_document: null, p_cover_letter: "E2E calendar", p_answers: [] });
    if (error) throw error;
    const sl = await recruiter.rpc("change_application_status", { p_app: appId, p_to: "shortlisted", p_reason: "e2e", p_candidate_message: "" });
    if (sl.error) throw sl.error;
    return { appId: appId as string, candidate: local };
  }
  throw new Error("no free candidate/job pair at rakeeza");
}

/** A Sun–Thu date 20–200 days ahead (random to avoid colliding with previous runs). */
function futureWorkday(): string {
  for (;;) {
    const d = new Date(Date.now() + (20 + Math.floor(Math.random() * 180)) * 86_400_000);
    if (d.getUTCDay() <= 4) return d.toISOString().slice(0, 10);
  }
}

test("calendar: availability → slot finder scheduling → candidate confirms → calendar shows it", async ({ browser }) => {
  // 1) Interviewer sets Sun–Thu 9–5 availability.
  const ivCtx = await browser.newContext();
  const iv = await ivCtx.newPage();
  await signIn(iv, "interviewer.rakeeza");
  await iv.goto("/company/availability");
  await iv.getByRole("button", { name: "Sun–Thu, 9–5" }).click();
  await iv.getByRole("button", { name: "Save availability" }).click();
  await expect(iv.getByText("Availability saved.")).toBeVisible();
  await ivCtx.close();

  // 2) Recruiter schedules with the slot finder.
  const { appId, candidate } = await shortlisted();
  const rcCtx = await browser.newContext();
  const rc = await rcCtx.newPage();
  await signIn(rc, "recruiter.rakeeza");
  await rc.goto(`/company/applications/${appId}`);
  await rc.getByRole("button", { name: "Schedule interview" }).click();
  await rc.locator('fieldset input[name="interviewers"]').first().check();
  await rc.locator("#iv-day").fill(futureWorkday());
  await rc.getByRole("button", { name: "Show free slots for all selected interviewers" }).click();
  const slot = rc.getByRole("listbox", { name: "Free slots" }).getByRole("option").first();
  await expect(slot).toBeVisible({ timeout: 30_000 });
  await slot.click();
  await expect(rc.locator("#iv-at")).not.toHaveValue("");
  await rc.getByRole("button", { name: "Create interview" }).click();
  // Scheduling stays in the application context; the confirmation links to the interview.
  await expect(rc).toHaveURL(/\/company\/applications\/[0-9a-f-]{36}\?scheduled=[0-9a-f-]{36}$/, { timeout: 30_000 });
  const interviewUrl = new URL(`/company/interviews/${new URL(rc.url()).searchParams.get("scheduled")}`, rc.url()).toString();

  // 3) Candidate sees the invitation and confirms attendance.
  const cdCtx = await browser.newContext();
  const cd = await cdCtx.newPage();
  await signIn(cd, candidate);
  await cd.goto("/candidate/interviews");
  await expect(cd.getByText("Awaiting your confirmation").first()).toBeVisible();
  await cd.getByRole("button", { name: "Confirm attendance" }).first().click();
  await expect(cd.getByText("Attendance confirmed.")).toBeVisible();
  await cdCtx.close();

  // 4) Recruiter calendar renders all three views; the upcoming agenda links to the interview.
  await rc.goto("/company/calendar");
  await expect(rc.getByRole("heading", { name: "Interview calendar" })).toBeVisible();
  for (const v of ["Month", "Day", "Week"]) await rc.getByRole("tab", { name: v }).click();
  await expect(rc.locator(`a[href="${new URL(interviewUrl).pathname}"]`).first()).toBeAttached();

  // Cleanup: cancel the interview through the product (keeps the demo calendar tidy).
  const recruiter = await api("recruiter.rakeeza");
  await recruiter.rpc("set_interview_status", { p_interview: interviewUrl.split("/").pop()!, p_status: "cancelled" });
  await rcCtx.close();
});
