/**
 * Generates supabase/seed/demo_seed.sql — a single idempotent function
 * `public.seed_demo(p_password text)` that inserts the full fictional demo
 * environment. Every record respects the real business rules (status machine,
 * shortlist-before-interview) — verified here before any SQL is emitted.
 *
 *   npx tsx scripts/demo/generate-sql.ts
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { canCreateInterview, canTransition, type ApplicationStatus } from "../../src/lib/domain/application-status";
import { computeMatch } from "../../src/lib/domain/matching";
import { percentage, scoreChoice, scoreShortAnswer } from "../../src/lib/domain/scoring";
import { ASSESSMENTS, OPEN_RUBRIC } from "./data-assessments";
import { COMPANIES, COMPANY_ROLES, JOB_CATEGORIES, ROLES, SALARY_BANDS, SKILL_CATEGORIES, SKILLS } from "./data-core";
import { PLANS, RESOURCES } from "./data-learning";
import { CANDIDATES, DEGREE_BY_ROLE, PAST_EMPLOYERS, STAFF_NAMES, UNIVERSITIES } from "./data-people";

const DEMO_DOMAIN = "jadarah-demo.test";

export function demoId(key: string): string {
  const h = createHash("md5").update(`jadarah-demo:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const q = (v: string | null | undefined) => (v === null || v === undefined ? "null" : `'${v.replace(/'/g, "''")}'`);
const arr = (v: string[]) => (v.length ? `array[${v.map(q).join(",")}]::text[]` : `'{}'::text[]`);
const uarr = (v: string[]) => (v.length ? `array[${v.map(q).join(",")}]::uuid[]` : `'{}'::uuid[]`);
const js = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const ago = (days: number, hours = 0) => `now() - interval '${days} days ${hours} hours'`;
const ahead = (days: number, hours = 10) => `date_trunc('day', now()) + interval '${days} days ${hours} hours'`;

/** Deterministic pseudo-random in [0,1). */
function rnd(seed: string): number {
  return parseInt(createHash("md5").update(seed).digest("hex").slice(0, 8), 16) / 0xffffffff;
}

const out: string[] = [];
const emit = (s: string) => out.push(s);
const skillId = (slug: string) => demoId(`skill:${slug}`);
const skillName = new Map(SKILLS.map(([slug, en, ar]) => [slug, { en, ar }]));
const roleByKey = new Map(ROLES.map((r) => [r.key, r]));
const counts: Record<string, number> = {};
const inc = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);

// ------------------------------------------------------------------ reference data
for (const [slug, en, ar] of SKILL_CATEGORIES)
  emit(`insert into public.skill_categories (id, slug, name_en, name_ar) values (${q(demoId(`skillcat:${slug}`))}, ${q(slug)}, ${q(en)}, ${q(ar)}) on conflict (slug) do nothing;`);
for (const [slug, en, ar, cat, kind] of SKILLS) {
  emit(`insert into public.skills (id, slug, name_en, name_ar, category_id, kind) values (${q(skillId(slug))}, ${q(slug)}, ${q(en)}, ${q(ar)}, ${q(demoId(`skillcat:${cat}`))}, ${q(kind)}) on conflict (slug) do nothing;`);
}
inc("skills", SKILLS.length);
for (const [slug, en, ar] of JOB_CATEGORIES)
  emit(`insert into public.job_categories (id, slug, name_en, name_ar) values (${q(demoId(`jobcat:${slug}`))}, ${q(slug)}, ${q(en)}, ${q(ar)}) on conflict (slug) do nothing;`);

for (const r of RESOURCES) {
  const [slug, en, ar, provider, url, kind, topic, skills, level, hours, free] = r;
  emit(`insert into public.learning_resources (id, slug, title_en, title_ar, provider, url, kind, topic, skill_slugs, level, duration_hours, is_free) values (${q(demoId(`res:${slug}`))}, ${q(slug)}, ${q(en)}, ${q(ar)}, ${q(provider)}, ${q(url)}, ${q(kind)}, ${q(topic)}, ${arr(skills)}, ${q(level)}, ${hours}, ${free}) on conflict (slug) do nothing;`);
}
inc("learning_resources", RESOURCES.length);

// ------------------------------------------------------------------ users
const users: { key: string; email: string; name: string; type: "candidate" | "company" | "admin" }[] = [];
users.push({ key: "admin", email: `platform.admin@${DEMO_DOMAIN}`, name: "مسؤول منصة جدارة (تجريبي)", type: "admin" });
for (const c of COMPANIES) {
  const [adminName, recName, intName] = STAFF_NAMES[c.key];
  users.push({ key: `${c.key}:admin`, email: `admin.${c.key}@${DEMO_DOMAIN}`, name: adminName, type: "company" });
  if (c.status === "approved") {
    users.push({ key: `${c.key}:recruiter`, email: `recruiter.${c.key}@${DEMO_DOMAIN}`, name: recName, type: "company" });
    users.push({ key: `${c.key}:interviewer`, email: `interviewer.${c.key}@${DEMO_DOMAIN}`, name: intName, type: "company" });
  }
}
CANDIDATES.forEach(([name], i) => users.push({ key: `cand:${i}`, email: `candidate${String(i + 1).padStart(2, "0")}@${DEMO_DOMAIN}`, name, type: "candidate" }));
const uid = (key: string) => demoId(`user:${key}`);
for (const u of users) emit(`perform public._demo_user(${q(uid(u.key))}, ${q(u.email)}, p_password, ${q(u.name)}, ${q(u.type)});`);
inc("auth_users", users.length);
emit(`delete from public.user_roles where user_id = ${q(uid("admin"))} and role = 'candidate';`);
emit(`insert into public.user_roles (user_id, role) values (${q(uid("admin"))}, 'super_admin') on conflict do nothing;`);
emit(`update public.profiles set account_type = 'admin', onboarding_completed = true where id = ${q(uid("admin"))};`);

