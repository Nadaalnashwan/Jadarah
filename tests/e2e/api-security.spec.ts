import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("assistant API: anonymous requests are rejected", async ({ request }) => {
  const res = await request.post("/api/assistant", { data: { scope: "candidate", message: "hi" } });
  expect(res.status()).toBe(401);
});

test("assistant API: candidates cannot use the company assistant; invalid bodies rejected", async ({ page }) => {
  await signIn(page, "candidate02");
  const company = await page.request.post("/api/assistant", { data: { scope: "company", message: "list jobs" } });
  expect(company.status()).toBe(403);
  const bad = await page.request.post("/api/assistant", { data: { scope: "admin", message: "x" } });
  expect(bad.status()).toBe(400);
});

test("assistant API: interviewers cannot use the company assistant", async ({ page }) => {
  await signIn(page, "interviewer.nawat");
  const res = await page.request.post("/api/assistant", { data: { scope: "company", message: "list jobs" } });
  expect(res.status()).toBe(403);
});
