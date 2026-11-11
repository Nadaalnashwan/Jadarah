import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, setLocale, signIn } from "./helpers";

/** Visual evidence for the handoff (read-only). Run with CAPTURE_EVIDENCE=1. */
test.skip(!process.env.CAPTURE_EVIDENCE || !DEMO_PASSWORD, "set CAPTURE_EVIDENCE=1 to capture screenshots");

const ELM_DRAFT = "469cf06b-5abd-45d7-8def-fcde2012edcc";
const out = (n: string) => `docs/evidence/${n}.png`;

test("public pages", async ({ page }) => {
  await setLocale(page, "ar");
  await page.goto("/");
  await page.screenshot({ path: out("11-home-ar") });
  await setLocale(page, "en");
  await page.goto("/");
  await page.screenshot({ path: out("12-home-en") });
  await page.goto("/companies/sdaia");
  await expect(page.locator("h1")).toBeVisible();
  await page.screenshot({ path: out("13-company-profile-sdaia"), fullPage: true });
});

test("candidate opportunity detail", async ({ page }) => {
  await signIn(page, "candidate05");
  await page.goto("/candidate/companies");
  await page.goto("/companies/elm-company");
  const job = page.locator("a[href*='/jobs/']").first();
  await job.waitFor();
  await job.click();
  await page.waitForLoadState("networkidle");
  // Signed-in candidates go straight to the application page, not "Sign in to apply".
  await expect(page.getByRole("main").getByRole("link", { name: "Apply", exact: true })).toBeVisible();
  await page.screenshot({ path: out("14-opportunity-detail"), fullPage: true });
});

test("employer builder and saved draft", async ({ page }) => {
  await signIn(page, "recruiter.elm");
  await page.goto("/company/assessments");
  await page.screenshot({ path: out("15-company-assessments"), fullPage: true });
  await page.goto("/company/assessments/builder");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: out("16-assessment-builder"), fullPage: true });
  await page.goto(`/company/assessments/${ELM_DRAFT}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toBeVisible();
  await page.screenshot({ path: out("17-saved-assessment-elm"), fullPage: true });
});