// ------------------------------------------------------------------ companies
for (const c of COMPANIES) {
  const cid = demoId(`company:${c.key}`);
  emit(`insert into public.company_profiles (id, slug, name_en, name_ar, industry, website, size_range, city, description_en, description_ar, contact_email, status, approved_at, approved_by, created_by, is_demo, created_at)
    values (${q(cid)}, ${q(c.slug)}, ${q(c.name_en)}, ${q(c.name_ar)}, ${q(c.industry)}, null, ${q(c.size)}, ${q(c.city)}, ${q(c.description_en)}, ${q(c.description_ar)}, ${q(`talent.${c.key}@${DEMO_DOMAIN}`)}, ${q(c.status)}, ${c.status === "approved" ? ago(80) : "null"}, ${c.status === "approved" ? q(uid("admin")) : "null"}, ${q(uid(`${c.key}:admin`))}, true, ${ago(90)}) on conflict (id) do nothing;`);
  emit(`insert into public.company_memberships (company_id, user_id, role) values (${q(cid)}, ${q(uid(`${c.key}:admin`))}, 'company_admin') on conflict do nothing;`);
  emit(`update public.profiles set onboarding_completed = true where id = ${q(uid(`${c.key}:admin`))};`);
  if (c.status === "approved") {
    emit(`insert into public.company_memberships (company_id, user_id, role) values (${q(cid)}, ${q(uid(`${c.key}:recruiter`))}, 'recruiter'), (${q(cid)}, ${q(uid(`${c.key}:interviewer`))}, 'interviewer') on conflict do nothing;`);
    emit(`update public.profiles set onboarding_completed = true where id in (${q(uid(`${c.key}:recruiter`))}, ${q(uid(`${c.key}:interviewer`))});`);
  }
  emit(`insert into public.company_verification_requests (id, company_id, submitted_by, status, commercial_registration, notes, reviewer_id, reviewed_at, created_at)
    values (${q(demoId(`verif:${c.key}`))}, ${q(cid)}, ${q(uid(`${c.key}:admin`))}, ${q(c.status === "approved" ? "approved" : "pending")}, ${q(`DEMO-CR-${1010000000 + COMPANIES.indexOf(c)}`)}, 'Fictional demo registration — no real documents.', ${c.status === "approved" ? q(uid("admin")) : "null"}, ${c.status === "approved" ? ago(80) : "null"}, ${ago(88)}) on conflict (id) do nothing;`);
  if (c.status === "approved")
    emit(`insert into public.audit_logs (id, actor_id, action, entity_type, entity_id, company_id, metadata, created_at) values (${q(demoId(`audit:approve:${c.key}`))}, ${q(uid("admin"))}, 'company.approve', 'company', ${q(cid)}, ${q(cid)}, '{"source":"demo-seed"}', ${ago(80)}) on conflict (id) do nothing;`);
}
inc("companies", COMPANIES.length);

// ------------------------------------------------------------------ assessments (platform library)
const assessmentMeta = new Map<string, { id: string; questions: { id: string; def: (typeof ASSESSMENTS)[number]["q"][number]; options: { id: string; correct: boolean }[] }[] }>();
for (const a of ASSESSMENTS) {
  const aid = demoId(`assessment:${a.slug}`);
  const rid = demoId(`rubric:${a.slug}`);
  const sid = demoId(`section:${a.slug}`);
  emit(`insert into public.assessments (id, company_id, slug, title_en, title_ar, description_en, description_ar, category, difficulty, duration_minutes, passing_score, learning_outcomes_en, learning_outcomes_ar, status, created_by)
    values (${q(aid)}, null, ${q(a.slug)}, ${q(a.title_en)}, ${q(a.title_ar)}, ${q(a.desc_en)}, ${q(a.desc_ar)}, ${q(a.category)}, ${q(a.difficulty)}, ${a.minutes}, 60, ${arr(a.outcomes_en)}, ${arr(a.outcomes_ar)}, 'published', ${q(uid("admin"))}) on conflict (id) do nothing;`);
  emit(`insert into public.assessment_templates (assessment_id, tags, is_featured) values (${q(aid)}, ${arr([a.category, a.difficulty])}, ${ASSESSMENTS.indexOf(a) < 5}) on conflict (assessment_id) do nothing;`);
  emit(`insert into public.assessment_sections (id, assessment_id, title_en, title_ar, position) values (${q(sid)}, ${q(aid)}, 'Core', 'الأساسيات', 0) on conflict (id) do nothing;`);
  emit(`insert into public.assessment_rubrics (id, assessment_id, title_en, title_ar, criteria) values (${q(rid)}, ${q(aid)}, 'Open response rubric', 'معايير الإجابات المفتوحة', ${js(OPEN_RUBRIC)}) on conflict (id) do nothing;`);
  const qs: { id: string; def: (typeof a.q)[number]; options: { id: string; correct: boolean }[] }[] = [];
  a.q.forEach((qq, qi) => {
    const qid = demoId(`question:${a.slug}:${qi}`);
    const config = qq.t === "short_answer" ? { accepted_answers: qq.accepted } : "config" in qq && qq.config ? qq.config : {};
    const isOpen = "rubric" in qq;
    const why_en = "why_en" in qq ? qq.why_en : null;
    const why_ar = "why_ar" in qq ? qq.why_ar : null;
    emit(`insert into public.assessment_questions (id, assessment_id, section_id, type, prompt_en, prompt_ar, points, position, config, rubric_id, explanation_en, explanation_ar)
      values (${q(qid)}, ${q(aid)}, ${q(sid)}, ${q(qq.t)}, ${q(qq.en)}, ${q(qq.ar)}, ${qq.pts}, ${qi}, ${js(config)}, ${isOpen ? q(rid) : "null"}, ${q(why_en ?? null)}, ${q(why_ar ?? null)}) on conflict (id) do nothing;`);
    const options: { id: string; correct: boolean }[] = [];
    if ("opts" in qq) {
      qq.opts.forEach(([en, ar, correct], oi) => {
        const oid = demoId(`option:${a.slug}:${qi}:${oi}`);
        options.push({ id: oid, correct });
        emit(`insert into public.assessment_options (id, question_id, label_en, label_ar, is_correct, position) values (${q(oid)}, ${q(qid)}, ${q(en)}, ${q(ar)}, ${correct}, ${oi}) on conflict (id) do nothing;`);
      });
    }
    qs.push({ id: qid, def: qq, options });
  });
  assessmentMeta.set(a.slug, { id: aid, questions: qs });
}
inc("assessments", ASSESSMENTS.length);

