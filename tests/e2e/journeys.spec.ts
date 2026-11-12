import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, signIn } from "./helpers";

test.skip(!DEMO_PASSWORD, "DEMO_USER_PASSWORD not set");

test("candidate: discover → job detail with explainable match → apply → tracking", async ({ page }) => {
  await signIn(page, "candidate31");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome");
  await page.goto("/candidate/jobs?sort=recent");
  const links = page.locator("main ul li a[href^='/candidate/jobs/']");
  await links.first().waitFor();
  const n = await links.count();
  let applied = false;
  for (let i = 0; i < n && !applied; i++) {
    await page.goto("/candidate/jobs?sort=recent");
    await links.first().waitFor();
    await links.nth(i).click();
    await expect(page.getByText("How you match")).toBeVisible();
    const submit = page.getByRole("button", { name: "Apply for this job" });
    if (await submit.isVisible()) {
      await page.locator("#cover").fill("E2E: I would love to show my work through your assessment.");
      await submit.click();
      // Jobs with a practical task open it immediately; others go to the application timeline.
      await expect(page).toHaveURL(/\/candidate\/(applications\/.+submitted=1|assessments\/.+applied=1)/);
      await expect(page.getByText(/Application submitted|Application received/)).toBeVisible();
      applied = true;
    }
  }
  expect(applied).toBe(true);
  await page.goto("/candidate/applications");
  await expect(page.locator("tbody tr").first()).toBeVisible();
});

test("company: review applications, see match explanation and the shortlist gate", async ({ page }) => {
  await signIn(page, "recruiter.nawat");
  await expect(page.getByRole("heading", { name: "Recruitment overview" })).toBeVisible();
  await page.goto("/company/applications?complete=all");
  const first = page.locator("tbody a[href^='/company/applications/']").first();
  await first.click();
  await expect(page.getByText("Evidence match")).toBeVisible();
  // Shortlist-before-interview gate: either the one-click shortlist (then schedule) or the lock message.
  await expect(
    page.getByText(/Interviews require a shortlist first|Shortlist this candidate before scheduling an interview\./),
  ).toBeVisible();
  await expect(page.getByText("Internal notes")).toBeVisible();
});

test("interviewer: sees only assigned interviews", async ({ page }) => {
  await signIn(page, "interviewer.nawat");
  await page.goto("/company/interviews");
  await expect(page.getByRole("heading", { name: "Interviews" })).toBeVisible();
  await page.goto("/company/applications");
  await expect(page).toHaveURL(/\/company$/);
});

test("super admin: dashboard stats, pending approval queue and audit log", async ({ page }) => {
  await signIn(page, "platform.admin");
  await expect(page.getByRole("heading", { name: "Platform control center" })).toBeVisible();
  await page.goto("/admin/companies?status=pending");
  await page.getByRole("link", { name: "Imtidad Logistics" }).click();
  await expect(page.getByRole("button", { name: "Record decision" })).toBeVisible();
  await page.goto("/admin/audit");
  await expect(page.locator("tbody tr").first()).toBeVisible();
});

test("candidate cannot open company or admin areas", async ({ page }) => {
  await signIn(page, "candidate02");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/candidate/);
  await page.goto("/company");
  await expect(page).toHaveURL(/\/candidate/);
});
