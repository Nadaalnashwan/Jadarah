/**
 * Exhibition data, created through the platform's own workflows (idempotent; re-running creates nothing new).
 *
 *   npx tsx scripts/exhibition/seed.ts <private dir> --phase accounts|jobs|apply|submit|all
 *
 * - Accounts: Auth users (service role, confirmed, no email sent), flagged is_demo; employers join their EXISTING
 *   registry organization through request_company_access → Super Admin review_access_request; candidates fill their
 *   own profiles under RLS.
 * - Jobs: created by the organization's recruiter under RLS (task, per-question rubrics, options; published).
 * - Applications: apply_to_job by the candidate (the job's task is assigned by the database).
 * - Submissions: start_assessment / save_assessment_answer / Storage upload + register_assessment_file / submit_assessment.
 * Existing passwords are never changed: accounts without a stored password get a one-time session via an admin
 * magic-link token (generateLink sends no email). Writes a manifest of every created id and Storage path.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CANDIDATES, STAFF } from "./data-people";
import { JOBS, type Job } from "./data-jobs";
import { LIVE, SUBMISSIONS } from "./data-submissions";
import { buildDocx, buildXlsx, MIME } from "./office";

config({ path: ".env.local", quiet: true });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
if (!URL.includes("qqvvlornhvfykusaxaid")) throw new Error("unexpected Supabase project");

const PRIV = process.argv[2];
if (!PRIV) throw new Error("private dir required");
mkdirSync(PRIV, { recursive: true, mode: 0o700 });
const phaseArg = process.argv[process.argv.indexOf("--phase") + 1] ?? "all";
const phases = phaseArg === "all" ? ["accounts", "jobs", "apply", "submit"] : phaseArg.split(",");

const CREDS = join(PRIV, "credentials.json");
const MANIFEST = join(PRIV, "demo-manifest.json");
const creds: Record<string, { password: string; created: string }> = existsSync(CREDS) ? JSON.parse(readFileSync(CREDS, "utf8")) : {};
type Manifest = { users: Record<string, string>; memberships: Record<string, string>; jobs: Record<string, { job: string; assessment: string; questions: string[] }>; applications: Record<string, { application: string; assignment: string; submission?: string; state: string }>; storage: string[] };
const manifest: Manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : { users: {}, memberships: {}, jobs: {}, applications: {}, storage: [] };
const save = () => {
  writeFileSync(CREDS, JSON.stringify(creds, null, 1), { mode: 0o600 });
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1), { mode: 0o600 });
};
const log = (...a: unknown[]) => console.log(...a);
const must = <T>(r: { data: T; error: { message: string } | null }, what: string): NonNullable<T> => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as NonNullable<T>;
};
const password = () => `Jd-${randomBytes(9).toString("base64url")}-${randomBytes(2).toString("hex")}`;

// ------------------------------------------------------------------ sessions
const sessions = new Map<string, SupabaseClient>();
async function as(email: string): Promise<SupabaseClient> {
  if (sessions.has(email)) return sessions.get(email)!;
  const c = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const pw = creds[email]?.password ?? (email.endsWith("@jadarah-demo.test") ? process.env.DEMO_USER_PASSWORD : undefined);
  if (pw) {
    const { error } = await c.auth.signInWithPassword({ email, password: pw });
    if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  } else {
    // Existing account whose password we do not hold: one-time admin token (no email, password untouched).
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw new Error(`link ${email}: ${error.message}`);
    const { error: e2 } = await c.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
    if (e2) throw new Error(`otp ${email}: ${e2.message}`);
  }
  sessions.set(email, c);
  return c;
}
const uidOf = async (email: string) => {
  const { data } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  return data?.id as string | undefined;
};
const companyId = async (registry: string) => must(await admin.from("company_profiles").select("id").eq("registry_id", registry).single(), `company ${registry}`).id as string;
const skillIds = async (names: string[]) => {
  const { data } = await admin.from("skills").select("id, name_en").in("name_en", names);
  return new Map((data ?? []).map((s) => [s.name_en as string, s.id as string]));
};

// ------------------------------------------------------------------ accounts
async function ensureUser(email: string, fullName: string, accountType: "company" | "candidate") {
  let id = await uidOf(email);
  if (!id) {
    const pw = password();
    const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: fullName, account_type: accountType, locale: "ar" } });
    if (error) throw new Error(`create ${email}: ${error.message}`);
    id = data.user.id;
    creds[email] = { password: pw, created: new Date().toISOString() };
    log(`created ${email}`);
  }
  must(await admin.from("profiles").update({ is_demo: true, full_name: fullName }).eq("id", id), `flag ${email}`);
  manifest.users[email] = id;
  save();
  return id;
}

async function accounts() {
  const sa = await as("platform.admin@jadarah-demo.test");
  for (const s of STAFF) {
    const uid = await ensureUser(s.email, s.ar, "company");
    const cid = await companyId(s.registry);
    const { data: mem } = await admin.from("company_memberships").select("id, role, status").eq("company_id", cid).eq("user_id", uid).maybeSingle();
    if (mem) {
      manifest.memberships[s.email] = mem.id;
      continue;
    }
    const me = await as(s.email);
    const { data: pending } = await admin.from("company_access_requests").select("id").eq("company_id", cid).eq("user_id", uid).eq("status", "pending").maybeSingle();
    const reqId = pending?.id ?? must(await me.rpc("request_company_access", { p_company: cid, p_job_title: s.title, p_role: s.role }), `request ${s.email}`);
    must(await sa.rpc("review_access_request", { p_request: reqId, p_decision: "approve", p_role: s.role, p_note: "Exhibition team" }), `approve ${s.email}`);
    const { data: m2 } = await admin.from("company_memberships").select("id").eq("company_id", cid).eq("user_id", uid).single();
    manifest.memberships[s.email] = m2!.id;
    log(`member ${s.email} → ${s.registry} ${s.role}`);
    save();
  }
  for (const c of CANDIDATES) {
    const uid = await ensureUser(c.email, c.ar, "candidate");
    const me = await as(c.email);
    must(
      await me.from("candidate_profiles").upsert({ user_id: uid, headline: c.headline, summary: c.summary, city: c.city, country: "Saudi Arabia", years_experience: c.years, experience_level: c.level, open_to_work: true, career_interests: c.interests, languages: [{ language: "Arabic", level: "native" }, { language: "English", level: "professional" }] }),
      `profile ${c.email}`,
    );
    const { count } = await me.from("candidate_education").select("id", { count: "exact", head: true }).eq("candidate_id", uid);
    if (!count) {
      const e = c.education;
      must(await me.from("candidate_education").insert({ candidate_id: uid, institution: e.institution, degree: e.degree, field: e.field, start_date: e.start, end_date: e.end, grade: e.grade }), "education");
      for (const x of c.experience) must(await me.from("candidate_experience").insert({ candidate_id: uid, title: x.title, company: x.company, location: x.location, start_date: x.start, end_date: x.end, is_current: !x.end, description: x.description }), "experience");
      for (const p of c.projects) must(await me.from("candidate_projects").insert({ candidate_id: uid, title: p.title, description: p.description, skills: p.skills }), "project");
      for (const x of c.certs) must(await me.from("candidate_certifications").insert({ candidate_id: uid, name: x.name, issuer: x.issuer, issue_date: x.date }), "cert");
      const ids = await skillIds(c.skills.map((s) => s[0]));
      for (const [name, level] of c.skills) if (ids.get(name)) must(await me.from("candidate_skills").insert({ candidate_id: uid, skill_id: ids.get(name), level, source: "self" }), `skill ${name}`);
      must(await me.from("candidate_preferences").upsert({ candidate_id: uid, desired_roles: c.roles, desired_locations: [c.city, "Riyadh"], employment_types: ["full_time"], work_modes: ["onsite", "hybrid"] }), "preferences");
      log(`profile ${c.email}`);
    }
    must(await admin.from("profiles").update({ onboarding_completed: true }).eq("id", uid), "onboarding");
    save();
  }
}

// ------------------------------------------------------------------ jobs + tasks
const recruiterFor = (j: Job) => `recruiter.${j.short}@jadarah.example`;
async function jobs() {
  const { data: cats } = await admin.from("job_categories").select("id, slug");
  const catId = new Map((cats ?? []).map((c) => [c.slug as string, c.id as string]));
  for (const [ji, j] of JOBS.entries()) {
    const cid = await companyId(j.registry);
    const rec = await as(recruiterFor(j));
    const uid = (await rec.auth.getUser()).data.user!.id;
    const { data: existing } = await admin.from("jobs").select("id, assessment_id").eq("company_id", cid).eq("title_en", j.title_en).maybeSingle();
    if (existing) {
      const { data: qs } = await admin.from("assessment_questions").select("id").eq("assessment_id", existing.assessment_id).order("position");
      manifest.jobs[j.key] = { job: existing.id, assessment: existing.assessment_id, questions: (qs ?? []).map((q) => q.id) };
      continue;
    }
    // Practical task: questions, per-question rubrics, options; published before the job links it.
    const a = must(
      await rec
        .from("assessments")
        .insert({ company_id: cid, title_en: j.task.title_en, title_ar: j.task.title_ar, description_en: j.task.desc_en, description_ar: j.task.desc_ar, category: j.category, difficulty: j.task.difficulty, duration_minutes: j.task.minutes, passing_score: 60, status: "draft", created_by: uid })
        .select("id")
        .single(),
      "assessment",
    );
    const qids: string[] = [];
    for (const [pos, q] of j.task.questions.entries()) {
      let rubricId: string | null = null;
      if (q.criteria) {
        rubricId = must(
          await rec
            .from("assessment_rubrics")
            .insert({ assessment_id: a.id, title_en: `Question ${pos + 1}`, title_ar: `السؤال ${pos + 1}`, criteria: q.criteria.map((c) => ({ key: c.key, name_en: c.en, name_ar: c.ar, max_points: c.max, description_en: c.desc })) })
            .select("id")
            .single(),
          "rubric",
        ).id;
      }
      const config = q.deliverable ? { deliverables: [{ name: q.deliverable.name, format: q.deliverable.format, description: q.deliverable.description }] } : {};
      const qr = must(await rec.from("assessment_questions").insert({ assessment_id: a.id, type: q.type, prompt_en: q.en, prompt_ar: q.ar, points: q.points, position: pos, config, rubric_id: rubricId }).select("id").single(), "question");
      if (rubricId) must(await rec.from("assessment_rubrics").update({ question_id: qr.id }).eq("id", rubricId), "rubric link");
      if (q.options) {
        const n = q.options.length;
        for (const [oi, o] of q.options.entries()) must(await rec.from("assessment_options").insert({ question_id: qr.id, label_en: o.en, label_ar: o.ar, is_correct: !!o.correct, position: (oi + ji) % n }), "option");
      }
      qids.push(qr.id);
    }
    must(await rec.from("assessments").update({ status: "published" }).eq("id", a.id), "publish task");
    const job = must(
      await rec
        .from("jobs")
        .insert({
          company_id: cid,
          category_id: catId.get(j.category) ?? null,
          title_en: j.title_en,
          title_ar: j.title_ar,
          description_en: j.description_en,
          description_ar: j.description_ar,
          responsibilities_en: j.resp_en,
          responsibilities_ar: j.resp_ar,
          qualifications_en: j.qual_en,
          qualifications_ar: j.qual_ar,
          experience_level: j.level,
          min_years: j.min_years,
          city: j.city,
          work_mode: j.mode,
          employment_type: "full_time",
          salary_min: j.salary[0],
          salary_max: j.salary[1],
          salary_currency: "SAR",
          salary_visible: true,
          education_level: "bachelor",
          openings: 1,
          deadline: j.deadline,
          status: "draft",
          listing_type: "simulation",
          assessment_id: a.id,
          created_by: uid,
        })
        .select("id")
        .single(),
      "job",
    );
    const ids = await skillIds([...j.required, ...j.preferred]);
    for (const s of j.required) if (ids.get(s)) must(await rec.from("job_skills").insert({ job_id: job.id, skill_id: ids.get(s), importance: "required" }), `job skill ${s}`);
    for (const s of j.preferred) if (ids.get(s)) must(await rec.from("job_skills").insert({ job_id: job.id, skill_id: ids.get(s), importance: "preferred" }), `job skill ${s}`);
    for (const [i, q] of j.appQuestions.entries()) must(await rec.from("job_application_questions").insert({ job_id: job.id, question_en: q.en, question_ar: q.ar, is_required: false, position: i }), "app question");
    await rec.from("assessments").update({ job_id: job.id }).eq("id", a.id);
    must(await rec.from("jobs").update({ status: "published" }).eq("id", job.id), "publish job");
    manifest.jobs[j.key] = { job: job.id, assessment: a.id, questions: qids };
    save();
    log(`job ${j.registry} ${j.title_en}`);
  }
}

// ------------------------------------------------------------------ applications
const COVER: Record<string, string> = {};
async function apply() {
  const pairs = [...SUBMISSIONS.map((s) => ({ job: s.job, candidate: s.candidate, state: "submitted" })), ...LIVE];
  for (const p of pairs) {
    const key = `${p.job}|${p.candidate}`;
    const jobId = manifest.jobs[p.job]?.job;
    if (!jobId) throw new Error(`job ${p.job} missing — run the jobs phase`);
    const uid = await uidOf(p.candidate);
    if (!uid) throw new Error(`no account ${p.candidate}`);
    const { data: app } = await admin.from("applications").select("id, task_assignment_id").eq("job_id", jobId).eq("candidate_id", uid).maybeSingle();
    if (app) {
      manifest.applications[key] = { ...(manifest.applications[key] ?? {}), application: app.id, assignment: app.task_assignment_id, state: manifest.applications[key]?.state ?? "assigned" };
      continue;
    }
    const me = await as(p.candidate);
    const job = JOBS.find((j) => j.key === p.job)!;
    const { data: qs } = await me.from("job_application_questions").select("id").eq("job_id", jobId).order("position");
    const cover = COVER[p.candidate] ?? `I am applying for the ${job.title_en} role because it matches my background and the practical work I want to do. I look forward to completing the task.`;
    const answers = (qs ?? []).map((q) => ({ question_id: q.id, answer: "Please see my profile and practical task for concrete examples." }));
    must(await me.rpc("apply_to_job", { p_job: jobId, p_cv_document: null as unknown as string, p_cover_letter: cover, p_answers: answers }), `apply ${key}`);
    const { data: a2 } = await admin.from("applications").select("id, task_assignment_id").eq("job_id", jobId).eq("candidate_id", uid).single();
    manifest.applications[key] = { application: a2!.id, assignment: a2!.task_assignment_id, state: "assigned" };
    save();
    log(`applied ${key}`);
  }
}

// ------------------------------------------------------------------ submissions
async function submit() {
  const run = [...SUBMISSIONS.map((s) => ({ ...s, state: "submitted" as const })), ...LIVE.filter((l) => l.state === "in_progress").map((l) => ({ job: l.job, candidate: l.candidate, state: "in_progress" as const, mcq: 0, q2: "", q3: null, q4: "", quality: "average" as const }))];
  for (const s of run) {
    const key = `${s.job}|${s.candidate}`;
    const m = manifest.applications[key];
    if (!m?.assignment) throw new Error(`no assignment for ${key}`);
    const { data: sub } = await admin.from("assessment_submissions").select("id, status").eq("assignment_id", m.assignment).maybeSingle();
    if (sub && sub.status !== "in_progress") {
      m.submission = sub.id;
      m.state = sub.status;
      continue;
    }
    if (sub && s.state === "in_progress") {
      m.submission = sub.id;
      m.state = "in_progress";
      continue;
    }
    const me = await as(s.candidate);
    const uid = (await me.auth.getUser()).data.user!.id;
    const started = must(await me.rpc("start_assessment", { p_assignment: m.assignment }), `start ${key}`);
    const { data: sub2 } = await admin.from("assessment_submissions").select("id").eq("assignment_id", m.assignment).single();
    const subId = sub2!.id as string;
    void started;
    const qids = manifest.jobs[s.job].questions;
    const job = JOBS.find((j) => j.key === s.job)!;
    // Q1: the option the candidate chose (by its content, not by display position).
    // Candidates cannot read options directly (answer keys are protected), so the id is looked up server-side;
    // the answer itself is still saved by the candidate through save_assessment_answer.
    const { data: opts } = await admin.from("assessment_options").select("id, label_en").eq("question_id", qids[0]);
    const chosen = opts?.find((o) => o.label_en === job.task.questions[0].options![s.mcq].en);
    if (!chosen) throw new Error(`option not found for ${key}`);
    if (chosen) must(await me.rpc("save_assessment_answer", { p_assignment: m.assignment, p_question: qids[0], p_selected: [chosen.id], p_text: null, p_file_path: null }), `q1 ${key}`);
    if (s.state === "submitted") {
      if (s.q2) must(await me.rpc("save_assessment_answer", { p_assignment: m.assignment, p_question: qids[1], p_selected: null, p_text: s.q2, p_file_path: null }), `q2 ${key}`);
      if (s.q3) {
        const name = job.task.questions[2].deliverable!.name;
        const bytes = s.q3.kind === "docx" ? buildDocx(s.q3.lines) : buildXlsx(s.q3.sheets);
        const mime = s.q3.kind === "docx" ? MIME.docx : MIME.xlsx;
        const path = `${uid}/${subId}/${qids[2]}/${name}`;
        const up = await me.storage.from("assessment-attachments").upload(path, bytes, { contentType: mime });
        if (up.error && !/exists/i.test(up.error.message)) throw new Error(`upload ${key}: ${up.error.message}`);
        must(await me.rpc("register_assessment_file", { p_assignment: m.assignment, p_question: qids[2], p_path: path, p_name: name, p_mime: mime, p_size: bytes.length }), `register ${key}`);
        manifest.storage.push(`assessment-attachments/${path}`);
        // Keep a local copy organised by candidate / company / job / question.
        const dir = join(PRIV, "ASSESSMENT-SUBMISSIONS", s.candidate.split("@")[0], job.short, job.key, "question-3");
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, name), bytes);
      }
      if (s.q4) must(await me.rpc("save_assessment_answer", { p_assignment: m.assignment, p_question: qids[3], p_selected: null, p_text: s.q4, p_file_path: null }), `q4 ${key}`);
      must(await me.rpc("submit_assessment", { p_assignment: m.assignment }), `submit ${key}`);
    }
    m.submission = subId;
    m.state = s.state;
    save();
    log(`${s.state} ${key} (${s.quality})`);
  }
}

(async () => {
  for (const p of phases) {
    log(`== ${p}`);
    if (p === "accounts") await accounts();
    if (p === "jobs") await jobs();
    if (p === "apply") await apply();
    if (p === "submit") await submit();
  }
  save();
  log("done");
})().catch((e) => {
  save();
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
