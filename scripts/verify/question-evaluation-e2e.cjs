/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
// Live end-to-end check of question-level evaluation (demo accounts, real AI, real files, real UI). It WRITES demo
// records: a 5-question task of the recruiter's company, an assignment, a submission, files, AI results and reviews.
//
//   node scripts/verify/question-evaluation-e2e.cjs <files dir> <output dir>
//
// <files dir> must contain database_design.pdf, api_solution.zip, analysis_report.docx and revenue_chart.png.
// env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, DEMO_USER_PASSWORD,
//      E2E_APPLICATION (an open application of candidate01 at recruiter.nawat's company), E2E_BASE (default :3000)
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");
const { createClient } = require(require.resolve("@supabase/supabase-js", { paths: [process.cwd()] }));

const [, , FILES, OUT] = process.argv;
const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const APP = process.env.E2E_APPLICATION;
const PW = process.env.DEMO_USER_PASSWORD;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + String(detail).slice(0, 300) : ""}`);
};
async function api(local) {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email: `${local}@jadarah-demo.test`, password: PW });
  if (error) throw new Error(`sign-in ${local}: ${error.message}`);
  return c;
}
async function signIn(browser, local, locale = "en") {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.addCookies([{ name: "jadarah_locale", value: "en", url: BASE }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/sign-in`);
  await page.locator("#email").fill(`${local}@jadarah-demo.test`);
  await page.locator("#password").fill(PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  if (locale !== "en") await ctx.addCookies([{ name: "jadarah_locale", value: locale, url: BASE }]);
  return { ctx, page };
}
const stamp = Date.now().toString(36);

