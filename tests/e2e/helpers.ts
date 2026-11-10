import { expect, type Page } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local" });
export const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "";

export async function setLocale(page: Page, locale: "ar" | "en") {
  await page.context().addCookies([{ name: "jadarah_locale", value: locale, url: "http://localhost:3000" }]);
}

export async function signIn(page: Page, local: string) {
  await setLocale(page, "en");
  await page.goto("/sign-in");
  await page.locator("#email").fill(`${local}@jadarah-demo.test`);
  await page.locator("#password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}
