import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { setLocale, signIn, signInAs } from "./helpers";

const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Registry organizations, employer access, branding and subscriptions (migrations 0020–0023). */
const ORGS = [
  "ministry-of-commerce",
  "general-entertainment-authority",
  "elm-company",
  "diriyah-gate-development-authority",
  "saudi-telecom-company",
  "sdaia",
  "sipchem",
  "saudi-red-sea-authority",
  "ministry-of-finance",
  "saudi-industrial-development-fund",
];
const FICTIONAL = ["nawat-technologies", "rakeeza-finance", "madar-consulting"];
const LEGACY = /midan|الميدان|ميدان/i;

async function shot(page: Page, name: string) {
  const dir = process.env.EVIDENCE_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test.describe("B2B organizations", () => {
  test("directory lists the ten organizations, hides fictional ones, no logos without permission", async ({ page }) => {
    await setLocale(page, "ar");
    await page.goto("/companies");
    for (const slug of ORGS) await expect(page.locator(`a[href$="/companies/${slug}"]`).first()).toBeVisible();
    for (const slug of FICTIONAL) await expect(page.locator(`a[href$="/companies/${slug}"]`)).toHaveCount(0);
    // No brand asset is verified, so no organization logo image is rendered.
    await expect(page.locator("main img")).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toMatch(LEGACY);
    await shot(page, "01-directory-ar");
  });

  test("every organization profile renders with simulation opportunities clearly labelled", async ({ page }) => {
    await setLocale(page, "en");
    for (const slug of ORGS) {
      await page.goto(`/companies/${slug}`);
      await expect(page.locator("h1")).toBeVisible();
      const text = await page.locator("body").innerText();
      expect(text, slug).not.toMatch(LEGACY);
      expect(text, slug).not.toMatch(/partner|endorse/i);
      expect(text, slug).toMatch(/Simulation/);
      await expect(page.locator("main img")).toHaveCount(0);
      if (slug === "elm-company") await shot(page, "02-company-profile-elm");
    }
  });

  test("fictional companies are not reachable from the public catalogue", async ({ page }) => {
    const res = await page.goto(`/companies/${FICTIONAL[0]}`);
    expect(res?.status()).toBe(404);
  });

  test("sign-up is candidate-only; employer access lists organizations from the database", async ({ page }) => {
    await setLocale(page, "en");
    await page.goto("/sign-up?type=company");
    await expect(page).toHaveURL(/\/employer\/request-access/);
    const options = await page.locator("#companyId option").allInnerTexts();
    expect(options.length).toBeGreaterThanOrEqual(11); // "Select" + ten organizations
    expect(options.join("|")).toMatch(/Elm/);
    for (const label of ["Full name", "Work email", "Password", "Organization", "Job title", "Requested role"])
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    await shot(page, "03-employer-access-request");
  });

  test("employer workspace for an approved member of a subscribed organization", async ({ page }) => {
    await signIn(page, "recruiter.elm");
    await page.goto("/company");
    await expect(page).toHaveURL(/\/company/);
    await expect(page.locator("main h1").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    const text = await page.locator("body").innerText();
    expect(text).toMatch(/Elm/);
    expect(text).not.toMatch(LEGACY);
    await shot(page, "04-employer-workspace-elm");
    await page.goto("/company/jobs");
    await expect(page.getByText("Simulation").first()).toBeVisible();
    await shot(page, "05-employer-opportunities-elm");
  });

  test("Super Admin sees subscriptions with demonstrations kept apart from revenue", async ({ page }) => {
    await signIn(page, "platform.admin");
    await page.goto("/admin/subscriptions");
    for (const label of ["Recorded payments", "Contract value", "Demonstration access"]) await expect(page.getByText(label).first()).toBeVisible();
    await expect(page.getByText("ALM-003").first()).toBeVisible();
    await shot(page, "06-admin-subscriptions");
    await page.goto("/admin/access-requests");
    await expect(page.locator("h1")).toBeVisible();
    await shot(page, "07-admin-access-requests");
  });

  test("employee requests access → pending → Super Admin decides", async ({ page, browser }) => {
    test.skip(!SERVICE, "needs the service-role key for throwaway account setup");
    // Setup only: a throwaway confirmed employer account in the reserved demo domain.
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, SERVICE, { auth: { persistSession: false } });
    const email = `e2e-employee-${Date.now()}@jadarah-demo.test`;
    const password = `E2e-${Math.random().toString(36).slice(2)}-7q`;
    const { data: u, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "E2E Employee", account_type: "company" } });
    expect(error).toBeNull();
    await admin.from("profiles").update({ is_demo: true }).eq("id", u.user!.id);

    await signInAs(page, email, password);
    await page.waitForURL(/onboarding\/company/);
    await page.locator("#companyId").selectOption({ label: "Elm Company" });
    await page.locator("#jobTitle").fill("Talent Acquisition Specialist");
    await page.locator("#role").selectOption("recruiter");
    await page.getByRole("button", { name: "Request access" }).click();
    await expect(page.getByRole("heading", { name: "Pending approval" })).toBeVisible();
    // No workspace while pending.
    await page.goto("/company");
    await expect(page).toHaveURL(/\/onboarding\/company/);
    await page.goto("/onboarding/company");
    await shot(page, "08-access-request-pending");

    // Super Admin sees the request and declines it (approval is covered by tests/integration/b2b.test.ts,
    // which uses a throwaway organization so no false membership is created at a real organization).
    const ctx = await browser.newContext();
    const sa = await ctx.newPage();
    await signIn(sa, "platform.admin");
    await sa.goto("/admin/access-requests");
    const row = sa.locator("tbody tr").filter({ hasText: email });
    await expect(row).toBeVisible();
    await shot(sa, "09-admin-access-request");
    await row.getByRole("button", { name: "Reject" }).click();
    await expect(row).toContainText("rejected", { timeout: 15_000 });
    await expect(row.getByRole("button")).toHaveCount(0);
    await ctx.close();

    await page.reload();
    await expect(page.getByText("Request not approved")).toBeVisible();
    await shot(page, "10-access-request-declined");
  });
});
