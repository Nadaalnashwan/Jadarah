import { expect, test } from "@playwright/test";
import { setLocale } from "./helpers";

test("landing film: Arabic/English copy, autoplay with progress, pause, scenes and CTAs, skip", async ({
  page,
  context,
}) => {
  // The WebGL scene renders in software in CI browsers; allow for slow frames.
  test.setTimeout(150_000);
  await page.goto("/");
  const film = page.getByRole("region", { name: "تعريف بجدارة" });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("جدارة");
  await expect(film.getByRole("heading", { level: 2, name: "مهارات تُثبتها بالعمل، وفرص تُبنى عليها" })).toBeVisible();
  await expect(
    page.getByText("يُظهر المرشح قدراته في مهام عملية، ويراجع صاحب العمل الأدلة ثم يتخذ قراره"),
  ).toBeVisible();
  // Scenes are reachable directly from the opening; each CTA leads into the existing auth journeys.
  await film.getByRole("button", { name: "أنا مرشح" }).click();
  await expect(film.getByRole("heading", { level: 2, name: "دع عملك يتحدث عنك" })).toBeVisible();
  await expect(film.getByRole("link", { name: /أنشئ ملفك كمرشح/ })).toHaveAttribute(
    "href",
    "/sign-up?type=candidate",
  );
  await film.getByRole("button", { name: /^3 \/ 3/ }).click();
  await expect(film.getByRole("heading", { level: 2, name: "وظّف بناءً على ما يستطيع المرشح فعله" })).toBeVisible();
  await expect(film.getByRole("link", { name: /اطلب وصول جهة توظيف/ })).toHaveAttribute(
    "href",
    "/employer/request-access",
  );
  await expect(page.getByText("حي الفرص في الرياض")).toHaveCount(0);

  await context.addCookies([{ name: "jadarah_locale", value: "en", url: page.url() }]);
  await page.goto("/");
  const filmEn = page.getByRole("region", { name: "JADARAH introduction" });
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(
    filmEn.getByRole("heading", { level: 2, name: "Skills proven in practice, matched to real roles" }),
  ).toBeVisible();
  // Plays like a film: the current segment fills and the next scene follows without interaction.
  const fill = page.locator('ol[aria-label="Introduction timeline"] li').first().locator("span span");
  await expect.poll(async () => (await fill.boundingBox())?.width ?? 0, { timeout: 15000 }).toBeGreaterThan(5);
  await expect(filmEn.getByRole("heading", { level: 2, name: "Let your work speak for you" })).toBeVisible({
    timeout: 30000,
  });
  await expect(filmEn.getByRole("link", { name: /Create a candidate profile/ })).toHaveAttribute(
    "href",
    "/sign-up?type=candidate",
  );
  // Pause holds the current scene.
  await filmEn.getByRole("button", { name: "Pause" }).click();
  await page.waitForTimeout(10000);
  await expect(filmEn.getByRole("heading", { level: 2, name: "Let your work speak for you" })).toBeVisible();
  await filmEn.getByRole("button", { name: "Play" }).click();
  await expect(filmEn.getByRole("heading", { level: 2, name: "Hire on what candidates can do" })).toBeVisible({
    timeout: 30000,
  });
  await expect(filmEn.getByRole("link", { name: /Request employer access/ })).toHaveAttribute(
    "href",
    "/employer/request-access",
  );
  // Skip jumps past the film; jobs stay reachable outside it.
  await filmEn.getByRole("button", { name: "Skip" }).click();
  await expect(page.locator("#after-city")).toBeFocused();
  await expect(page.locator('a[href="/jobs"]').first()).toBeAttached();
});

test("landing film with reduced motion still starts by itself, as instant cuts", async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  await ctx.addCookies([{ name: "jadarah_locale", value: "en", url: "http://localhost" }]);
  const page = await ctx.newPage();
  await page.goto(`${process.env.E2E_BASE_URL ?? "http://localhost:3000"}/`);
  await expect(
    page
      .getByRole("region", { name: "JADARAH introduction" })
      .getByRole("heading", { level: 2, name: "Skills proven in practice, matched to real roles" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "JADARAH introduction" })
      .getByRole("heading", { level: 2, name: "Let your work speak for you" }),
  ).toBeVisible({ timeout: 30000 });
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