// ------------------------------------------------------------------ jobs
interface JobRec { id: string; company: string; role: (typeof ROLES)[number]; status: string }
const jobs: JobRec[] = [];
for (const c of COMPANIES) {
  COMPANY_ROLES[c.key].forEach((spec, i) => {
    const role = roleByKey.get(spec.role);
    if (!role) throw new Error(`unknown role ${spec.role}`);
    const jid = demoId(`job:${c.key}:${i}`);
    const status = c.status === "approved" ? spec.status : "draft";
    const [smin, smax] = SALARY_BANDS[role.level];
    const descEn = `${c.name_en} is looking for a ${role.title_en} to ${role.summary_en}. You will join a team that values evidence over credentials and invests in your growth.`;
    const descAr = `تبحث ${c.name_ar} عن ${role.title_ar} من أجل ${role.summary_ar}. ستنضم إلى فريق يقدّر الأدلة على المؤهلات الشكلية ويستثمر في نموّك.`;
    const deadlineDays = status === "closed" ? -10 : 20 + Math.round(rnd(jid) * 40);
    const asm = role.assessment ? assessmentMeta.get(role.assessment)?.id : null;
    emit(`insert into public.jobs (id, company_id, category_id, title_en, title_ar, description_en, description_ar, responsibilities_en, responsibilities_ar, qualifications_en, qualifications_ar, experience_level, min_years, city, work_mode, employment_type, salary_min, salary_max, salary_visible, education_level, openings, deadline, status, published_at, assessment_id, created_by, created_at)
      values (${q(jid)}, ${q(demoId(`company:${c.key}`))}, ${q(demoId(`jobcat:${role.category}`))}, ${q(role.title_en)}, ${q(role.title_ar)}, ${q(descEn)}, ${q(descAr)}, ${arr(role.responsibilities_en)}, ${arr(role.responsibilities_ar)}, ${arr(role.qualifications_en)}, ${arr(role.qualifications_ar)}, ${q(role.level)}, ${role.min_years}, ${q(c.city)}, ${q(spec.mode)}, ${q(role.key === "junior-dev" && i % 2 ? "internship" : "full_time")}, ${smin}, ${smax}, ${rnd(jid + "s") > 0.4}, 'Bachelor', ${1 + Math.floor(rnd(jid + "o") * 3)}, (current_date + ${deadlineDays}), 'draft', null, ${asm ? q(asm) : "null"}, ${q(uid(`${c.key}:admin`))}, ${ago(60 - i * 3)}) on conflict (id) do nothing;`);
    // publish through the trigger-checked path (approved company required)
    if (status !== "draft") emit(`update public.jobs set status = 'published', published_at = coalesce(published_at, ${ago(55 - i * 3)}) where id = ${q(jid)} and status = 'draft';`);
    if (status === "closed" || status === "paused") emit(`update public.jobs set status = ${q(status)} where id = ${q(jid)} and status = 'published';`);
    for (const [slug, lvl] of role.required)
      emit(`insert into public.job_skills (job_id, skill_id, importance, min_level) values (${q(jid)}, ${q(skillId(slug))}, 'required', ${lvl}) on conflict do nothing;`);
    for (const [slug, lvl] of role.preferred)
      emit(`insert into public.job_skills (job_id, skill_id, importance, min_level) values (${q(jid)}, ${q(skillId(slug))}, 'preferred', ${lvl}) on conflict do nothing;`);
    emit(`insert into public.job_requirements (id, job_id, kind, text_en, text_ar, is_mandatory, position) values (${q(demoId(`jobreq:${jid}`))}, ${q(jid)}, 'experience', ${q(role.min_years ? `At least ${role.min_years} year(s) of relevant experience` : "No prior experience required")}, ${q(role.min_years ? `خبرة ذات صلة لا تقل عن ${role.min_years} سنة` : "لا تُشترط خبرة سابقة")}, ${role.min_years > 0}, 0) on conflict (id) do nothing;`);
    emit(`insert into public.job_application_questions (id, job_id, question_en, question_ar, is_required, position) values (${q(demoId(`jobq:${jid}`))}, ${q(jid)}, 'Tell us about a project that shows what you can do.', 'حدّثنا عن مشروع يُظهر ما تستطيع فعله.', false, 0) on conflict (id) do nothing;`);
    jobs.push({ id: jid, company: c.key, role, status });
  });
}
inc("jobs", jobs.length);

