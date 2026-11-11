import { expect, test } from "@playwright/test";
import { setLocale } from "./helpers";

test("landing film: Arabic/English copy, autoplay with progress, pause, scenes and CTAs, skip", async ({
  page,
  context,
}) => {
  // The WebGL scene renders in software in CI browsers; allow for slow frames.
  test.setTimeout(150_000);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("جدارة");
  await expect(page.getByRole("heading", { name: "مستقبلك المهني يبدأ بخطوة." })).toBeVisible();
  await expect(page.getByText("اكتشف فرصك، وطوّر مهاراتك، وخلّ إنجازك يتكلم عنك.")).toBeVisible();
  // Scenes are reachable directly from the opening; each CTA leads into the existing auth journeys.
  await page.getByRole("button", { name: "أنا مرشح" }).click();
  await expect(page.getByRole("heading", { name: "تبحث عن فرصة جديدة؟" })).toBeVisible();
  await expect(page.getByRole("link", { name: /ابدأ رحلتك/ })).toHaveAttribute("href", "/sign-up");
  await page.getByRole("button", { name: /^3 \/ 3/ }).click();
  await expect(page.getByRole("heading", { name: "تبحث عن الشخص المناسب لفريقك؟" })).toBeVisible();
  await expect(page.getByRole("link", { name: /اكتشف المواهب/ })).toHaveAttribute(
    "href",
    "/employer/request-access",
  );
  await expect(page.getByText("حي الفرص في الرياض")).toHaveCount(0);

  await context.addCookies([{ name: "jadarah_locale", value: "en", url: page.url() }]);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: "Your next opportunity starts here." })).toBeVisible();
  // Plays like a film: the current segment fills and the next scene follows without interaction.
  const fill = page.locator('ol[aria-label="Introduction timeline"] li').first().locator("span span");
  await expect.poll(async () => (await fill.boundingBox())?.width ?? 0, { timeout: 5000 }).toBeGreaterThan(5);
  await expect(page.getByRole("heading", { name: "Ready for your next opportunity?" })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole("link", { name: /Start your journey/ })).toHaveAttribute("href", "/sign-up");
  // Pause holds the current scene.
  const film = page.getByRole("region", { name: "JADARAH introduction" });
  await film.getByRole("button", { name: "Pause" }).click();
  await page.waitForTimeout(10000);
  await expect(page.getByRole("heading", { name: "Ready for your next opportunity?" })).toBeVisible();
  await film.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("heading", { name: "Looking for the right talent?" })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole("link", { name: /Discover talent/ })).toHaveAttribute(
    "href",
    "/employer/request-access",
  );
  // Skip jumps past the film; jobs stay reachable outside it.
  await film.getByRole("button", { name: "Skip" }).click();
  await expect(page.locator("#after-city")).toBeFocused();
  await expect(page.locator('a[href="/jobs"]').first()).toBeAttached();
});

test("landing film respects reduced motion: no autoplay, manual scenes", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  await ctx.addCookies([{ name: "jadarah_locale", value: "en", url: "http://localhost" }]);
  const page = await ctx.newPage();
  await page.goto(`${process.env.E2E_BASE_URL ?? "http://localhost:3000"}/`);
  await expect(page.getByRole("heading", { name: "Your next opportunity starts here." })).toBeVisible();
  await page.waitForTimeout(10000);
  await expect(page.getByRole("heading", { name: "Your next opportunity starts here." })).toBeVisible();
  await page
    .getByRole("region", { name: "JADARAH introduction" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Ready for your next opportunity?" })).toBeVisible();
  await ctx.close();
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
