import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
const email = process.env.E2E_EMAIL_TEST_ADDRESS;
const password = process.env.E2E_EMAIL_TEST_PASSWORD;

/** Implicit-flow email links (#access_token=…) must land on their target via /auth/callback → /auth/confirm. */
test("implicit-flow recovery link reaches /reset-password", async ({ page }) => {
  test.skip(!email || !password, "E2E email test identity not configured");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: email!, password: password! });
  expect(error).toBeNull();
  const s = data.session!;
  await page.goto(`/auth/callback?next=%2Freset-password#access_token=${s.access_token}&refresh_token=${s.refresh_token}&type=recovery`);
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.locator("#password")).toBeVisible();
});

test("bad implicit-flow tokens are rejected", async ({ page }) => {
  await page.goto("/auth/callback?next=%2Freset-password#access_token=bad&refresh_token=bad&type=recovery");
  await expect(page).toHaveURL(/\/sign-in\?link=invalid/);
});

test("missing tokens are rejected", async ({ page }) => {
  await page.goto("/auth/callback?next=%2Fadmin");
  await expect(page).toHaveURL(/\/sign-in\?link=invalid/);
});
