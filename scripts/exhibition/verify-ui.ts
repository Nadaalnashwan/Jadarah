/**
 * Browser checks of the exhibition journeys (real UI, real accounts), with screenshots:
 *   npx tsx scripts/exhibition/verify-ui.ts <private dir> [--step live-apply,employer,candidate,calendar,admin,labels]
 * live-apply: a candidate applies to a job, opens its practical task, answers, uploads a file and saves — left in
 * progress (not submitted). Other steps only read.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { JOBS } from "./data-jobs";
import { buildXlsx } from "./office";

config({ path: ".env.local", quiet: true });
const PRIV = process.argv[2];
const BASE = "http://localhost:3000";
const steps = process.argv.includes("--step") ? process.argv[process.argv.indexOf("--step") + 1].split(",") : ["live-apply", "employer", "candidate", "calendar", "labels"];
const SHOTS = join(PRIV, "public", "screenshots");
mkdirSync(SHOTS, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const creds: Record<string, { password: string }> = JSON.parse(readFileSync(join(PRIV, "credentials.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(PRIV, "demo-manifest.json"), "utf8"));
const results: { check: string; ok: boolean; detail?: string }[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  results.push({ check: name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail.slice(0, 200)}` : ""}`);
};
const LABELS = /\bDemo\b|Demo data|بيانات تجريبية|\(تجريبي\)|\bTest role\b|\[DEMO\]/;

async function signIn(email: string, locale: "en" | "ar" = "en") {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  await ctx.addCookies([{ name: "jadarah_locale", value: locale, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(`${BASE}/sign-in`);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(creds[email]?.password ?? process.env.DEMO_USER_PASSWORD ?? "");
    await page.getByRole("button", { name: locale === "en" ? "Sign in" : "تسجيل الدخول" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 20_000 }).catch(() => undefined);
    if (!new URL(page.url()).pathname.startsWith("/sign-in")) break;
    await page.waitForTimeout(61_000); // the app's sign-in rate limit
  }
  check(`sign-in ${email}`, !new URL(page.url()).pathname.startsWith("/sign-in"), page.url());
  return page;
}
const shot = (page: Page, name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
const noLabels = async (page: Page, where: string) => {
  const text = await page.locator("body").innerText();
  const m = text.match(LABELS);
  check(`no demo labels: ${where}`, !m, m ? m[0] : "");
};
let browser: Awaited<ReturnType<typeof chromium.launch>>;

(async () => {
  browser = await chromium.launch();
  if (steps.includes("live-apply")) {
    // Lujain applies to the Ministry of Finance Budget Analyst job and starts its task live.
    const email = "lujain.alomari@jadarah.example";
    const job = JOBS.find((j) => j.key === "mof-budget")!;
    const jobId = manifest.jobs[job.key].job;
    const page = await signIn(email);
    await page.goto(`${BASE}/candidate/jobs/${jobId}`, { waitUntil: "networkidle" });
    await noLabels(page, "candidate job page");
    await shot(page, "c1-job-detail");
    const apply = page.getByRole("button", { name: "Apply for this job" });
    if (await apply.count()) {
      await apply.click();
      await page.waitForTimeout(4000);
    }
    const uid = (await admin.from("profiles").select("id").eq("email", email).single()).data!.id;
    const { data: app } = await admin.from("applications").select("id, status, task_assignment_id").eq("job_id", jobId).eq("candidate_id", uid).maybeSingle();
    check("candidate applied through the job page", !!app, app?.status);
    check("practical task assigned on apply", !!app?.task_assignment_id);
    if (app?.task_assignment_id) {
      manifest.applications[`mof-budget|${email}`] = { application: app.id, assignment: app.task_assignment_id, state: "in_progress (live UI check)" };
      writeFileSync(join(PRIV, "demo-manifest.json"), JSON.stringify(manifest, null, 1), { mode: 0o600 });
      await page.goto(`${BASE}/candidate/assessments/${app.task_assignment_id}`, { waitUntil: "networkidle" });
      await shot(page, "c2-task-intro");
      const start = page.getByRole("button", { name: /start|begin|continue/i }).first();
      if (await start.count()) {
        await start.click();
        await page.waitForTimeout(3000);
      }
      await shot(page, "c3-task-question1");
      const radio = page.getByRole("radio").first();
      if (await radio.count()) await radio.check().catch(() => undefined);
      await page.waitForTimeout(1500);
      // Go to question 3 (file deliverable) and upload a real workbook.
      await page.getByRole("button", { name: "3", exact: true }).click();
      await page.waitForTimeout(1500);
      const input = page.locator('input[type="file"]').first();
      if (await input.count()) {
        const xlsx = buildXlsx([{ name: "Variance", rows: [["Program", "Budget", "Actual", "Variance"], ["Digital services", 120, 138, { f: "C2-B2", v: 18 }]] }]);
        await input.setInputFiles({ name: "budget_variance.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: xlsx });
        await page.waitForTimeout(6000);
      }
      await shot(page, "c4-task-file-uploaded");
      const { data: sub } = await admin.from("assessment_submissions").select("id, status").eq("assignment_id", app.task_assignment_id).maybeSingle();
      const { count: files } = await admin.from("assessment_answer_files").select("id", { count: "exact", head: true }).eq("submission_id", sub?.id ?? "00000000-0000-0000-0000-000000000000");
      check("task started (in progress, not submitted)", sub?.status === "in_progress", sub?.status);
      check("file uploaded and registered to its question", (files ?? 0) >= 1, `${files} file(s)`);
      const { count: answers } = await admin.from("assessment_answers").select("id", { count: "exact", head: true }).eq("submission_id", sub?.id ?? "00000000-0000-0000-0000-000000000000");
      check("answer autosaved", (answers ?? 0) >= 1, `${answers} answer(s)`);
    }
    await page.context().close();
  }
  if (steps.includes("employer")) {
    const page = await signIn("recruiter.moc@jadarah.example");
    await page.goto(`${BASE}/company`, { waitUntil: "networkidle" });
    await noLabels(page, "employer dashboard");
    await shot(page, "e1-dashboard");
    await page.goto(`${BASE}/company/jobs`, { waitUntil: "networkidle" });
    await shot(page, "e2-jobs");
    const app = manifest.applications["moc-legal|noura.alotaibi@jadarah.example"].application;
    await page.goto(`${BASE}/company/applications/${app}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Question 3", exact: true }).click().catch(() => undefined);
    await page.waitForTimeout(800);
    const t = await page.locator("body").innerText();
    check("employer sees AI evaluation of the file question", /legal_memo\.docx/.test(t) && /(8|7)\s*\/\s*8/.test(t), "");
    await noLabels(page, "employer application review");
    await shot(page, "e3-question-review-ai");
    await page.context().close();
  }
  if (steps.includes("candidate")) {
    const page = await signIn("noura.alotaibi@jadarah.example");
    await page.goto(`${BASE}/candidate`, { waitUntil: "networkidle" });
    await noLabels(page, "candidate dashboard");
    await shot(page, "c5-candidate-dashboard");
    await page.goto(`${BASE}/candidate/applications`, { waitUntil: "networkidle" });
    await shot(page, "c6-applications");
    const asg = manifest.applications["moc-legal|noura.alotaibi@jadarah.example"].assignment;
    await page.goto(`${BASE}/candidate/assessments/${asg}`, { waitUntil: "networkidle" });
    const t = await page.locator("body").innerText();
    check("candidate sees shared feedback", /complete, well structured/i.test(t));
    check("candidate never sees the private reviewer note", !/AI suggestion reviewed against the submission/.test(t));
    await shot(page, "c7-task-feedback");
    await page.goto(`${BASE}/candidate/interviews`, { waitUntil: "networkidle" });
    await shot(page, "c8-interviews");
    await page.context().close();
  }
  if (steps.includes("calendar")) {
    const page = await signIn("interviewer.moc@jadarah.example");
    await page.goto(`${BASE}/company/calendar`, { waitUntil: "networkidle" });
    await shot(page, "i1-interviewer-calendar");
    await noLabels(page, "interviewer calendar");
    await page.context().close();
  }
  if (steps.includes("admin")) {
    const page = await signIn("platform.admin@jadarah-demo.test");
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await shot(page, "a1-admin-overview");
    await page.goto(`${BASE}/admin/companies`, { waitUntil: "networkidle" });
    const rows = await page.locator("main table tbody tr").count();
    const t = await page.locator("main").innerText();
    check("admin companies list shows only the 10 supported organizations", rows === 10 && !/Nawat|Ofuq|Haseen|Integration Test/.test(t), `${rows} rows`);
    await shot(page, "a2-admin-companies");
    await page.goto(`${BASE}/admin/subscriptions`, { waitUntil: "networkidle" });
    const t2 = await page.locator("main").innerText();
    check("admin subscriptions show only supported organizations", !/Nawat|Ofuq|Haseen|Integration Test/.test(t2));
    await noLabels(page, "admin subscriptions");
    await page.context().close();
  }
  if (steps.includes("labels")) {
    // Public pages in Arabic and English.
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    for (const loc of ["ar", "en"] as const) {
      await ctx.addCookies([{ name: "jadarah_locale", value: loc, domain: "localhost", path: "/" }]);
      const page = await ctx.newPage();
      for (const path of ["/companies", "/jobs"]) {
        await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
        await noLabels(page, `public ${path} (${loc})`);
      }
      await shot(page, `p-jobs-${loc}`);
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  writeFileSync(join(PRIV, "ui-checks.json"), JSON.stringify(results, null, 1));
  console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
})().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
