import { expect, test } from "@playwright/test";
import { setLocale } from "./helpers";

test("landing renders in Arabic (RTL) and English (LTR)", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("مستقبلك المهني يبدأ من هنا");
  await expect(page.getByRole("button", { name: "ابدأ رحلتك" })).toBeVisible();
  // The city is a brand journey, not a directory: no district/organization navigation inside it.
  await expect(page.getByText("حي الفرص في الرياض")).toHaveCount(0);
  await context.addCookies([{ name: "jadarah_locale", value: "en", url: page.url() }]);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your career starts here");
  // Journey: chapter 1 copy appears, then skip jumps past the experience.
  await page.getByRole("button", { name: "Start your journey" }).click();
  await expect(page.getByRole("heading", { name: "Discover your abilities." })).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.locator("#after-city")).toBeFocused();
  await expect(page.locator('a[href="/jobs"]').first()).toBeAttached(); // jobs stay reachable outside the journey
});

test("protected routes redirect unauthenticated users to sign-in", async ({ page }) => {
  for (const path of ["/candidate", "/company", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in\?next=/);
  }
});

test("public job board lists published jobs", async ({ page }) => {
  await setLocale(page, "en");
  await page.goto("/jobs");
  await expect(page.getByRole("heading", { name: "Opportunities on JADARAH" })).toBeVisible();
  await expect(page.locator("main li").first()).toBeVisible();
});
