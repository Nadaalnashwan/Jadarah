/**
 * Real two-person Daily.co interview (needs DAILY_API_KEY; creates a real private room).
 *   RUN_LIVE_VIDEO=1 npx playwright test tests/e2e/video.spec.ts
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { DEMO_PASSWORD, signIn } from "./helpers";

test.skip(process.env.RUN_LIVE_VIDEO !== "1", "set RUN_LIVE_VIDEO=1 to open a real Daily room");
test.setTimeout(240_000);

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
async function api(local: string) {
  const c = createClient(SB_URL, KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: `${local}@jadarah-demo.test`, password: DEMO_PASSWORD });
  if (error) throw error;
  return c;
}

async function mediaContext(browser: Browser) {
  return browser.newContext({ permissions: ["camera", "microphone"] });
}

async function joinCall(page: Page) {
  await page.getByRole("button", { name: "Join interview" }).click();
  const frame = page.frameLocator("iframe").first();
  // Daily Prebuilt pre-join screen (device check) → join.
  await frame.getByRole("button", { name: /join/i }).first().click({ timeout: 60_000 });
}

test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

test("video: candidate + interviewer join the same private Daily room; outsiders are refused", async ({ browser }) => {
  // Setup through the real RPCs: shortlisted application + video interview starting in 5 minutes.
  const recruiter = await api("recruiter.rakeeza");
  const interviewer = await api("interviewer.rakeeza");
  const { data: ivUser } = await interviewer.auth.getUser();
  const { data: me } = await recruiter.auth.getUser();
  const { data: m } = await recruiter.from("company_memberships").select("company_id").eq("user_id", me.user!.id).single();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { data: job } = await recruiter.from("jobs").insert({ company_id: m!.company_id, title_en: `Test role ${stamp}`, title_ar: `وظيفة اختبار ${stamp}`, city: "Riyadh", status: "published", min_years: 0 }).select("id").single();
  const jobs = [job!];
  let appId = "";
  let candidate = "";
  for (let i = 1; i <= 32 && !appId; i++) {
    const local = `candidate${String(i).padStart(2, "0")}`;
    const cand = await api(local);
    const { data: cu } = await cand.auth.getUser();
    const { data: mine } = await cand.from("applications").select("job_id").eq("candidate_id", cu.user!.id);
    const job = (jobs ?? []).find((j) => !(mine ?? []).some((a) => a.job_id === j.id));
    if (!job) continue;
    const { data, error } = await cand.rpc("apply_to_job", { p_job: job.id, p_cv_document: null, p_cover_letter: "E2E video", p_answers: [] });
    if (error) throw error;
    await recruiter.rpc("change_application_status", { p_app: data, p_to: "shortlisted", p_reason: "e2e", p_candidate_message: "" });
    appId = data as string;
    candidate = local;
  }
  expect(appId).not.toBe("");

  // Schedule through the UI path's server action equivalent: RPC, then open the interview page so the
  // room is created server-side (interviewer is a participant → ensureVideoRoom on first join).
  const start = new Date(Date.now() + 5 * 60_000).toISOString();
  const { data: ivId, error: ivErr } = await recruiter.rpc("create_interview", {
    p_application: appId,
    p_title: "E2E video interview",
    p_type: "video",
    p_scheduled_at: start,
    p_duration: 30,
    p_timezone: "Asia/Riyadh",
    p_location: "",
    p_meeting_url: "",
    p_instructions: "",
    p_interviewers: [ivUser.user!.id],
  });
  expect(ivErr).toBeNull();
  const meet = `/meet/${ivId}`;

  // Outsiders: anonymous → sign-in; another candidate and another company's interviewer → not found.
  const anonCtx = await browser.newContext();
  const anon = await anonCtx.newPage();
  await anon.goto(meet);
  await expect(anon).toHaveURL(/\/sign-in/);
  await anonCtx.close();
  for (const outsider of ["candidate31", "interviewer.nawat"]) {
    if (outsider === candidate) continue;
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await signIn(p, outsider);
    const res = await p.goto(meet);
    expect(res?.status()).toBe(404);
    await ctx.close();
  }

  try {
    // Interviewer opens the room first (creates the private Daily room server-side) and joins.
    const ivCtx = await mediaContext(browser);
    const iv = await ivCtx.newPage();
    await signIn(iv, "interviewer.rakeeza");
    await iv.goto(meet);
    await expect(iv.getByRole("button", { name: "Join interview" })).toBeVisible({ timeout: 30_000 });
    await joinCall(iv);

    // Candidate joins the same room.
    const cdCtx = await mediaContext(browser);
    const cd = await cdCtx.newPage();
    await signIn(cd, candidate);
    await cd.goto(meet);
    await expect(cd.getByRole("button", { name: "Join interview" })).toBeVisible({ timeout: 30_000 });
    await joinCall(cd);

    // Both joins are recorded server-side by the embedded call's joined-meeting events.
    await expect
      .poll(
        async () => {
          const { data } = await recruiter.from("interview_attendance").select("role").eq("interview_id", ivId);
          return new Set((data ?? []).map((r) => r.role)).size;
        },
        { timeout: 90_000, intervals: [2_000] },
      )
      .toBe(2);
    const { data: room } = await recruiter.from("interviews").select("video_room_name, video_room_url").eq("id", ivId).single();
    expect(room?.video_room_name).toMatch(/^jdr-/);
    expect(room?.video_room_url).toMatch(/^https:\/\/[a-z0-9-]+\.daily\.co\/jdr-/);
    await ivCtx.close();
    await cdCtx.close();
  } finally {
    // Cancel through the product path's RPC; room deletion is covered by the app action.
    await recruiter.rpc("set_interview_status", { p_interview: ivId as string, p_status: "cancelled" });
  }
});
