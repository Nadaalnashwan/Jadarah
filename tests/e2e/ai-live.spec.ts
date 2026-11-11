/**
 * Live AI journeys — real provider calls (costs credits, needs keys). Skipped unless RUN_LIVE_AI=1.
 *   RUN_LIVE_AI=1 npx playwright test tests/e2e/ai-live.spec.ts
 * Asserts the UI shows output labelled as AI-generated with the provider/model that answered
 * (never the rule-based fallback). The provider may differ from the preferred one when it is overloaded. Nothing is saved: drafts and extractions are left unconfirmed.
 */
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.skip(process.env.RUN_LIVE_AI !== "1", "set RUN_LIVE_AI=1 to call real AI providers");
test.setTimeout(120_000);

/** Minimal single-page PDF with real extractable text (no external fixture needed). */
function samplePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (m) => `\\${m}`);
  const content = `BT /F1 11 Tf 50 780 Td 14 TL ${lines.map((l) => `(${esc(l)}) '`).join(" ")} ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

test("candidate: CV upload → real AI extraction with evidence", async ({ page }) => {
  await signIn(page, "candidate01");
  await page.goto("/candidate/cvs");
  const pdf = samplePdf([
    "Layla Al-Harbi - Data Analyst, Riyadh",
    "Experience: Data Analyst at Rafd Analytics (2022-present).",
    "Built Power BI dashboards and wrote SQL queries over PostgreSQL; automated reports in Python (pandas).",
    "Education: BSc Statistics, Imam University, 2022. Languages: Arabic, English.",
  ]);
  await page.locator('input[type="file"]').setInputFiles({ name: "e2e-live-ai-cv.pdf", mimeType: "application/pdf", buffer: pdf });
  const row = page.locator("li", { hasText: "e2e-live-ai-cv.pdf" }).first();
  await expect(row).toBeVisible({ timeout: 90_000 });
  const started = Date.now();
  await row.getByRole("button", { name: "Extract" }).click();
  const badge = page.getByText(/AI generated — review before use · (gemini|groq|openai)/);
  await expect(badge).toBeVisible({ timeout: 60_000 });
  console.log(`cv_parse UI round-trip ${Date.now() - started} ms · ${await badge.textContent()}`);
  await expect(page.getByText("SQL", { exact: false }).first()).toBeVisible();
});

test("candidate: assistant answers with real AI (Groq)", async ({ page }) => {
  await signIn(page, "candidate01");
  await page.goto("/candidate/assistant");
  await page.getByLabel("Message").fill("Which of my skills should I strengthen first for my target role? One sentence.");
  const started = Date.now();
  await page.getByLabel("Message").press("Enter");
  const badge = page.getByText(/AI generated — review before use · groq/);
  await expect(badge).toBeVisible({ timeout: 45_000 });
  console.log(`candidate_assistant UI round-trip ${Date.now() - started} ms · ${await badge.textContent()}`);
});

test("candidate: job detail shows semantic similarity as labelled AI inference", async ({ page }) => {
  await signIn(page, "candidate01");
  await page.goto("/candidate/jobs");
  await page.locator('a[href^="/candidate/jobs/"]').first().click();
  await expect(page.getByText("Semantic profile ↔ job similarity")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/AI inference \(gemini-embedding-2\)/)).toBeVisible();
});

test("company: AI job draft (Gemini) fills the form for human review", async ({ page }) => {
  await signIn(page, "recruiter.nawat");
  await page.goto("/company/jobs/new");
  await page.locator("#title_en").fill("Data Analyst");
  const started = Date.now();
  await page.getByRole("button", { name: "Draft with AI" }).click();
  const badge = page.getByText(/AI generated — review before use · (gemini|groq|openai)/);
  await expect(badge).toBeVisible({ timeout: 60_000 });
  console.log(`job_description UI round-trip ${Date.now() - started} ms · ${await badge.textContent()}`);
  await expect(page.locator("#description_en")).not.toHaveValue("");
});

test("company: assistant and interview question suggestions use real AI", async ({ page }) => {
  await signIn(page, "recruiter.nawat");
  await page.goto("/company/assistant");
  await page.getByLabel("Message").fill("Which of our open jobs has the most demanding skill set? One sentence.");
  await page.getByLabel("Message").press("Enter");
  await expect(page.getByText(/AI generated — review before use · groq/)).toBeVisible({ timeout: 45_000 });

  await page.goto("/company/interviews");
  await page.locator('a[href^="/company/interviews/"]').first().click();
  const started = Date.now();
  await page.getByRole("button", { name: "Suggest questions" }).click();
  // Rule-based fallback would show "Rule-based (no AI provider configured)" instead.
  await expect(page.getByText("AI generated — review before use", { exact: true })).toBeVisible({ timeout: 45_000 });
  console.log(`interview_questions UI round-trip ${Date.now() - started} ms`);
});

test("company: rubric-assisted evaluation suggests scores for a human reviewer", async ({ page }) => {
  await signIn(page, "recruiter.souqa");
  // Deterministic demo-seed application with an evaluated open answer that has a rubric.
  await page.goto("/company/applications/4bbec4b2-0c73-4fc3-a9ba-f0b481f31bf7");
  const started = Date.now();
  await page.getByRole("button", { name: "Suggest rubric scores with AI" }).first().click();
  const badge = page.getByText(/AI suggestion — you decide · (gemini|groq|openai)/).first();
  await expect(badge).toBeVisible({ timeout: 90_000 });
  console.log(`assessment_evaluation UI round-trip ${Date.now() - started} ms · ${await badge.textContent()}`);
  // Suggested scores are pre-filled but NOT saved until the reviewer submits.
  await expect(page.locator('input[name^="rubric_"]').first()).not.toHaveValue("");
});
