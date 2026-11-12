/**
 * Exhibition documents from the live database and the task definitions:
 *   npx tsx scripts/exhibition/generate-docs.ts <private dir>
 * Private: ASSESSMENT-SOLUTIONS-PRIVATE.md (+ completed solution files), EXHIBITION-CREDENTIALS-PRIVATE.md.
 * Shareable: EXHIBITION-COMPANY-JOB-MATRIX.md, EXHIBITION-ACCOUNTS.md, EXHIBITION-INTERVIEW-SCHEDULE.md,
 * EXHIBITION-DATA-SUMMARY.md (no passwords, no answer keys).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { CANDIDATES, STAFF } from "./data-people";
import { JOBS } from "./data-jobs";
import { SUBMISSIONS } from "./data-submissions";
import { buildDocx, buildXlsx } from "./office";

config({ path: ".env.local", quiet: true });
const PRIV = process.argv[2];
const PUB = join(PRIV, "public");
mkdirSync(PUB, { recursive: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const creds: Record<string, { password: string }> = JSON.parse(readFileSync(join(PRIV, "credentials.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(PRIV, "demo-manifest.json"), "utf8"));
const runs: { job: string; candidate: string; quality: string; question: number; status: string; score: number | null; max: number | null }[] = existsSync(join(PRIV, "evaluation-runs.json")) ? JSON.parse(readFileSync(join(PRIV, "evaluation-runs.json"), "utf8")) : [];
const today = new Date().toISOString().slice(0, 10);
const w = (dir: string, name: string, body: string) => writeFileSync(join(dir, name), body, { mode: dir === PRIV ? 0o600 : 0o644 });

(async () => {
  const { data: companies } = await db.from("company_profiles").select("id, registry_id, name_en, name_ar, sector_en").not("registry_id", "is", null).order("registry_id");
  const { data: jobs } = await db.from("jobs").select("id, company_id, title_en, title_ar, status, listing_type, assessment_id, experience_level, city, applications(count)").in("company_id", (companies ?? []).map((c) => c.id)).not("title_en", "like", "Test role%").order("created_at");
  const newJob = new Set(Object.values(manifest.jobs as Record<string, { job: string }>).map((j) => j.job));

  // ------------------------------------------------------------ matrix
  let md = `# JADARAH — Company and job matrix\n\nGenerated ${today} from the live database. The ten supported organizations (registry ALM-001…ALM-010). Opportunities are labelled **Simulation** in the product: practice scenarios, not vacancies published by the organizations.\n\n`;
  for (const c of companies ?? []) {
    const js = (jobs ?? []).filter((j) => j.company_id === c.id && j.status === "published");
    const ex = JOBS.find((j) => j.registry === c.registry_id)!;
    md += `## ${c.registry_id} — ${c.name_en} · ${c.name_ar}\nIndustry: ${c.sector_en}. Exhibition role: **${ex.title_en}** (${ex.field}).\n\n| Job | المسمى | Level | City | Practical task | Applications |\n|---|---|---|---|---|---|\n`;
    for (const j of js) md += `| ${j.title_en}${newJob.has(j.id) ? " ★" : ""} | ${j.title_ar} | ${j.experience_level} | ${j.city} | ${j.assessment_id ? "yes" : "—"} | ${(j.applications as unknown as { count: number }[])[0]?.count ?? 0} |\n`;
    md += "\n";
  }
  md += "★ = added for the exhibition with a 4-question practical task (multiple choice, written scenario, file deliverable, short recommendation).\n";
  w(PUB, "EXHIBITION-COMPANY-JOB-MATRIX.md", md);

  // ------------------------------------------------------------ accounts (+ private credentials)
  const { data: profs } = await db.from("profiles").select("id, email, full_name, account_type").like("email", "%@jadarah.example").order("email");
  const { data: mems } = await db.from("company_memberships").select("user_id, role, status, company:company_profiles(registry_id, name_en)").in("user_id", (profs ?? []).map((p) => p.id));
  const memOf = new Map((mems ?? []).map((m) => [m.user_id, m]));
  const enName = new Map<string, string>([...STAFF.map((s) => [s.email, s.en] as [string, string]), ...CANDIDATES.map((c) => [c.email, c.en] as [string, string])]);
  const rows = (profs ?? []).map((p) => {
    const m = memOf.get(p.id) as { role: string; company: { registry_id: string; name_en: string } } | undefined;
    const role = m ? m.role : "candidate";
    return { ...p, role, company: m ? `${m.company.registry_id} ${m.company.name_en}` : "—", en: enName.get(p.email) ?? p.email.split("@")[0].split(".").map((x: string) => x[0].toUpperCase() + x.slice(1)).join(" "), isNew: !!creds[p.email] };
  });
  const order = (r: { role: string }) => ["recruiter", "interviewer", "company_admin", "candidate"].indexOf(r.role);
  rows.sort((a, b) => order(a) - order(b) || a.company.localeCompare(b.company) || a.email.localeCompare(b.email));
  let acc = `# JADARAH — Exhibition accounts\n\nGenerated ${today}. All accounts are fictional people in the reserved \`jadarah.example\` domain (no email is ever sent to them). Passwords are **not** in this file.\n\n| Arabic name | English name | Role | Company | Login | Account |\n|---|---|---|---|---|---|\n`;
  for (const r of rows) acc += `| ${r.full_name} | ${r.en} | ${r.role} | ${r.company} | ${r.email} | ${r.isNew ? "new" : "existing"} |\n`;
  acc += `\nSuper Admin: use the owner's existing Super Admin account (not listed here).\n`;
  w(PUB, "EXHIBITION-ACCOUNTS.md", acc);
  let cr = `# JADARAH — Exhibition credentials (PRIVATE — never commit or share publicly)\n\nGenerated ${today}. Sign in at /sign-in. Existing accounts keep their passwords (unchanged); they are in the earlier private credentials file held by the owner.\n\n| Arabic name | English name | Role | Company | Email | Password | Account | Sign-in verified |\n|---|---|---|---|---|---|---|---|\n`;
  for (const r of rows) cr += `| ${r.full_name} | ${r.en} | ${r.role} | ${r.company} | ${r.email} | ${r.isNew ? `\`${creds[r.email].password}\`` : "(unchanged — earlier private file)"} | ${r.isNew ? "new" : "existing"} | ${r.isNew ? "yes (password sign-in by the seed)" : "yes (session used by the seed)"} |\n`;
  w(PRIV, "EXHIBITION-CREDENTIALS-PRIVATE.md", cr);

  // ------------------------------------------------------------ interviews
  const { data: ivs } = await db
    .from("interviews")
    .select("id, title, type, status, scheduled_at, ends_at, company:company_profiles(registry_id, name_en), application:applications(candidate:profiles!applications_candidate_id_fkey(full_name, email), job:jobs(title_en)), interview_participants(user:profiles(full_name, email))")
    .in("company_id", (companies ?? []).map((c) => c.id))
    .gte("scheduled_at", `${today}T00:00:00Z`)
    .order("scheduled_at");
  const t = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" });
  let iv = `# JADARAH — Interview schedule\n\nGenerated ${today} from the database (times in Asia/Riyadh). Only interviews of the ten supported organizations from today onward.\n\n| When (Riyadh) | Ends | Candidate | Company | Job | Type | Interviewer | Status |\n|---|---|---|---|---|---|---|---|\n`;
  for (const i of (ivs ?? []) as unknown as { scheduled_at: string; ends_at: string; type: string; status: string; company: { registry_id: string; name_en: string }; application: { candidate: { full_name: string; email: string }; job: { title_en: string } }; interview_participants: { user: { full_name: string; email: string } }[] }[])
    iv += `| ${t(i.scheduled_at)} | ${t(i.ends_at).split(", ").pop()} | ${i.application.candidate.full_name} (${i.application.candidate.email}) | ${i.company.registry_id} ${i.company.name_en} | ${i.application.job.title_en} | ${i.type} | ${i.interview_participants.map((p) => p.user.full_name).join(", ")} | ${i.status} |\n`;
  w(PUB, "EXHIBITION-INTERVIEW-SCHEDULE.md", iv);

  // ------------------------------------------------------------ data summary (counts from the database)
  const ids = (companies ?? []).map((c) => c.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cnt = async (table: string, f: (q: any) => unknown) => {
    const q = db.from(table).select("*", { count: "exact", head: true });
    const { count } = await (f(q) as Promise<{ count: number | null }>);
    return count ?? 0;
  };
  const exUsers = (profs ?? []).map((p) => p.id);
  const subIds = Object.values(manifest.applications as Record<string, { submission?: string }>).map((a) => a.submission).filter(Boolean) as string[];
  const lines: [string, number | string][] = [
    ["Supported companies (registry)", (companies ?? []).length],
    ["Recruiters (jadarah.example)", rows.filter((r) => r.role === "recruiter").length],
    ["Interviewers (jadarah.example)", rows.filter((r) => r.role === "interviewer").length],
    ["Candidates (jadarah.example)", rows.filter((r) => r.role === "candidate").length],
    ["Published jobs at the 10 companies", (jobs ?? []).filter((j) => j.status === "published").length],
    ["…of which added for the exhibition", newJob.size],
    ["Applications at the 10 companies", await cnt("applications", (q) => q.in("company_id", ids))],
    ["…by exhibition candidates", await cnt("applications", (q) => q.in("candidate_id", exUsers))],
    ["Practical tasks at the 10 companies", await cnt("assessments", (q) => q.in("company_id", ids).eq("status", "published"))],
    ["Task assignments (exhibition candidates)", await cnt("assessment_assignments", (q) => q.in("candidate_id", exUsers))],
    ["Submitted task attempts (exhibition seed)", await cnt("assessment_submissions", (q) => q.in("id", subIds).neq("status", "in_progress"))],
    ["In-progress attempts (exhibition seed)", await cnt("assessment_submissions", (q) => q.in("id", subIds).eq("status", "in_progress"))],
    ["Uploaded answer files (exhibition seed)", await cnt("assessment_answer_files", (q) => q.in("submission_id", subIds))],
    ["AI question evaluations (exhibition seed)", await cnt("assessment_ai_evaluations", (q) => q.in("submission_id", subIds))],
    ["Reviewer decisions (exhibition seed)", await cnt("assessment_evaluations", (q) => q.in("submission_id", subIds))],
    ["Interviews today onward (10 companies)", (ivs ?? []).length],
  ];
  let sum = `# JADARAH — Exhibition data summary\n\nGenerated ${today}; every number is a live database count.\n\n| Item | Count |\n|---|---|\n${lines.map(([k, v]) => `| ${k} | ${v} |`).join("\n")}\n`;
  if (runs.length) {
    sum += `\n## AI evaluations by submission quality (Questions 2 and 3)\n\n| Company job | Candidate | Prepared quality | Q2 | Q3 |\n|---|---|---|---|---|\n`;
    for (const s of SUBMISSIONS) {
      const r = (q: number) => runs.filter((x) => x.job === s.job && x.candidate === s.candidate && x.question === q).pop();
      const f = (x?: { status: string; score: number | null; max: number | null }) => (!x ? "—" : x.status === "completed" ? `${x.score}/${x.max}` : x.status);
      sum += `| ${s.job} | ${s.candidate.split("@")[0]} | ${s.quality} | ${f(r(2))} | ${f(r(3))} |\n`;
    }
  }
  w(PUB, "EXHIBITION-DATA-SUMMARY.md", sum);

  // ------------------------------------------------------------ private model solutions (+ completed files)
  const SOL = join(PRIV, "ASSESSMENT-SOLUTIONS-FILES");
  mkdirSync(SOL, { recursive: true });
  let sol = `# JADARAH — Assessment model solutions (PRIVATE — answer keys; never share with candidates)\n\nGenerated ${today}. One section per company → job → task → question. Completed solution files are in \`ASSESSMENT-SOLUTIONS-FILES/\`. These are reference answers for reviewers; AI scores in the platform are produced independently from each candidate's submission and are never copied from this document.\n\n`;
  for (const j of JOBS) {
    const c = (companies ?? []).find((x) => x.registry_id === j.registry)!;
    const fq = j.task.questions[2].deliverable!;
    const solName = fq.name.replace(/\.(docx|xlsx)$/, "_solution.$1");
    writeFileSync(join(SOL, `${j.short}-${solName}`), j.solutionFile.kind === "docx" ? buildDocx(j.solutionFile.lines) : buildXlsx(j.solutionFile.sheets));
    sol += `## ${c.registry_id} ${c.name_en} — ${j.title_en}\n\n### Task: ${j.task.title_en} (${j.task.minutes} min, ${j.task.questions.reduce((a, q) => a + q.points, 0)} points)\n\n${j.task.desc_en.replace(/\n/g, "  \n")}\n\n`;
    for (const [i, q] of j.task.questions.entries()) {
      const s = q.solution;
      sol += `#### Question ${i + 1} (${q.type}, ${q.points} points)\n\n${q.en.replace(/\n/g, "  \n")}\n\n`;
      if (q.options) sol += `Options: ${q.options.map((o) => `${o.correct ? "**✓ " : ""}${o.en}${o.correct ? "**" : ""}`).join(" · ")}\n\n`;
      if (q.deliverable) sol += `Deliverable: \`${q.deliverable.name}\` (${q.deliverable.format}). Completed solution file: \`ASSESSMENT-SOLUTIONS-FILES/${j.short}-${solName}\`.\n\n`;
      sol += `1. **Model answer.** ${s.model}\n2. **Step by step.** ${s.steps.map((x, k) => `(${k + 1}) ${x}`).join(" ")}\n3. **Approach.** ${s.approach}\n4. **Expected output.** ${s.output}\n5. **Calculations.** ${s.calc ?? "—"}\n6. **Required evidence.** ${s.evidence}\n7. **Excellent answer.** ${s.excellent.join("; ")}\n8. **Common mistakes.** ${s.mistakes.join("; ")}\n9. **Evaluation criteria.** ${q.criteria ? q.criteria.map((c2) => `${c2.en} (${c2.max}): ${c2.desc}`).join("; ") : "Scored automatically (correct option)."}\n10. **Expected score.** ${s.score}\n\n`;
      if (j.solutionFile.kind === "docx" && q.deliverable) sol += `<details><summary>Solution file text</summary>\n\n${j.solutionFile.lines.map((l) => `> ${l}`).join("\n>\n")}\n\n</details>\n\n`;
    }
  }
  w(PRIV, "ASSESSMENT-SOLUTIONS-PRIVATE.md", sol);
  console.log("documents written");
})().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