// ------------------------------------------------------------------ candidates
interface CandSkill { slug: string; level: number; source: "self" | "cv" | "assessment" | "verified"; evidence: string | null }
const candSkills = new Map<number, CandSkill[]>();
CANDIDATES.forEach(([name, roleKey, years, city], i) => {
  const id = uid(`cand:${i}`);
  const role = roleByKey.get(roleKey)!;
  const [uniEn] = UNIVERSITIES[i % UNIVERSITIES.length];
  const degree = DEGREE_BY_ROLE[roleKey];
  const level = years === 0 ? "entry" : years < 2 ? "junior" : years < 5 ? "mid" : "senior";
  const headlineEn = years === 0 ? `Graduate · aspiring ${role.title_en}` : `${role.title_en} · ${years} yrs`;
  const summary = `${role.title_en} focused on ${role.summary_en}. ${years ? `${years} years of hands-on experience` : "Recent graduate with strong project work"}; looking for a team that values evidence and growth.`;
  emit(`insert into public.candidate_profiles (user_id, headline, summary, city, years_experience, experience_level, open_to_work, visibility, career_interests, languages, achievements)
    values (${q(id)}, ${q(headlineEn)}, ${q(summary)}, ${q(city)}, ${years}, ${q(level)}, true, 'companies', ${arr([role.title_en, role.category])}, ${js([{ name: "Arabic", level: "native" }, { name: "English", level: i % 3 === 0 ? "fluent" : "professional" }])}, ${arr(years > 2 ? ["Led a cross-team delivery recognised by leadership"] : ["Graduation project with distinction"])}) on conflict (user_id) do nothing;`);
  emit(`update public.profiles set onboarding_completed = true, is_demo = true where id = ${q(id)};`);
  const gradYear = 2026 - years - (years ? 0 : 0);
  emit(`insert into public.candidate_education (id, candidate_id, institution, degree, field, start_date, end_date, grade) values (${q(demoId(`edu:${i}`))}, ${q(id)}, ${q(uniEn)}, ${q(degree)}, ${q(degree.replace(/^[BM]\.\w+\.? /, ""))}, ${q(`${gradYear - 4}-09-01`)}, ${q(`${gradYear}-06-15`)}, ${q(i % 4 === 0 ? "First class honours" : "Very good")}) on conflict (id) do nothing;`);
  if (years > 0) {
    const emp = PAST_EMPLOYERS[i % PAST_EMPLOYERS.length];
    emit(`insert into public.candidate_experience (id, candidate_id, title, company, location, start_date, end_date, is_current, description) values (${q(demoId(`exp:${i}`))}, ${q(id)}, ${q(role.title_en)}, ${q(emp)}, ${q(city)}, ${q(`${2026 - years}-02-01`)}, null, true, ${q(`${role.responsibilities_en[0]}. ${role.responsibilities_en[1]}.`)}) on conflict (id) do nothing;`);
  } else {
    emit(`insert into public.candidate_experience (id, candidate_id, title, company, location, start_date, end_date, is_current, description) values (${q(demoId(`exp:${i}`))}, ${q(id)}, ${q(`${role.title_en} Intern`)}, ${q(PAST_EMPLOYERS[(i + 3) % PAST_EMPLOYERS.length])}, ${q(city)}, '2025-06-01', '2025-08-31', false, 'Summer internship delivering a scoped feature with mentor review.') on conflict (id) do nothing;`);
  }
  // skills: required + preferred with deterministic variance; some gaps for realism
  const skills: CandSkill[] = [];
  [...role.required, ...role.preferred].forEach(([slug, minLvl], k) => {
    const r = rnd(`${i}:${slug}`);
    if (r < 0.12 && k > 1) return; // genuine gap
    const lvl = Math.max(1, Math.min(5, minLvl + (r < 0.3 ? -1 : r > 0.75 ? 1 : 0) + (years >= 4 ? 1 : 0) - (years === 0 ? 1 : 0)));
    const src: CandSkill["source"] = r < 0.25 ? "self" : r < 0.8 ? "cv" : "assessment";
    const ev = src === "self" ? null : src === "cv" ? `Listed in CV with project usage (${role.title_en})` : `Demonstrated in a JADARAH assessment`;
    skills.push({ slug, level: lvl, source: src, evidence: ev });
  });
  for (const extra of ["communication", "problem-solving", "git"]) {
    if (skills.some((s) => s.slug === extra)) continue;
    if (rnd(`${i}:x:${extra}`) < 0.6) skills.push({ slug: extra, level: 3, source: "self", evidence: null });
  }
  candSkills.set(i, skills);
  for (const s of skills)
    emit(`insert into public.candidate_skills (candidate_id, skill_id, level, source, evidence, years) values (${q(id)}, ${q(skillId(s.slug))}, ${s.level}, ${q(s.source)}, ${q(s.evidence)}, ${Math.min(years, s.level)}) on conflict do nothing;`);
  emit(`insert into public.candidate_projects (id, candidate_id, title, description, skills) values (${q(demoId(`proj:${i}`))}, ${q(id)}, ${q(`${role.title_en} portfolio project`)}, ${q(`A practical project applying ${role.required.map(([s]) => skillName.get(s)!.en).join(", ")} to a real-world problem.`)}, ${arr(role.required.map(([s]) => s))}) on conflict (id) do nothing;`);
  if (i % 3 === 0)
    emit(`insert into public.candidate_certifications (id, candidate_id, name, issuer, issue_date) values (${q(demoId(`cert:${i}`))}, ${q(id)}, ${q(`${skillName.get(role.required[0][0])!.en} Practitioner (demo)`)}, 'Demo Certification Body', '2025-11-01') on conflict (id) do nothing;`);
  emit(`insert into public.candidate_preferences (candidate_id, desired_roles, desired_locations, employment_types, work_modes) values (${q(id)}, ${arr([role.title_en])}, ${arr([city])}, '{full_time}', '{hybrid,onsite}') on conflict do nothing;`);
});
inc("candidates", CANDIDATES.length);

