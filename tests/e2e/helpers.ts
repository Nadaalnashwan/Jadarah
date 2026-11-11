import { expect, test, type Page } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local" });
export const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "";

export async function setLocale(page: Page, locale: "ar" | "en") {
  await page.context().addCookies([{ name: "jadarah_locale", value: locale, url: "http://localhost:3000" }]);
}

export async function signIn(page: Page, local: string) {
  await signInAs(page, `${local}@jadarah-demo.test`, DEMO_PASSWORD);
}

export async function signInAs(page: Page, email: string, password: string) {
  await setLocale(page, "en");
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto("/sign-in");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 8_000 }).catch(() => undefined);
    if (!new URL(page.url()).pathname.startsWith("/sign-in")) return;
    // The app limits sign-in to 10/min per IP (security control). A long suite can hit it from
    // localhost: wait out the window once instead of weakening the limit.
    if (attempt === 0 && (await page.getByText(/too many|rate/i).count())) {
      test.info().setTimeout(test.info().timeout + 70_000);
      await page.waitForTimeout(61_000);
    }
    else break;
  }
  await expect(page).not.toHaveURL(/sign-in/);
}
