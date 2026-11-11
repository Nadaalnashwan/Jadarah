import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Reference-grounded Assessment Builder, live AI (RUN_LIVE_AI=1). Generates a company-specific
 * practical assessment per organization through the real UI and checks the draft is reviewable,
 * unpublished, validated, has materials and references, and carries no legacy branding.
 */
const CASES = [
  { org: "elm", job: "Software Engineer" },
  { org: "sdaia", job: "ML Engineer" },
  { org: "mof", job: "Financial Analyst" },
  { org: "gea", job: "Event Coordinator" },
  { org: "sipchem", job: "Quality Engineer" },
];
const only = process.env.BUILDER_ONLY?.split(",");
const LEGACY = /midan|الميدان|ميدان/i;

test.describe("Assessment Builder (live AI)", () => {
  test.skip(!process.env.RUN_LIVE_AI, "set RUN_LIVE_AI=1");
  test.describe.configure({ timeout: 1_500_000 });

  for (const c of CASES.filter((x) => !only || only.includes(x.org))) {
    test(`${c.org}: ${c.job}`, async ({ page }) => {
      await signIn(page, `recruiter.${c.org}`);
      await page.goto("/company/assessments/builder");
      await page.locator("#b-job").selectOption({ label: c.job });
      await expect(page.locator("#b-title")).toHaveValue(c.job);
      // Free-tier models can be briefly overloaded; the circuit breaker parks a model for 3 min,
      // so a failed attempt is retried after that window (up to 3 attempts).
      const done = /\/company\/assessments\/[0-9a-f-]{36}$/;
      for (let attempt = 1; attempt <= 3; attempt++) {
        await page.getByRole("button", { name: "Generate draft" }).click();
        const outcome = await Promise.race([
          page.waitForURL(done, { timeout: 300_000 }).then(() => "ok"),
          page.getByRole("alert").filter({ hasText: /unavailable/i }).waitFor({ timeout: 300_000 }).then(() => "unavailable"),
        ]);
        if (outcome === "ok") break;
        expect(attempt, "generation unavailable after 3 attempts").toBeLessThan(3);
        await page.waitForTimeout(190_000);
      }
      await expect(page).toHaveURL(done);

      const body = page.locator("body");
      await expect(page.getByText("Scenario").first()).toBeVisible();
      await expect(page.getByText("Validation").first()).toBeVisible();
      await expect(page.getByText("Reference examples").first()).toBeVisible();
      await expect(page.getByText("Assessor guide").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Approve & publish" })).toBeVisible();
      await expect(page.locator("main").getByText(/\.csv/).first()).toBeVisible();
      expect(await body.innerText()).not.toMatch(LEGACY);

      const dir = process.env.EVIDENCE_DIR;
      if (dir) await page.screenshot({ path: `${dir}/builder-${c.org}.png`, fullPage: true });
      console.log(`${c.org}: ${page.url().split("/").pop()}`);
    });
  }
});