// ------------------------------------------------------------------ applications & pipeline
type Path = ApplicationStatus[];
const PATHS: Path[] = [
  ["submitted"],
  ["submitted", "under_review"],
  ["submitted", "under_review", "assessment_pending"],
  ["submitted", "under_review", "assessment_pending", "assessment_completed"],
  ["submitted", "under_review", "assessment_pending", "assessment_completed", "shortlisted"],
  ["submitted", "under_review", "assessment_pending", "assessment_completed", "shortlisted", "interview_scheduled"],
  ["submitted", "under_review", "assessment_pending", "assessment_completed", "shortlisted", "interview_scheduled", "interview_completed"],
  ["submitted", "under_review", "assessment_pending", "assessment_completed", "shortlisted", "interview_scheduled", "interview_completed", "hired"],
  ["submitted", "under_review", "rejected"],
  ["submitted", "under_review", "assessment_pending", "assessment_completed", "rejected"],
  ["submitted", "withdrawn"],
  ["submitted", "under_review", "hired"], // company hires without shortlisting — allowed by the rules
];
for (const p of PATHS) for (let k = 1; k < p.length; k++) if (!canTransition(p[k - 1], p[k])) throw new Error(`invalid demo path ${p.join(">")}`);

const openJobs = jobs.filter((j) => j.status === "published" || j.status === "closed" || j.status === "paused");
let appCount = 0;
let interviewCount = 0;
let submissionCount = 0;
let hiredWithoutShortlist = 0;
CANDIDATES.forEach(([, roleKey, years], i) => {
  const cid = uid(`cand:${i}`);
  const matches = openJobs.filter((j) => j.role.key === roleKey);
  const adjacent = openJobs.filter((j) => j.role.category === roleByKey.get(roleKey)!.category && j.role.key !== roleKey);
  const targets = [...matches.slice(0, 2), ...adjacent.slice(i % 2, (i % 2) + 1)].slice(0, 3);
  targets.forEach((job, t) => {
    const appId = demoId(`app:${i}:${job.id}`);
    let path = PATHS[Math.floor(rnd(appId) * PATHS.length)];
    if (path[path.length - 1] === "hired" && path.includes("shortlisted") === false) {
      if (hiredWithoutShortlist >= 1) path = PATHS[1];
      else hiredWithoutShortlist++;
    }
    if (job.status === "closed" && !["hired", "rejected", "withdrawn"].includes(path[path.length - 1])) path = PATHS[8];
    const final = path[path.length - 1];
    const wasShortlisted = path.includes("shortlisted");
    const startDays = 40 - t * 6 - Math.floor(rnd(appId + "d") * 8);
    const job_skills = [...job.role.required.map(([s, l]) => ({ s, l, imp: "required" as const })), ...job.role.preferred.map(([s, l]) => ({ s, l, imp: "preferred" as const }))];
    const match = computeMatch(
      job_skills.map((x) => ({ skill_id: skillId(x.s), name: skillName.get(x.s)!.en, importance: x.imp, min_level: x.l })),
      candSkills.get(i)!.map((s) => ({ skill_id: skillId(s.slug), level: s.level, source: s.source, evidence: s.evidence })),
      { required: job.role.min_years, candidate: years },
    );
    emit(`insert into public.applications (id, job_id, company_id, candidate_id, status, cover_letter, match_score, match_breakdown, was_shortlisted, submitted_at, decided_at)
      values (${q(appId)}, ${q(job.id)}, ${q(demoId(`company:${job.company}`))}, ${q(cid)}, ${q(path.includes("interview_scheduled") ? "interview_scheduled" : final)}, ${q("I'm excited by the chance to contribute and to show my work through your assessment.")}, ${match.score}, ${js(match)}, ${wasShortlisted}, ${ago(startDays)}, ${["hired", "rejected", "withdrawn"].includes(final) ? ago(Math.max(1, startDays - path.length * 3)) : "null"}) on conflict (id) do nothing;`);
    emit(`insert into public.application_answers (application_id, question_id, answer) values (${q(appId)}, ${q(demoId(`jobq:${job.id}`))}, ${q(`I built a ${job.role.title_en.toLowerCase()} project end to end and documented the trade-offs.`)}) on conflict do nothing;`);
    const recruiter = uid(`${job.company}:recruiter`);
    path.forEach((st, k) => {
      const reason = st === "rejected" ? "Other candidates showed stronger evidence for required skills." : st === "hired" && !wasShortlisted ? "Exceptional referral and portfolio; hired directly by the hiring manager." : null;
      const msg = st === "rejected" ? "Thank you for applying. We were impressed by your projects; we encourage you to strengthen the required skills listed in the job and apply again." : st === "hired" ? "Congratulations! Our team will contact you with the offer details." : null;
      emit(`insert into public.application_status_history (id, application_id, from_status, to_status, changed_by, reason, candidate_message, created_at) values (${q(demoId(`hist:${appId}:${k}`))}, ${q(appId)}, ${k ? q(path[k - 1]) : "null"}, ${q(st)}, ${q(k === 0 ? cid : st === "withdrawn" ? cid : recruiter)}, ${q(reason)}, ${q(msg)}, ${ago(Math.max(0, startDays - k * 3))}) on conflict (id) do nothing;`);
    });
    emit(`insert into public.notifications (id, user_id, kind, title_en, title_ar, body_en, body_ar, link, created_at, read_at) values (${q(demoId(`notif:${appId}`))}, ${q(cid)}, 'application_status', ${q(`Application update: ${job.role.title_en}`)}, ${q(`تحديث على طلبك: ${job.role.title_ar}`)}, ${q(`Status: ${final.replace(/_/g, " ")}`)}, ${q(`الحالة: ${final}`)}, ${q(`/candidate/applications/${appId}`)}, ${ago(Math.max(0, startDays - path.length * 3))}, ${rnd(appId + "r") > 0.5 ? "now()" : "null"}) on conflict (id) do nothing;`);
    if (wasShortlisted)
      emit(`insert into public.application_notes (id, application_id, author_id, body, created_at) values (${q(demoId(`note:${appId}`))}, ${q(appId)}, ${q(recruiter)}, 'INTERNAL: strong practical evidence; verify depth on system trade-offs in interview.', ${ago(Math.max(0, startDays - 12))}) on conflict (id) do nothing;`);

    // assessment
    const asm = job.role.assessment ? assessmentMeta.get(job.role.assessment) : undefined;
    if (asm && path.includes("assessment_pending")) {
      const asgId = demoId(`asg:${appId}`);
      const completed = path.includes("assessment_completed");
      emit(`insert into public.assessment_assignments (id, assessment_id, application_id, candidate_id, company_id, assigned_by, status, due_at, started_at, submitted_at, created_at)
        values (${q(asgId)}, ${q(asm.id)}, ${q(appId)}, ${q(cid)}, ${q(demoId(`company:${job.company}`))}, ${q(recruiter)}, ${q(completed ? "evaluated" : "assigned")}, ${completed ? ago(startDays - 10) : ahead(7)}, ${completed ? ago(startDays - 6) : "null"}, ${completed ? ago(startDays - 6) : "null"}, ${ago(startDays - 4)}) on conflict (id) do nothing;`);
      if (completed) {
        const subId = demoId(`sub:${appId}`);
        let auto = 0;
        let manual = 0;
        let max = 0;
        const answers: string[] = [];
        const evals: string[] = [];
        asm.questions.forEach((qq, qi) => {
          max += qq.def.pts;
          const r = rnd(`${appId}:${qi}`);
          const ansId = demoId(`ans:${subId}:${qi}`);
          if ("opts" in qq.def) {
            const correctIds = qq.options.filter((o) => o.correct).map((o) => o.id);
            const wrongIds = qq.options.filter((o) => !o.correct).map((o) => o.id);
            const chosen = r < 0.72 ? correctIds : qq.def.t === "multiple_select" ? [correctIds[0], wrongIds[0]].filter(Boolean) : [wrongIds[0]];
            const pts = scoreChoice(qq.def.t as "multiple_choice", chosen, correctIds, qq.def.pts);
            auto += pts;
            answers.push(`(${q(ansId)}, ${q(subId)}, ${q(qq.id)}, ${uarr(chosen)}, null, ${pts === qq.def.pts}, ${pts})`);
          } else if (qq.def.t === "short_answer") {
            const text = r < 0.7 ? qq.def.accepted[0] : "not sure";
            const pts = scoreShortAnswer(text, qq.def.accepted, qq.def.pts);
            auto += pts;
            answers.push(`(${q(ansId)}, ${q(subId)}, ${q(qq.id)}, '{}'::uuid[], ${q(text)}, ${pts > 0}, ${pts})`);
          } else {
            const pts = Math.round(qq.def.pts * (0.55 + r * 0.4));
            manual += pts;
            answers.push(`(${q(ansId)}, ${q(subId)}, ${q(qq.id)}, '{}'::uuid[], ${q("My approach: clarify the goal and constraints, outline two options with trade-offs, choose one, and describe how I would test and monitor it.")}, null, ${pts})`);
            evals.push(`(${q(demoId(`eval:${subId}:${qi}`))}, ${q(subId)}, ${q(qq.id)}, ${q(recruiter)}, ${js({ correctness: Math.min(4, Math.round(pts * 0.4)), reasoning: 2, clarity: 2 })}, ${pts}, 'Clear structure; would like deeper discussion of edge cases.')`);
          }
        });
        const pct = percentage(auto + manual, max);
        emit(`insert into public.assessment_submissions (id, assignment_id, candidate_id, status, auto_score, manual_score, max_score, percentage, needs_review, candidate_feedback, feedback_shared, started_at, submitted_at, evaluated_at)
          values (${q(subId)}, ${q(asgId)}, ${q(cid)}, 'evaluated', ${auto}, ${manual}, ${max}, ${pct}, false, ${rnd(subId) > 0.5 ? q("Strong fundamentals. Practise explaining trade-offs explicitly in open answers.") : "null"}, ${rnd(subId) > 0.5}, ${ago(startDays - 6, 1)}, ${ago(startDays - 6)}, ${ago(startDays - 7)}) on conflict (id) do nothing;`);
        emit(`insert into public.assessment_answers (id, submission_id, question_id, selected_option_ids, text_answer, is_correct, points_awarded) values ${answers.join(", ")} on conflict do nothing;`);
        if (evals.length) emit(`insert into public.assessment_evaluations (id, submission_id, question_id, evaluator_id, rubric_scores, points, comments) values ${evals.join(", ")} on conflict do nothing;`);
        submissionCount++;
      }
    }

    // interviews — only ever for shortlisted applications (rule check below)
    if (path.includes("interview_scheduled")) {
      if (!canCreateInterview({ status: "interview_scheduled", was_shortlisted: wasShortlisted })) throw new Error("demo interview without shortlist");
      const done = path.includes("interview_completed");
      const ivId = demoId(`iv:${appId}`);
      const interviewer = uid(`${job.company}:interviewer`);
      // status is set to scheduled first so the shortlist trigger sees a valid application state
      emit(`insert into public.interviews (id, application_id, company_id, title, type, status, scheduled_at, duration_minutes, timezone, location, meeting_url, instructions, created_by)
        values (${q(ivId)}, ${q(appId)}, ${q(demoId(`company:${job.company}`))}, ${q(`${job.role.title_en} — technical interview`)}, ${q(t % 2 ? "technical" : "video")}, ${q(done ? "completed" : "scheduled")}, ${done ? ago(Math.max(1, startDays - 18)) : ahead(3 + (i % 9))}, 45, 'Asia/Riyadh', null, ${q("https://meet.example.com/jadarah-demo")}, 'Please prepare to walk through one project in depth.', ${q(recruiter)}) on conflict (id) do nothing;`);
      emit(`insert into public.interview_participants (interview_id, user_id, role) values (${q(ivId)}, ${q(interviewer)}, 'interviewer') on conflict do nothing;`);
      emit(`insert into public.interview_questions (interview_id, question, kind, position) values (${q(ivId)}, ${q(`Walk us through a ${job.role.title_en.toLowerCase()} decision you would make differently today.`)}, 'technical', 0), (${q(ivId)}, 'Tell us about a time you received difficult feedback.', 'behavioral', 1);`);
      if (done) {
        emit(`insert into public.interview_evaluations (interview_id, interviewer_id, ratings, recommendation, strengths, concerns, comments) values (${q(ivId)}, ${q(interviewer)}, ${js({ technical: 4, problem_solving: 4, communication: 3 + (i % 2), culture: 4 })}, ${q(final === "hired" ? "strong_yes" : "yes")}, 'Structured thinking; clear examples.', 'Limited exposure to large-scale systems.', 'CONFIDENTIAL — internal evaluation.') on conflict do nothing;`);
        emit(`insert into public.interview_feedback (id, interview_id, application_id, author_id, body, shared_with_candidate, shared_at) values (${q(demoId(`ivfb:${ivId}`))}, ${q(ivId)}, ${q(appId)}, ${q(recruiter)}, 'You communicated your project decisions clearly. Deepening your experience with production monitoring will strengthen future interviews.', ${final === "hired" || rnd(ivId) > 0.5}, ${final === "hired" || rnd(ivId) > 0.5 ? "now()" : "null"}) on conflict (id) do nothing;`);
      }
      // advance through the remaining stages with validated UPDATEs (trigger-checked)
      for (const st of path.slice(path.indexOf("interview_scheduled") + 1))
        emit(`update public.applications set status = ${q(st)} where id = ${q(appId)} and status <> ${q(st)};`);
      interviewCount++;
    }
    appCount++;
  });
});
inc("applications", appCount);
inc("interviews", interviewCount);
inc("assessment_submissions", submissionCount);

