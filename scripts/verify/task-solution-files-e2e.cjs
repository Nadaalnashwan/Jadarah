// Real end-to-end check of Task Solution Files (ملفات حل المهمة) against the Supabase project in the environment,
// using the demo accounts (candidate01, recruiter.nawat; recruiter.souqa/admin.souqa/candidate02 for denials).
// It WRITES demo records (an assignment, a submission, one stored file). Needs the app running (`npm run start`).
//
//   node scripts/verify/task-solution-files-e2e.cjs <file.pdf> <dir with evil.exe + oversize-report.pdf> <output dir>
//
// env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, DEMO_USER_PASSWORD,
//      E2E_APPLICATION (an open application of candidate01 at the recruiter's company),
//      E2E_ASSESSMENT (a published assessment not yet assigned on that application), E2E_BASE (default http://localhost:3000)
/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { chromium } = require("playwright");
const { createClient } = require(require.resolve("@supabase/supabase-js", { paths: [process.cwd()] }));

const [, , PDF, NEG, OUT] = process.argv;
const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const APP = process.env.E2E_APPLICATION;
const ASSESSMENT = process.env.E2E_ASSESSMENT; // a published assessment not yet assigned on this application
const PW = process.env.DEMO_USER_PASSWORD;
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
async function api(local) {
  const c = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  if (local) {
    const { error } = await c.auth.signInWithPassword({ email: `${local}@jadarah-demo.test`, password: PW });
    if (error) throw new Error(`sign-in ${local}: ${error.message}`);
  }
  return c;
}
async function signIn(browser, local, locale) {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1360, height: 900 } });
  await ctx.addCookies([{ name: "jadarah_locale", value: "en", url: BASE }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/sign-in`);
  await page.locator("#email").fill(`${local}@jadarah-demo.test`);
  await page.locator("#password").fill(PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 20000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  if (locale !== "en") await ctx.addCookies([{ name: "jadarah_locale", value: locale, url: BASE }]);
  return { ctx, page };
}

(async () => {
  const pdfBytes = fs.readFileSync(PDF);
  const browser = await chromium.launch();

  // 1. Employer assigns the task in the UI.
  const emp = await signIn(browser, "recruiter.nawat", "en");
  await emp.page.goto(`${BASE}/company/applications/${APP}`);
  await emp.page.locator('select[name="assessment_id"]').selectOption(ASSESSMENT);
  await emp.page.getByRole("button", { name: "Assign", exact: true }).click();
  const toast = emp.page.locator("[data-sonner-toast]").first();
  await toast.waitFor({ timeout: 20000 });
  const toastText = await toast.innerText();
  check("employer assigns the task (UI)", /Assessment assigned/.test(toastText), toastText.replace(/\s+/g, " "));

  const cand = await api("candidate01");
  const { data: asg } = await cand
    .from("assessment_assignments").select("id, status").eq("application_id", APP).eq("assessment_id", ASSESSMENT)
    .order("created_at", { ascending: false }).limit(1).single();
  check("new assignment visible to the candidate", asg?.status === "assigned", asg?.id);
  if (asg?.status !== "assigned") throw new Error("no fresh assignment; stopping");

  // 2. Candidate (Arabic UI, as in the bug report) opens and starts the task.
  const c = await signIn(browser, "candidate01", "ar");
  c.page.on("dialog", (d) => d.accept());
  await c.page.goto(`${BASE}/candidate/assessments/${asg.id}`);
  await c.page.getByRole("button", { name: /ابدأ التقييم|متابعة/ }).click();
  const card = c.page.locator("div").filter({ has: c.page.getByRole("heading", { name: "ملفات حل المهمة" }) }).last();
  await card.waitFor({ timeout: 20000 });
  const input = card.locator('input[type="file"]');

  // 3. Upload the user's PDF through the real UI.
  const t0 = Date.now();
  await input.setInputFiles(PDF);
  // Saved (registered) files get a download button; an in-flight upload does not.
  const listed = card.getByRole("button", { name: "تنزيل UX_Friction_Analysis_Report.pdf" });
  const ok = await listed.waitFor({ timeout: 60000 }).then(() => true).catch(() => false);
  const errText = await c.page.locator("text=يجري تفعيل هذه الميزة").count();
  check("user's PDF uploads and is listed", ok && errText === 0, `${Date.now() - t0} ms`);
  await c.page.screenshot({ path: path.join(OUT, "1-candidate-uploaded.png"), fullPage: true });

  // DB + storage as the candidate (RLS: own rows only).
  const { data: sub } = await cand.from("assessment_submissions").select("id, status").eq("assignment_id", asg.id).single();
  const { data: rows } = await cand.from("assessment_answer_files")
    .select("id, kind, question_id, candidate_id, storage_path, file_name, mime_type, size_bytes, submission_id").eq("submission_id", sub.id);
  const row = rows?.find((r) => r.file_name === "UX_Friction_Analysis_Report.pdf");
  const me = (await cand.auth.getUser()).data.user.id;
  check("metadata row: kind=solution, no question, own candidate, this submission",
    row && row.kind === "solution" && row.question_id === null && row.candidate_id === me && row.submission_id === sub.id,
    row && `${row.storage_path}`);
  check("metadata: mime and size from storage", row && row.mime_type === "application/pdf" && Number(row.size_bytes) === pdfBytes.length,
    row && `${row.mime_type} ${row.size_bytes} B`);
  const { data: own, error: ownErr } = await cand.storage.from("assessment-attachments").download(row.storage_path);
  const ownBuf = own ? Buffer.from(await own.arrayBuffer()) : null;
  check("object persisted in Supabase Storage (bytes identical)", ownBuf && sha(ownBuf) === sha(pdfBytes), ownErr?.message ?? sha(ownBuf ?? ""));

  // 4. Invalid file and oversize file: rejected in the UI…
  await input.setInputFiles(path.join(NEG, "evil.exe"));
  const exeToast = await c.page.getByText(/evil\.exe:/).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  check("UI rejects .exe before upload", exeToast, exeToast ? await c.page.getByText(/evil\.exe:/).first().innerText() : "");
  await input.setInputFiles(path.join(NEG, "oversize-report.pdf"));
  const bigToast = await c.page.getByText(/oversize-report\.pdf:/).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  check("UI rejects 21 MB file before upload", bigToast, bigToast ? await c.page.getByText(/oversize-report\.pdf:/).first().innerText() : "");
  await c.page.screenshot({ path: path.join(OUT, "2-candidate-rejections.png") });

  // …and by the server even if the UI is bypassed.
  const base = `${me}/${sub.id}/solution`;
  const exe = await cand.storage.from("assessment-attachments")
    .upload(`${base}/evil.exe`, fs.readFileSync(path.join(NEG, "evil.exe")), { contentType: "application/x-msdownload" });
  check("storage refuses .exe (bucket MIME list)", !!exe.error, exe.error?.message);
  const big = await cand.storage.from("assessment-attachments")
    .upload(`${base}/oversize.pdf`, fs.readFileSync(path.join(NEG, "oversize-report.pdf")), { contentType: "application/pdf" });
  check("storage refuses 21 MB (bucket limit 20 MB)", !!big.error, big.error?.message);
  const fake = await cand.rpc("register_task_solution_file", { p_assignment: asg.id, p_path: `${base}/missing.pdf`, p_name: "m.pdf", p_mime: "application/pdf", p_size: 10 });
  check("server refuses registering a file that was never uploaded", !!fake.error, fake.error?.message);
  const other = await cand.storage.from("assessment-attachments")
    .upload(`${me}/${crypto.randomUUID()}/solution/x.pdf`, pdfBytes, { contentType: "application/pdf" });
  check("storage refuses writes into a submission that is not the candidate's", !!other.error, other.error?.message);

  // 5. Refresh: still there.
  await c.page.reload();
  await c.page.getByRole("button", { name: /متابعة|ابدأ التقييم/ }).click().catch(() => {});
  const dlBtns = c.page.getByRole("button", { name: "تنزيل UX_Friction_Analysis_Report.pdf" });
  const afterReload = await dlBtns.first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  check("file still listed after a page refresh (exactly once)", afterReload && (await dlBtns.count()) === 1);
  await c.page.screenshot({ path: path.join(OUT, "2b-candidate-after-refresh.png"), fullPage: true });

  // 6. Submit the task.
  await c.page.getByRole("button", { name: "تسليم التقييم" }).click();
  await c.page.getByText("تم التسليم").first().waitFor({ timeout: 30000 });
  await c.page.waitForLoadState("networkidle").catch(() => {});
  const { data: sub2 } = await cand.from("assessment_submissions").select("status, submitted_at").eq("id", sub.id).single();
  check("submission recorded with timestamp", sub2.status !== "in_progress" && !!sub2.submitted_at, `${sub2.status} ${sub2.submitted_at}`);
  const shown = await c.page.getByText("UX_Friction_Analysis_Report.pdf").first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  check("submitted solution file shown on the candidate's result page", shown);
  await c.page.screenshot({ path: path.join(OUT, "3-candidate-submitted.png"), fullPage: true });
  const late = await cand.storage.from("assessment-attachments").upload(`${base}/late.pdf`, pdfBytes, { contentType: "application/pdf" });
  check("no uploads after submission", !!late.error, late.error?.message);
  const rm = await cand.rpc("remove_assessment_file", { p_file: row.id });
  check("no removal after submission", !!rm.error, rm.error?.message);

  // 7. Authorized employer downloads through the UI (signed URL), bytes identical.
  await emp.page.goto(`${BASE}/company/applications/${APP}`);
  const dl = emp.page.getByRole("button", { name: "Download UX_Friction_Analysis_Report.pdf" }).first();
  await dl.waitFor({ timeout: 20000 });
  await dl.scrollIntoViewIfNeeded();
  await emp.page.screenshot({ path: path.join(OUT, "4-employer-application.png"), fullPage: true });
  const [req] = await Promise.all([
    emp.page.waitForRequest((r) => r.url().includes("/storage/v1/object/sign/assessment-attachments/"), { timeout: 20000 }),
    dl.click(),
  ]);
  const signed = req.url();
  const res = await fetch(signed);
  const got = Buffer.from(await res.arrayBuffer());
  check("employer (same company) downloads via signed URL, bytes identical", res.ok && sha(got) === sha(pdfBytes), `HTTP ${res.status}, ${got.length} B`);
  fs.writeFileSync(path.join(OUT, "downloaded-by-employer.pdf"), got);

  // 8. Unauthorized access is denied.
  for (const who of ["recruiter.souqa", "admin.souqa", "candidate02"]) {
    const x = await api(who);
    const { data: seen } = await x.from("assessment_answer_files").select("id").eq("submission_id", sub.id);
    const s = await x.storage.from("assessment-attachments").createSignedUrl(row.storage_path, 60);
    const d = await x.storage.from("assessment-attachments").download(row.storage_path);
    check(`${who}: no metadata, no signed URL, no download`, (seen ?? []).length === 0 && !!s.error && !!d.error,
      `rows=${(seen ?? []).length}; sign: ${s.error?.message}; download: ${d.error?.message}`);
  }
  const anon = await api(null);
  const ad = await anon.storage.from("assessment-attachments").download(row.storage_path);
  const ar = await anon.rpc("register_task_solution_file", { p_assignment: asg.id, p_path: row.storage_path, p_name: "x", p_mime: "application/pdf", p_size: 1 });
  check("anonymous: no download, RPC not callable", !!ad.error && !!ar.error, `${ad.error?.message}; ${ar.error?.message}`);
  const pub = await fetch(`${URL_}/storage/v1/object/public/assessment-attachments/${row.storage_path}`);
  check("no public URL for the object", !pub.ok, `HTTP ${pub.status}`);
  const replay = await fetch(signed.replace(/token=[^&]+/, "token=invalid"));
  check("tampered signed URL refused", !replay.ok, `HTTP ${replay.status}`);

  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ assignment: asg.id, submission: sub.id, file: row, results }, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("ERROR", e);
  process.exit(2);
});
