import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { Client } from "pg";
import path from "node:path";
import { setLocale } from "./helpers";

/**
 * Candidate + employer journeys of the corrected workflow, in a real browser against a production build:
 *   sign-up → CV-first onboarding (PDF upload → extraction → review) → DOCX version → apply → practical task opens
 *   immediately → submit → application complete → the employer evaluates CV + evidence → shortlist.
 * Creates its own organization, employer and candidate, so it runs ONLY against a LOCAL Supabase:
 *   RUN_LOCAL_E2E=1 E2E_BASE_URL=http://localhost:3100 npx playwright test tests/e2e/core-journeys.spec.ts --project=desktop
 */
config({ path: ".env.local" });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DB = process.env.SUPABASE_DB_URL ?? "";
const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL) && /@(127\.0\.0\.1|localhost):/.test(DB);
const enabled = process.env.RUN_LOCAL_E2E === "1" && local && !!SERVICE;
const SHOTS = process.env.E2E_SHOTS_DIR;

const stamp = Date.now().toString(36);
const employer = { email: `employer-${stamp}@example.test`, password: `Emp-${stamp}-Pw!9` };
const candidate = { name: "Sara Test Candidate", email: `candidate-${stamp}@example.test`, password: `Cand-${stamp}-Pw!9` };
const jobTitle = `Data Analyst ${stamp}`;
const fixtures = path.join(__dirname, "..", "fixtures");
let jobId = "";

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
}