// ------------------------------------------------------------------ development plans
for (const p of PLANS) {
  const pid = demoId(`plan:${p.role_slug}`);
  emit(`insert into public.development_plans (id, candidate_id, is_template, role_slug, title_en, title_ar, description_en, description_ar, target_level, required_skill_slugs, estimated_weeks) values (${q(pid)}, null, true, ${q(p.role_slug)}, ${q(p.title_en)}, ${q(p.title_ar)}, ${q(p.desc_en)}, ${q(p.desc_ar)}, ${q(p.target)}, ${arr(p.skills)}, ${p.weeks}) on conflict (id) do nothing;`);
  p.items.forEach(([en, ar, skill, res, hours], k) =>
    emit(`insert into public.development_plan_items (id, plan_id, title_en, title_ar, skill_slug, kind, resource_id, position, estimated_hours) values (${q(demoId(`planitem:${p.role_slug}:${k}`))}, ${q(pid)}, ${q(en)}, ${q(ar)}, ${q(skill)}, ${res ? "'activity'" : "'milestone'"}, ${res ? q(demoId(`res:${res}`)) : "null"}, ${k}, ${hours}) on conflict (id) do nothing;`),
  );
}
inc("development_plan_templates", PLANS.length);

// personal plans for the first 12 candidates
const ROLE_TO_PLAN: Record<string, string> = {
  "data-analyst": "junior-data-analyst", fullstack: "full-stack-developer", "junior-dev": "full-stack-developer", backend: "full-stack-developer",
  "ux-designer": "ui-ux-designer", "soc-analyst": "cybersecurity-analyst", "ai-engineer": "ai-engineer", "cloud-engineer": "cloud-engineer",
  "business-analyst": "business-analyst", "data-engineer": "data-engineer", "data-scientist": "machine-learning-engineer", appsec: "cybersecurity-analyst",
  "product-manager": "product-manager", "ml-engineer": "machine-learning-engineer", "pm-delivery": "product-manager",
};
CANDIDATES.slice(0, 12).forEach(([, roleKey], i) => {
  const plan = PLANS.find((p) => p.role_slug === ROLE_TO_PLAN[roleKey])!;
  const cid = uid(`cand:${i}`);
  const goalId = demoId(`goal:${i}`);
  const pid = demoId(`myplan:${i}`);
  emit(`insert into public.career_goals (id, candidate_id, target_role_slug, target_role_en, target_role_ar, target_level, target_date) values (${q(goalId)}, ${q(cid)}, ${q(plan.role_slug)}, ${q(plan.title_en)}, ${q(plan.title_ar)}, ${q(plan.target)}, current_date + ${plan.weeks * 7}) on conflict (id) do nothing;`);
  const skills = candSkills.get(i)!;
  const map = new Map(skills.map((s) => [s.slug, s]));
  const analysis = {
    strong: plan.skills.filter((s) => (map.get(s)?.level ?? 0) >= 4),
    developing: plan.skills.filter((s) => map.has(s) && (map.get(s)!.level < 4)),
    missing: plan.skills.filter((s) => !map.has(s)),
    coverage: Math.round((plan.skills.filter((s) => (map.get(s)?.level ?? 0) >= 3).length / plan.skills.length) * 100) / 100,
  };
  emit(`insert into public.skill_gap_analyses (id, candidate_id, goal_id, method, provider, analysis) values (${q(demoId(`gap:${i}`))}, ${q(cid)}, ${q(goalId)}, 'rule_based', 'rule_based', ${js(analysis)}) on conflict (id) do nothing;`);
  emit(`insert into public.development_plans (id, candidate_id, goal_id, is_template, role_slug, title_en, title_ar, description_en, description_ar, target_level, required_skill_slugs, estimated_weeks) values (${q(pid)}, ${q(cid)}, ${q(goalId)}, false, ${q(plan.role_slug)}, ${q(plan.title_en)}, ${q(plan.title_ar)}, ${q(plan.desc_en)}, ${q(plan.desc_ar)}, ${q(plan.target)}, ${arr(plan.skills)}, ${plan.weeks}) on conflict (id) do nothing;`);
  plan.items.forEach(([en, ar, skill, res, hours], k) => {
    const st = k < i % 4 ? "completed" : k === i % 4 ? "in_progress" : "not_started";
    emit(`insert into public.development_plan_items (id, plan_id, title_en, title_ar, skill_slug, kind, resource_id, position, estimated_hours, status, completed_at) values (${q(demoId(`myplanitem:${i}:${k}`))}, ${q(pid)}, ${q(en)}, ${q(ar)}, ${q(skill)}, ${res ? "'activity'" : "'milestone'"}, ${res ? q(demoId(`res:${res}`)) : "null"}, ${k}, ${hours}, ${q(st)}, ${st === "completed" ? ago(20 - k * 3) : "null"}) on conflict (id) do nothing;`);
    if (res && st !== "not_started")
      emit(`insert into public.learning_progress (candidate_id, resource_id, status, progress_percent) values (${q(cid)}, ${q(demoId(`res:${res}`))}, ${q(st)}, ${st === "completed" ? 100 : 40}) on conflict do nothing;`);
  });
});
inc("personal_development_plans", 12);

