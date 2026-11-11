/**
 * Assessment Builder smoke test outside the UI (diagnostics). Signs in as a demo recruiter,
 * retrieves references and runs generate → validate → repair for one of the company's jobs.
 * Prints model, validation and structure only — no generated content, no secrets.
 *
 *   npx tsx --conditions=react-server scripts/ai/builder-smoke.ts <org short> "<job title>"
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";
import { buildAssessment, retrieveReferences, type CompanyContext, type JobInput } from "../../src/services/ai/assessment-builder";

config({ path: ".env.local", quiet: true });
const [org = "elm", title = "Software Engineer"] = process.argv.slice(2);

(async () => {
  const sb = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!, { auth: { persistSession: false } });
  const { data: auth, error } = await sb.auth.signInWithPassword({ email: `recruiter.${org}@jadarah-demo.test`, password: process.env.DEMO_USER_PASSWORD! });
  if (error) throw error;
  const { data: m } = await sb.from("company_memberships").select("company:company_profiles(id, name_en, name_ar, sector_en, organization_type)").eq("user_id", auth.user.id).single();
  const company = m!.company as unknown as CompanyContext;
  const { data: job } = await sb
    .from("jobs")
    .select("id, title_en, experience_level, description_en, responsibilities_en, job_skills(importance, skill:skills(name_en))")
    .eq("company_id", company.id)
    .eq("title_en", title)
    .single();
  const input: JobInput = {
    job_id: job!.id,
    title: job!.title_en,
    seniority: job!.experience_level,
    description: job!.description_en ?? "",
    responsibilities: job!.responsibilities_en ?? [],
    required_skills: job!.job_skills.filter((x) => x.importance === "required").map((x) => x.skill?.name_en ?? "").filter(Boolean),
    preferred_skills: job!.job_skills.filter((x) => x.importance !== "required").map((x) => x.skill?.name_en ?? "").filter(Boolean),
    constraints: "",
    expected_outcomes: "",
    duration_minutes: 120,
  };
  const refs = await retrieveReferences(sb as never, input, company);
  console.log("references:", refs.map((r) => `${r.role_en} (${r.reason})`).join(" | "));
  const t0 = Date.now();
  const r = await buildAssessment({ userId: auth.user.id, company, job: input, references: refs });
  console.log(`model: ${r.provider}/${r.model} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`tasks=${r.draft.tasks.length} rubric=${r.draft.rubric.length} datasets=${r.draft.datasets.length} duration=${r.draft.duration_minutes}`);
  for (const c of r.checks) console.log(`${c.passed ? "✓" : "✗"} ${c.check}${c.passed ? "" : ` — ${c.detail}`}`);
})().catch((e) => {
  console.error("failed:", e?.code ?? e?.message ?? e);
  process.exit(1);
});
