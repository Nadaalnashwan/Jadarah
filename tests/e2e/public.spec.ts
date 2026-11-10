import { expect, test } from "@playwright/test";
import { setLocale } from "./helpers";

test("landing renders in Arabic (RTL) and English (LTR)", async ({ page }) => {
  await setLocale(page, "ar");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("الموهبة");
  await setLocale(page, "en");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Talent is more than");
  await expect(page.getByText("Live from the demo database")).toBeVisible();
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