(async () => {
  // ------------------------------------------------------------ 1. Employer builds a 5-question task (API, own session)
  const rec = await api("recruiter.nawat");
  const me = (await rec.auth.getUser()).data.user.id;
  const { data: mem } = await rec.from("company_memberships").select("company_id").eq("user_id", me).eq("status", "active").single();
  const cid = mem.company_id;
  const title = `QE test ${stamp}: orders platform`;
  const { data: asmt, error: aErr } = await rec.from("assessments").insert({
    company_id: cid, title_en: title, title_ar: `اختبار التقييم ${stamp}`, description_en: "Three practical parts", description_ar: "ثلاثة أجزاء عملية",
    duration_minutes: 90, passing_score: 60, status: "draft", created_by: me,
  }).select("id").single();
  if (aErr) throw aErr;
  const rub = async (q, criteria) => {
    const { data, error } = await rec.from("assessment_rubrics").insert({ assessment_id: asmt.id, title_en: `Rubric ${q}`, title_ar: `معايير ${q}`, criteria }).select("id").single();
    if (error) throw error;
    return data.id;
  };
  const r1 = await rub("Q1", [
    { key: "schema_correctness", name_en: "Tables, keys and constraints", name_ar: "الجداول والمفاتيح والقيود", description_en: "users, orders, order_items with primary/foreign keys and checks", max_points: 4 },
    { key: "indexing", name_en: "Indexes for the stated queries", name_ar: "الفهارس", description_en: "index on orders.user_id and on orders.created_at", max_points: 3 },
    { key: "normalisation", name_en: "Normalisation explained", name_ar: "شرح التطبيع", description_en: "explains normal form and historical prices", max_points: 3 },
  ]);
  const r2 = await rub("Q2", [
    { key: "endpoint", name_en: "POST /orders returns 201 with the created order", name_ar: "نقطة النهاية", max_points: 3 },
    { key: "validation", name_en: "Input validation (productId uuid, quantity positive integer, 400 on error)", name_ar: "التحقق من المدخلات", max_points: 4 },
    { key: "tests", name_en: "Automated tests for valid and invalid payloads", name_ar: "الاختبارات الآلية", max_points: 3 },
  ]);
  const Q = [
    { type: "case_study", points: 10, rubric_id: r1, prompt_en: "Question 1 — Database design\n\nDesign the PostgreSQL schema for an online orders system with users, orders and order items. Include primary and foreign keys, check constraints, an index that supports listing a customer's orders and an index for recent orders, and explain which normal form the schema satisfies and how historical prices are kept.", config: { deliverables: [{ name: "database_design.pdf", format: "PDF", description: "Schema, indexes and normalisation explanation" }] } },
    { type: "coding", points: 10, rubric_id: r2, prompt_en: "Question 2 — API implementation\n\nImplement POST /orders in Node.js (Express). Validate the body: productId must be a UUID and quantity a positive integer; respond 400 with an error message on invalid input and 201 with the created order on success. Include automated tests covering a valid order and invalid payloads.", config: { language: "javascript", deliverables: [{ name: "api_solution.zip", format: "ZIP", description: "Source code and tests" }] } },
    { type: "long_answer", points: 8, rubric_id: null, prompt_en: "Question 3 — Data analysis\n\nMonthly revenue was January 120,000 SAR, February 138,000 SAR and March 151,800 SAR. Compute the month-over-month growth for February and March and the average monthly growth, interpret the trend, give one recommendation, and attach a chart of the monthly revenue.", config: { deliverables: [{ name: "analysis_report.docx", format: "DOCX", description: "Calculations, interpretation, recommendation" }, { name: "revenue_chart.png", format: "PNG", description: "Chart of monthly revenue" }] } },
    { type: "multiple_choice", points: 2, rubric_id: null, prompt_en: "Question 4 — Which index type does PostgreSQL create by default?", config: {} },
    { type: "long_answer", points: 4, rubric_id: null, prompt_en: "Question 5 — Deployment notes\n\nDescribe how you would deploy the API with zero downtime.", config: {} },
  ];
  const qIds = [];
  for (const [i, q] of Q.entries()) {
    const { data, error } = await rec.from("assessment_questions").insert({ assessment_id: asmt.id, type: q.type, prompt_en: q.prompt_en, prompt_ar: q.prompt_en, points: q.points, position: i, rubric_id: q.rubric_id, config: q.config }).select("id").single();
    if (error) throw error;
    qIds.push(data.id);
  }
  await rec.from("assessment_rubrics").update({ question_id: qIds[0] }).eq("id", r1);
  await rec.from("assessment_rubrics").update({ question_id: qIds[1] }).eq("id", r2);
  const { error: oErr } = await rec.from("assessment_options").insert([
    { question_id: qIds[3], label_en: "B-tree", label_ar: "B-tree", is_correct: true, position: 0 },
    { question_id: qIds[3], label_en: "Hash", label_ar: "Hash", is_correct: false, position: 1 },
  ]).select("id, label_en");
  if (oErr) throw oErr;
  const { error: pErr } = await rec.from("assessments").update({ status: "published" }).eq("id", asmt.id);
  if (pErr) throw pErr;
  check("task with 5 distinct questions created (2 employer rubrics, 1 without rubric)", qIds.length === 5, asmt.id);

  const browser = await chromium.launch();
  // ------------------------------------------------------------ 2. Employer assigns it in the UI
  const emp = await signIn(browser, "recruiter.nawat");
  await emp.page.goto(`${BASE}/company/applications/${APP}`);
  await emp.page.locator('select[name="assessment_id"]').selectOption(asmt.id);
  await emp.page.getByRole("button", { name: "Assign", exact: true }).click();
  const t = emp.page.locator("[data-sonner-toast]").first();
  await t.waitFor({ timeout: 20000 });
  check("employer assigns the task (UI)", /Assessment assigned/.test(await t.innerText()));
  const cand = await api("candidate01");
  const { data: asg } = await cand.from("assessment_assignments").select("id, status").eq("application_id", APP).eq("assessment_id", asmt.id).single();

  // ------------------------------------------------------------ 3. Candidate answers each question with its own files (UI)
  const c = await signIn(browser, "candidate01");
  c.page.on("dialog", (d) => d.accept());
  await c.page.goto(`${BASE}/candidate/assessments/${asg.id}`);
  await c.page.getByRole("button", { name: /Begin assessment|Resume/ }).click();
  const answer = (txt) => c.page.getByRole("textbox", { name: "Your answer" }).fill(txt);
  const upload = async (qi, files) => {
    const sec = c.page.locator(`section[aria-labelledby="files-${qIds[qi]}"]`);
    await sec.waitFor({ timeout: 20000 });
    for (const f of files) {
      await sec.locator('input[type="file"]').setInputFiles(path.join(FILES, f));
      await sec.getByRole("button", { name: `Download ${f}` }).waitFor({ timeout: 60000 });
    }
  };
  // Wait until the next question is the one on screen (and the previous one is gone) before typing.
  const next = async (n) => {
    await c.page.getByRole("button", { name: "Next" }).click();
    await c.page.getByRole("heading", { name: new RegExp(`^Question ${n} —`) }).waitFor({ timeout: 10000 });
    await c.page.waitForFunction(() => document.querySelectorAll("h2").length && [...document.querySelectorAll("h2")].filter((h) => /^Question \d —/.test(h.textContent ?? "")).length === 1);
  };
  await answer("The schema, indexes and normalisation explanation are in database_design.pdf.");
  await upload(0, ["database_design.pdf"]);
  await c.page.screenshot({ path: path.join(OUT, "1-candidate-q1-files.png"), fullPage: true });
  await next(2);
  await answer("My implementation is in api_solution.zip.");
  await upload(1, ["api_solution.zip"]);
  await next(3);
  await answer("Growth: February 15.0%, March 10.0%, average 12.5%. Full analysis in the report; chart attached.");
  await upload(2, ["analysis_report.docx", "revenue_chart.png"]);
  await c.page.screenshot({ path: path.join(OUT, "2-candidate-q3-two-files.png"), fullPage: true });
  await next(4);
  await c.page.getByRole("radio", { name: /B-tree/ }).click();
  await next(5); // question 5: deliberately left empty, no files
  await c.page.waitForTimeout(1500);
  await c.page.getByRole("button", { name: "Submit assessment" }).click();
  await c.page.getByText("Submitted").first().waitFor({ timeout: 30000 });
  const { data: sub } = await cand.from("assessment_submissions").select("id, status").eq("assignment_id", asg.id).single();
  check("candidate submitted", sub.status !== "in_progress", sub.status);

  // 1. association: every file under the exact question id
  const { data: files } = await rec.from("assessment_answer_files").select("id, question_id, file_name, storage_path, mime_type").eq("submission_id", sub.id);
  const byQ = (i) => files.filter((f) => f.question_id === qIds[i]).map((f) => f.file_name).sort();
  check("Q1 file ↔ Q1", JSON.stringify(byQ(0)) === '["database_design.pdf"]', byQ(0));
  check("Q2 file ↔ Q2", JSON.stringify(byQ(1)) === '["api_solution.zip"]', byQ(1));
  check("Q3 two files ↔ Q3", JSON.stringify(byQ(2)) === '["analysis_report.docx","revenue_chart.png"]', byQ(2));
  check("Q4/Q5 no files; nothing unlinked", byQ(3).length === 0 && byQ(4).length === 0 && files.every((f) => f.question_id), files.length);
  const { data: answersRows } = await rec.from("assessment_answers").select("question_id, text_answer").eq("submission_id", sub.id);
  const txt = (i) => answersRows.find((a) => a.question_id === qIds[i])?.text_answer ?? "";
  check("each written answer stored on its own question", /database_design/.test(txt(0)) && /api_solution/.test(txt(1)) && /12\.5%/.test(txt(2)) && !txt(4), [0, 1, 2, 4].map(txt).join(" | "));
  check("storage path carries submission and question ids", files.every((f) => f.storage_path.split("/")[1] === sub.id && f.storage_path.split("/")[2] === f.question_id));

  // ------------------------------------------------------------ 4. Employer: AI evaluation per question (UI)
  await emp.page.goto(`${BASE}/company/applications/${APP}`);
  const card = emp.page.locator("div.surface-card").filter({ has: emp.page.getByText(title, { exact: true }) }).last();
  await card.waitFor({ timeout: 30000 });
  const openQ = async (n) => card.getByRole("navigation", { name: "Questions" }).getByRole("button", { name: new RegExp(`^Question ${n}( ✓)?$`) }).click();
  const runAi = async (n) => {
    await openQ(n);
    const before = (await rec.from("assessment_ai_evaluations").select("id", { count: "exact", head: true }).eq("submission_id", sub.id).eq("question_id", qIds[n - 1])).count ?? 0;
    await card.getByRole("button", { name: /Evaluate this question with AI|Re-evaluate this question/ }).click();
    const t0 = Date.now();
    for (;;) {
      const now = (await rec.from("assessment_ai_evaluations").select("id", { count: "exact", head: true }).eq("submission_id", sub.id).eq("question_id", qIds[n - 1])).count ?? 0;
      if (now > before) break;
      const err = await emp.page.locator("[data-sonner-toast][data-type='error']").count();
      if (err || Date.now() - t0 > 180000) throw new Error(`AI evaluation of question ${n} did not complete${err ? ": " + (await emp.page.locator("[data-sonner-toast][data-type='error']").first().innerText()) : ""}`);
      await new Promise((r) => setTimeout(r, 1500));
    }
    await emp.page.waitForTimeout(2500); // refresh
    return Date.now() - t0;
  };
  const times = {};
  for (const n of [1, 2, 3, 5]) times[n] = await runAi(n);
  await openQ(1);
  await card.screenshot({ path: path.join(OUT, "3-employer-q1-ai.png") });
  await openQ(2);
  await card.screenshot({ path: path.join(OUT, "4-employer-q2-ai.png") });
  await openQ(3);
  await card.screenshot({ path: path.join(OUT, "5-employer-q3-ai.png") });

  const { data: ai } = await rec.from("assessment_ai_evaluations").select("*").eq("submission_id", sub.id).order("created_at");
  const A = (i) => ai.filter((x) => x.question_id === qIds[i]).at(-1);
  const keys = (i) => A(i).criteria.map((x) => x.key).sort().join(",");
  const fileNames = (i) => A(i).files.map((x) => x.file_name).sort().join(",");
  check("2. each question evaluated separately (one AI result per question)", [0, 1, 2, 4].every((i) => A(i)) && !ai.some((x) => x.question_id === qIds[3]), ai.length);
  check("3/4. Q1 evaluated with Q1's rubric and only Q1's file (PDF text read)", A(0).rubric_source === "employer_question" && keys(0) === "indexing,normalisation,schema_correctness" && fileNames(0) === "database_design.pdf" && A(0).files[0].method === "pdf_text", `${keys(0)} | ${fileNames(0)} ${A(0).files[0].method}`);
  check("3/4. Q2 evaluated with Q2's rubric and only Q2's ZIP (archive read)", A(1).rubric_source === "employer_question" && keys(1) === "endpoint,tests,validation" && fileNames(1) === "api_solution.zip" && A(1).files[0].method === "zip" && A(1).files[0].entries.some((e) => e.name.endsWith("orders.js") && e.status === "read"), `${keys(1)} | ${JSON.stringify(A(1).files[0].entries)}`);
  check("8. Q3 two attachments evaluated together; no rubric → AI-derived criteria (labelled)", A(2).rubric_source === "ai_derived" && fileNames(2) === "analysis_report.docx,revenue_chart.png" && A(2).criteria.length >= 2 && Math.abs(A(2).criteria.reduce((s, x) => s + Number(x.max_points), 0) - 8) < 0.05, `${fileNames(2)} | ${A(2).files.map((f) => `${f.file_name}:${f.method}/${f.status}`).join(" ")} | ${A(2).criteria.map((x) => `${x.name}/${x.max_points}`).join("; ")}`);
  check("9. Q5 nothing submitted → recorded as no submission (score 0), not evaluated as an answer", A(4).status === "no_submission" && Number(A(4).score) === 0 && !A(4).provider, A(4).explanation);
  const s1 = Number(A(0).score), s2 = Number(A(1).score), s3 = Number(A(2).score);
  check("6. scores differ with quality (strong Q1 > weak Q2, as % of points)", s1 / 10 > s2 / 10 + 0.25, `Q1 ${s1}/10, Q2 ${s2}/10, Q3 ${s3}/8`);
  const missing2 = A(1).requirements.filter((r) => r.status !== "fulfilled").map((r) => r.requirement).join(" | ");
  check("7. Q2 missing requirements identified (validation, tests, 201)", /test/i.test(missing2) && /valid/i.test(missing2), missing2);
  const evid = (i) => A(i).criteria.filter((x) => x.evidence).map((x) => x.evidence);
  check("5. Q1 feedback quotes Q1's actual file (verified quotes)", evid(0).length > 0 && A(0).criteria.filter((x) => x.evidence).every((x) => x.evidence_verified), evid(0).join(" || "));
  check("5. Q2 feedback refers to the submitted code, not to Q1/Q3 content", /orders|res\.json|insert|README|TODO/i.test(JSON.stringify(A(1))) && !/order_items|normal form|151,800/i.test(JSON.stringify(A(1).criteria) + JSON.stringify(A(1).requirements)), A(1).explanation);
  check("isolation: Q1 result mentions nothing from Q2/Q3 files", !/res\.json|151,800|12\.5%/i.test(JSON.stringify(A(0))), "");
  check("Q3 report figures read (12.5% or 15.0% found in Q3 evidence/explanation)", /12\.5|15(\.0)?\s?%/.test(JSON.stringify(A(2))), A(2).explanation);

  // ------------------------------------------------------------ 5. Human review in the UI (AI vs human recorded)
  const approve = async (n, adjustTo) => {
    await openQ(n);
    const startAi = card.getByRole("button", { name: "Start from the AI suggestion" });
    if (await startAi.count()) await startAi.click();
    if (adjustTo !== undefined) await card.getByLabel(/Approved score/).fill(String(adjustTo));
    await card.getByLabel(/Private reviewer notes/).fill(`Reviewer check of question ${n}`);
    await card.getByRole("button", { name: /Approve score for this question|Update approved score/ }).click();
    await emp.page.getByText("Question review saved").first().waitFor({ timeout: 30000 });
    await emp.page.waitForTimeout(2000);
  };
  await approve(1); // accept AI
  const adj2 = Math.min(10, Math.round((s2 + 1) * 2) / 2);
  await approve(2, adj2); // adjust AI by +1
  await approve(3);
  await approve(5);
  const { data: evals } = await rec.from("assessment_evaluations").select("question_id, points, source, ai_evaluation_id, comments, candidate_feedback").eq("submission_id", sub.id);
  const E = (i) => evals.find((e) => e.question_id === qIds[i]);
  check("8. AI vs human: Q1 ai_accepted, Q2 ai_adjusted, linked to the question's own AI result", E(0).source === "ai_accepted" && E(1).source === "ai_adjusted" && E(0).ai_evaluation_id === A(0).id && E(1).ai_evaluation_id === A(1).id, `${E(0).source} ${E(1).source}`);
  check("original AI result preserved after adjustment", Number((await rec.from("assessment_ai_evaluations").select("score").eq("id", A(1).id).single()).data.score) === s2, `AI ${s2} → human ${adj2}`);
  const { data: hist } = await rec.from("assessment_evaluation_history").select("question_id, action, points, changed_at").eq("submission_id", sub.id);
  check("reviewer changes recorded with timestamps", hist.length >= 4 && hist.every((h) => h.changed_at), hist.length);

  // 11. overall from question scores
  const { data: subRow } = await rec.from("assessment_submissions").select("status, auto_score, manual_score, max_score, percentage, needs_review").eq("id", sub.id).single();
  const expected = [0, 1, 2, 4].reduce((s, i) => s + Number(E(i).points), 0) + 2; // Q4 auto 2/2
  check("11. overall = Σ approved question scores (Q4 auto) / Σ points", Number(subRow.auto_score) === 2 && Number(subRow.manual_score) === expected - 2 && Number(subRow.max_score) === 34 && Number(subRow.percentage) === Math.round((expected / 34) * 10000) / 100 && !subRow.needs_review,
    `${subRow.auto_score}+${subRow.manual_score}/${subRow.max_score} = ${subRow.percentage}% (expected ${expected}/34)`);

  // 12/14. employer view after refresh: per-question results stay attached
  await emp.page.reload();
  const card2 = emp.page.locator("div.surface-card").filter({ has: emp.page.getByText(title, { exact: true }) }).last();
  await card2.waitFor();
  const table = await card2.locator("table").first().innerText();
  check("12/14. employer overview after refresh shows each question's own approved score", [0, 1, 2, 4].every((i) => table.includes(`${Number(E(i).points)}/${Q[i].points}`)), table.replace(/\s+/g, " "));
  await card2.screenshot({ path: path.join(OUT, "6-employer-overview-after-refresh.png") });

  // share feedback (UI)
  await card2.getByLabel(/Overall feedback for the candidate/).fill("Thank you. Strong database design; the API needs validation and tests.");
  await card2.getByRole("button", { name: "Share feedback" }).click();
  await emp.page.getByText("Feedback shared with the candidate").first().waitFor({ timeout: 20000 });

  // ------------------------------------------------------------ 6. Candidate report (13/14)
  await c.page.goto(`${BASE}/candidate/assessments/${asg.id}`);
  await c.page.reload();
  const body = await c.page.locator("main").innerText();
  check("13. candidate sees per-question feedback (Q1 strengths, Q2 missing)", body.includes("What you did well") && body.includes("What was missing"), "");
  check("13. candidate report shows each question's approved score", [0, 1, 2, 4].every((i) => body.includes(`${Number(E(i).points)}/${Q[i].points}`)), "");
  check("13. no reviewer notes or AI internals exposed to the candidate", !body.includes("Reviewer check of question") && !/gpt|gemini|AI suggestion/i.test(body), "");
  await c.page.screenshot({ path: path.join(OUT, "7-candidate-report.png"), fullPage: true });
  // other company cannot see the AI evaluations
  const other = await api("recruiter.souqa");
  const { data: leak } = await other.from("assessment_ai_evaluations").select("id").eq("submission_id", sub.id);
  check("other company sees no AI evaluations", (leak ?? []).length === 0, "");

  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ assessment: asmt.id, assignment: asg.id, submission: sub.id, ai_seconds: Object.fromEntries(Object.entries(times).map(([k, v]) => [k, Math.round(v / 100) / 10])), results, ai: ai.map((x) => ({ q: qIds.indexOf(x.question_id) + 1, status: x.status, rubric_source: x.rubric_source, score: x.score, max: x.max_score, model: x.model, files: x.files.map((f) => `${f.file_name}:${f.method}/${f.status}`), criteria: x.criteria.map((k) => `${k.key}=${k.score}/${k.max_points}${k.evidence_verified ? " ✓" : ""}`), requirements: x.requirements.map((r) => `${r.status}: ${r.requirement}`), explanation: x.explanation })) }, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("ERROR", e);
  process.exit(2);
});