// ------------------------------------------------------------------ write file
const header = `-- GENERATED by scripts/demo/generate-sql.ts — do not edit by hand.
-- JADARAH demo environment. All companies and people are FICTIONAL.
-- Usage (privileged connection only):  select public.seed_demo('<DEMO_USER_PASSWORD>');
-- Counts: ${JSON.stringify(counts)}

create or replace function public._demo_user(p_id uuid, p_email text, p_password text, p_name text, p_type text)
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_name, 'account_type', case when p_type = 'admin' then 'candidate' else p_type end, 'locale', 'ar'),
    now() - interval '95 days', now(), '', '', '', '', '', '', '', '')
  on conflict (id) do nothing;
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text, jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true), 'email', null, now(), now())
  on conflict do nothing;
  update public.profiles set is_demo = true, full_name = p_name where id = p_id;
end $fn$;
revoke execute on function public._demo_user(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function public.seed_demo(p_password text)
returns jsonb language plpgsql security definer set search_path = '' as $seed$
declare v_env text;
begin
  select value #>> '{}' into v_env from public.platform_settings where key = 'environment';
  if v_env = 'production' then
    raise exception 'refusing to seed demo data into a production environment';
  end if;
  if p_password is null or length(p_password) < 12 then
    raise exception 'demo password must be at least 12 characters';
  end if;
  insert into public.platform_settings (key, value, description) values ('environment', '"demo"', 'local | demo | production — guards demo seed/reset')
  on conflict (key) do nothing;
`;
const footer = `
  return ${q(JSON.stringify(counts))}::jsonb;
end $seed$;
revoke execute on function public.seed_demo(text) from public, anon, authenticated;
`;
mkdirSync("supabase/seed", { recursive: true });
writeFileSync("supabase/seed/demo_seed.sql", header + out.map((l) => "  " + l).join("\n") + footer);
console.log("wrote supabase/seed/demo_seed.sql", counts, `${out.length} statements`);
