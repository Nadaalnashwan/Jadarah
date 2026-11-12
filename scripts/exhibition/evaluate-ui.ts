/**
 * Runs the REAL per-question AI evaluation through the employer interface (the same button a recruiter clicks):
 * for each submitted exhibition application, Question 2 and Question 3 are evaluated; Question 4 is left for live
 * demonstration. Results are whatever the AI returns — nothing is written here except by the application itself.
 *
 *   npx tsx scripts/exhibition/evaluate-ui.ts <private dir> [--only job-key,...] [--base http://localhost:3000]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { chromium, type BrowserContext } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { JOBS } from "./data-jobs";
import { SUBMISSIONS } from "./data-submissions";

config({ path: ".env.local", quiet: true });
const PRIV = process.argv[2];
const BASE = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : "http://localhost:3000";
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const creds: Record<string, { password: string }> = JSON.parse(readFileSync(join(PRIV, "credentials.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(PRIV, "demo-manifest.json"), "utf8"));
const OUT = join(PRIV, "evaluation-runs.json");
const runs: Record<string, unknown>[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];

/** Session cookies for an account, without a password when we do not hold it (admin one-time token; no email). */
async function sessionCookies(email: string) {
  const c = createClient(URL, KEY, { auth: { persistSession: false } });
  if (creds[email]) {
    const { error } = await c.auth.signInWithPassword({ email, password: creds[email].password });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;
    const { error: e2 } = await c.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
    if (e2) throw e2;
  }
  const { data: s } = await c.auth.getSession();
  let jar: { name: string; value: string }[] = [];
  const ssr = createServerClient(URL, KEY, { cookies: { getAll: () => [], setAll: (list) => { jar = list.map((x) => ({ name: x.name, value: x.value })); } } });
  await ssr.auth.setSession({ access_token: s.session!.access_token, refresh_token: s.session!.refresh_token });
  return jar;
}

(async () => {
  const browser = await chromium.launch();
  const contexts = new Map<string, BrowserContext>();
  for (const sub of SUBMISSIONS) {
    if (only && !only.includes(sub.job)) continue;
    const job = JOBS.find((j) => j.key === sub.job)!;
    const app = manifest.applications[`${sub.job}|${sub.candidate}`];
    const recruiter = `recruiter.${job.short}@jadarah.example`;
    if (!contexts.has(recruiter)) {
      const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
      const host = new globalThis.URL(BASE).hostname;
      await ctx.addCookies([{ name: "jadarah_locale", value: "en", domain: host, path: "/" }, ...(await sessionCookies(recruiter)).map((x) => ({ ...x, domain: host, path: "/" }))]);
      contexts.set(recruiter, ctx);
    }
    const page = await contexts.get(recruiter)!.newPage();
    await page.goto(`${BASE}/company/applications/${app.application}`, { waitUntil: "networkidle", timeout: 90_000 });
    for (const qn of [2, 3]) {
      const qid = manifest.jobs[sub.job].questions[qn - 1];
      const { count: before } = await admin.from("assessment_ai_evaluations").select("id", { count: "exact", head: true }).eq("submission_id", app.submission).eq("question_id", qid);
      if (before) {
        console.log(`skip ${sub.job} ${sub.candidate} Q${qn} (already evaluated)`);
        continue;
      }
      // The review shows one question at a time: open this question first.
      await page.getByRole("button", { name: `Question ${qn}`, exact: true }).click();
      await page.waitForTimeout(500);
      const btn = page.getByRole("button", { name: "Evaluate this question with AI" }).first();
      if (!(await btn.count())) {
        const names = await page.getByRole("button").allInnerTexts();
        console.log(`no button ${sub.job} ${sub.candidate} Q${qn}: ${names.map((n) => n.trim()).filter(Boolean).join(" | ").slice(0, 600)}`);
        break;
      }
      const t0 = Date.now();
      await btn.click();
      // Done when a new evaluation row exists or the panel reports a failure.
      let row: { status: string; score: number | null; max_score: number } | null = null;
      for (let i = 0; i < 90 && !row; i++) {
        await page.waitForTimeout(2000);
        const { data } = await admin.from("assessment_ai_evaluations").select("status, score, max_score").eq("submission_id", app.submission).eq("question_id", qid).order("created_at", { ascending: false }).limit(1);
        if (data?.length) row = data[0];
        else if (await page.getByText(/did not finish|could not|failed/i).count()) break;
      }
      const rec = { job: sub.job, candidate: sub.candidate, quality: sub.quality, question: qn, status: row?.status ?? "failed", score: row?.score ?? null, max: row?.max_score ?? null, seconds: Math.round((Date.now() - t0) / 1000) };
      runs.push(rec);
      writeFileSync(OUT, JSON.stringify(runs, null, 1));
      console.log(JSON.stringify(rec));
      await page.reload({ waitUntil: "networkidle" });
    }
    await page.close();
  }
  await browser.close();
})().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