test.describe.configure({ mode: "serial" });
test.describe("core journeys (local Supabase)", () => {
  test.skip(!enabled, "set RUN_LOCAL_E2E=1 with a local Supabase in .env.local");

  test.beforeAll(async () => {
    const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
    const { data: u, error } = await admin.auth.admin.createUser({
      email: employer.email,
      password: employer.password,
      email_confirm: true,
      user_metadata: { account_type: "company", full_name: "Local Test Recruiter" },
    });
    if (error) throw error;
    const db = new Client({ connectionString: DB });
    await db.connect();
    try {
      await db.query("begin");
      const { rows: [c] } = await db.query(
        `insert into public.company_profiles (slug, name_en, name_ar, industry, city, status, listed, approved_at, sector_en, sector_ar)
         values ($1, $2, $3, 'Technology', 'Riyadh', 'approved', true, now(), 'Technology', 'التقنية') returning id`,
        [`local-test-org-${stamp}`, `Local Test Org ${stamp}`, `جهة اختبار ${stamp}`],
      );
      await db.query(`insert into public.company_subscriptions (company_id, status, plan) values ($1, 'active', 'standard')`, [c.id]);
      await db.query(`insert into public.company_brand_profiles (company_id) values ($1) on conflict do nothing`, [c.id]);
      await db.query(`insert into public.company_memberships (company_id, user_id, role, status) values ($1, $2, 'company_admin', 'active')`, [c.id, u.user!.id]);
      const { rows: [a] } = await db.query(
        `insert into public.assessments (company_id, title_en, title_ar, description_en, description_ar, duration_minutes, passing_score, difficulty, category, status, created_by)
         values ($1, 'Data analysis practical task', 'مهمة عملية لتحليل البيانات', 'Two short questions.', 'سؤالان قصيران.', 30, 50, 'intermediate', 'technical', 'draft', $2) returning id`,
        [c.id, u.user!.id],
      );
      const { rows: [q1] } = await db.query(
        `insert into public.assessment_questions (assessment_id, type, prompt_en, prompt_ar, points, position) values ($1, 'multiple_choice', 'Which SQL clause filters grouped rows?', 'أي عبارة SQL تُرشّح الصفوف المجمّعة؟', 2, 0) returning id`,
        [a.id],
      );
      await db.query(
        `insert into public.assessment_options (question_id, label_en, label_ar, is_correct, position) values ($1, 'HAVING', 'HAVING', true, 0), ($1, 'ORDER BY', 'ORDER BY', false, 1)`,
        [q1.id],
      );
      await db.query(
        `insert into public.assessment_questions (assessment_id, type, prompt_en, prompt_ar, points, position) values ($1, 'long_answer', 'Describe how you would validate a dashboard metric.', 'صف كيف تتحقق من مؤشر في لوحة بيانات.', 3, 1)`,
        [a.id],
      );
      await db.query(
        `insert into public.assessment_questions (assessment_id, type, prompt_en, prompt_ar, points, position) values ($1, 'file_upload', 'Upload your analysis (PDF).', 'ارفع تحليلك (PDF).', 3, 2)`,
        [a.id],
      );
      await db.query(`update public.assessments set status = 'published' where id = $1`, [a.id]);
      const { rows: [j] } = await db.query(
        `insert into public.jobs (company_id, title_en, title_ar, description_en, description_ar, city, status, min_years, created_by, assessment_id)
         values ($1, $2, $3, 'Analyse data and build dashboards.', 'تحليل البيانات وبناء لوحات المعلومات.', 'Riyadh', 'draft', 0, $4, $5) returning id`,
        [c.id, jobTitle, `محلل بيانات ${stamp}`, u.user!.id, a.id],
      );
      await db.query(
        `insert into public.job_skills (job_id, skill_id, importance, min_level) select $1, id, 'required', 3 from public.skills where slug in ('sql', 'python')`,
        [j.id],
      );
      await db.query(`update public.jobs set status = 'published' where id = $1`, [j.id]);
      await db.query("commit");
      jobId = j.id;
    } catch (e) {
      await db.query("rollback");
      throw e;
    } finally {
      await db.end();
    }
  });

  test("candidate: sign-up → CV-first onboarding (PDF) → DOCX version", async ({ page }) => {
    test.setTimeout(180_000);
    await setLocale(page, "en");
    await page.goto("/sign-up");
    await page.locator("#fullName").fill(candidate.name);
    await page.locator("#email").fill(candidate.email);
    await page.locator("#password").fill(candidate.password);
    await page.locator("#confirmPassword").fill(candidate.password);
    await page.locator('input[name="consent"]').check();
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/onboarding\/candidate/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Start from your CV" })).toBeVisible();
    await shot(page, "01-onboarding-cv-step");

    // The defect being fixed: this upload used to fail for every new candidate.
    await page.getByTestId("cv-file-input").setInputFiles(path.join(fixtures, "cv-sample.pdf"));
    await expect(page.getByText("CV uploaded")).toBeVisible({ timeout: 30_000 });
    // Extraction (AI when a provider key is configured, labelled rule-based otherwise) → editable review.
    await expect(page.getByRole("button", { name: "Approve and save to my profile" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Rule-based|AI generated/).first()).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "SQL", exact: true })).toBeChecked();
    await shot(page, "02-onboarding-cv-review");
    await page.getByRole("button", { name: "Approve and save to my profile" }).click();
    await page.waitForURL(/cv=done/, { timeout: 30_000 });
    await expect(page.getByText("Your approved CV information is in your profile")).toBeVisible();
    // Three steps; "Next" must never submit the form (regression: it used to skip the Skills step).
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator('li:has([aria-current="step"])')).toContainText("Experience");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator('li:has([aria-current="step"])')).toContainText("Skills");
    await expect(page).toHaveURL(/\/onboarding\/candidate/);
    const finish = page.getByRole("button", { name: "Finish and open my workspace" });
    await Promise.all([page.waitForURL((u) => u.pathname === "/candidate", { timeout: 30_000 }), finish.click()]);

    // DOCX: stored as a new version (the original PDF is kept) and readable by the extractor.
    await page.goto("/candidate/cvs");
    await page.getByTestId("cv-file-input").setInputFiles(path.join(fixtures, "cv-sample.docx"));
    await expect(page.getByText("CV uploaded")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("cv-sample.pdf")).toBeVisible();
    await expect(page.getByText("cv-sample.docx")).toBeVisible();
    await page.locator("li", { hasText: "cv-sample.docx" }).getByRole("button", { name: "Extract" }).click();
    await expect(page.getByText("Review extracted information")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("checkbox", { name: "TypeScript", exact: true })).toBeVisible();
    await shot(page, "03-cv-versions-docx-review");

    // A PDF without a text layer (scanned image) is still saved; the candidate is told to complete manually.
    await page.getByTestId("cv-file-input").setInputFiles(path.join(fixtures, "cv-no-text.pdf"));
    await expect(page.getByText("cv-no-text.pdf")).toBeVisible({ timeout: 30_000 });
    await page.locator("li", { hasText: "cv-no-text.pdf" }).getByRole("button", { name: "Extract" }).click();
    await expect(page.getByText(/couldn't read text from this file|couldn't find profile details/)).toBeVisible({ timeout: 60_000 });

    // Invalid files are refused before upload.
    await page.getByTestId("cv-file-input").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) });
    await expect(page.getByText("Only PDF or Word (DOCX) files are accepted")).toBeVisible();
  });

  test("candidate: apply → practical task opens immediately → submit → application complete", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, candidate.email, candidate.password);
    await page.goto(`/candidate/jobs/${jobId}`);
    await expect(page.getByText("Next: the practical task opens immediately.")).toBeVisible();
    await page.getByRole("button", { name: "Apply for this job" }).click();
    // No employer approval step: straight to the task.
    await page.waitForURL(/\/candidate\/assessments\/[0-9a-f-]+\?applied=1/, { timeout: 30_000 });
    await expect(page.getByText("Application received. Complete and submit the practical task")).toBeVisible();
    await shot(page, "04-task-opens-immediately");
    await page.getByRole("button", { name: "Begin assessment" }).click();
    await page.getByRole("radio", { name: /HAVING/ }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Your answer").fill("Cross-check against the source table and a manual sample.");
    await page.waitForTimeout(1500); // autosave debounce
    // File deliverable: a real upload to private storage, registered against this attempt.
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Upload your analysis (PDF).")).toBeVisible();
    await page.locator('input[type="file"][id^="file-"]').setInputFiles(path.join(fixtures, "cv-sample.pdf"));
    const attached = page.getByRole("list", { name: "Attached files" });
    await expect(attached.getByText("cv-sample.pdf")).toBeVisible({ timeout: 30_000 });
    await expect(attached.getByRole("button", { name: "Download cv-sample.pdf" })).toBeVisible();
    await shot(page, "04b-assessment-file-uploaded");
    // Persisted, not just displayed: survives a reload.
    await page.reload();
    await page.getByRole("button", { name: /Resume|Begin assessment/ }).click();
    await page.getByRole("button", { name: "3", exact: true }).click().catch(() => undefined);
    await expect(page.getByRole("list", { name: "Attached files" }).getByText("cv-sample.pdf")).toBeVisible({ timeout: 30_000 });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Submit assessment" }).click();
    await expect(page.getByText("Your application is complete")).toBeVisible({ timeout: 30_000 });
    await shot(page, "05-application-complete");
    await page.getByRole("link", { name: "Track application" }).click();
    // Progress rail: practical task comes before employer review.
    const rail = page.locator("ol").filter({ hasText: "Under review" }).first();
    const text = (await rail.innerText()).replace(/\s+/g, " ");
    expect(text.indexOf("Practical task submitted")).toBeGreaterThan(-1);
    expect(text.indexOf("Practical task pending")).toBeLessThan(text.indexOf("Under review"));
    expect(text.indexOf("Practical task submitted")).toBeLessThan(text.indexOf("Under review"));
    await shot(page, "06-candidate-progress");
  });

  test("employer: sees the complete application with CV + evidence and can shortlist", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, employer.email, employer.password);
    await page.goto("/company/applications");
    await expect(page.getByText(candidate.name)).toBeVisible();
    await page.getByText(candidate.name).first().click();
    await page.waitForURL(/\/company\/applications\/[0-9a-f-]+/);
    await expect(page.getByRole("button", { name: /^cv-sample\.(pdf|docx) \(v\d+\)$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Data analysis practical task" })).toBeVisible();
    await expect(page.getByText("Cross-check against the source table and a manual sample.")).toBeVisible();
    await expect(page.getByText("hasn't submitted the job's practical task yet")).toHaveCount(0);
    // Uploaded evidence: the employer downloads the real file through a short-lived signed URL.
    const fileBtn = page.getByRole("button", { name: "Download cv-sample.pdf" });
    await expect(fileBtn).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), fileBtn.click()]);
    const saved = await download.path();
    const { readFileSync, statSync } = await import("node:fs");
    expect(statSync(saved!).size).toBe(statSync(path.join(fixtures, "cv-sample.pdf")).size);
    expect(readFileSync(saved!).subarray(0, 5).toString()).toBe("%PDF-");
    await shot(page, "07-employer-evidence");
    const choices = await page.locator("select#to option").allInnerTexts();
    expect(choices.join("|")).toMatch(/Shortlisted/);
    expect(choices.join("|")).toMatch(/Under review/);
    await page.getByRole("button", { name: /Shortlist for interview|ترشيح للمقابلة/ }).first().click();
    await expect(page.getByText(/Shortlisted\. Now schedule the interview/)).toBeVisible({ timeout: 15_000 });
  });

  test("public: only real opportunities are listed; logo renders whole", async ({ page }) => {
    await setLocale(page, "en");
    await page.goto("/jobs");
    await expect(page.getByText(jobTitle)).toBeVisible();
    await expect(page.getByText("Practice scenario")).toHaveCount(0);
    await expect(page.getByText(/Simulation|محاكاة/)).toHaveCount(0);
    await page.goto("/");
    await expect(page.getByText(/demo database|Demo data/i)).toHaveCount(0);
    const mark = page.locator("header [aria-label='JADARAH | جدارة'] svg").first();
    const box = (await mark.boundingBox())!;
    expect(Math.abs(box.width / box.height - 106 / 116)).toBeLessThan(0.02);
    await shot(page, "08-header-logo");
  });
});

async function signIn(page: Page, email: string, password: string) {
  await setLocale(page, "en");
  await page.goto("/sign-in");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 20_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
}
