import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { computeMatch, type CandidateSkillRecord, type MatchResult } from "@/lib/domain/matching";
import { profileCompletion } from "@/lib/domain/career";
import type { Locale } from "@/lib/i18n/config";

export async function getCandidateSkills(supabase: ServerSupabase, candidateId: string) {
  const { data } = await supabase
    .from("candidate_skills")
    .select("id, level, source, evidence, years, skill:skills(id, slug, name_en, name_ar, kind, category:skill_categories(slug, name_en, name_ar))")
    .eq("candidate_id", candidateId)
    .order("level", { ascending: false });
  return data ?? [];
}

export function toSkillRecords(skills: Awaited<ReturnType<typeof getCandidateSkills>>): CandidateSkillRecord[] {
  return skills
    .filter((s) => s.skill)
    .map((s) => ({ skill_id: s.skill!.id, level: s.level, source: s.source as CandidateSkillRecord["source"], evidence: s.evidence, years: s.years }));
}

export const JOB_LIST_SELECT =
  "id, title_en, title_ar, city, work_mode, employment_type, experience_level, min_years, salary_min, salary_max, salary_visible, salary_currency, deadline, published_at, status, company:company_profiles(id, name_en, name_ar, slug), category:job_categories(slug, name_en, name_ar), job_skills(importance, min_level, skill:skills(id, slug, name_en, name_ar))";

type JobWithSkills = {
  min_years: number;
  job_skills: { importance: string; min_level: number; skill: { id: string; name_en: string; name_ar: string } | null }[];
};

export function matchJob(job: JobWithSkills, skills: CandidateSkillRecord[], years: number | null, locale: Locale): MatchResult {
  return computeMatch(
    job.job_skills
      .filter((js) => js.skill)
      .map((js) => ({
        skill_id: js.skill!.id,
        name: locale === "ar" ? js.skill!.name_ar : js.skill!.name_en,
        importance: js.importance as "required" | "preferred",
        min_level: js.min_level,
      })),
    skills,
    { required: job.min_years, candidate: years },
  );
}

export async function getProfileCompletion(supabase: ServerSupabase, candidateId: string, fullName: string) {
  const [cp, edu, exp, sk, pr, ce, cv] = await Promise.all([
    supabase.from("candidate_profiles").select("headline, summary, city, languages").eq("user_id", candidateId).maybeSingle(),
    supabase.from("candidate_education").select("id", { count: "exact", head: true }).eq("candidate_id", candidateId),
    supabase.from("candidate_experience").select("id", { count: "exact", head: true }).eq("candidate_id", candidateId),
    supabase.from("candidate_skills").select("id", { count: "exact", head: true }).eq("candidate_id", candidateId),
    supabase.from("candidate_projects").select("id", { count: "exact", head: true }).eq("candidate_id", candidateId),
    supabase.from("candidate_certifications").select("id", { count: "exact", head: true }).eq("candidate_id", candidateId),
    supabase.from("candidate_documents").select("id", { count: "exact", head: true }).eq("candidate_id", candidateId).eq("kind", "cv").is("deleted_at", null),
  ]);
  const langs = Array.isArray(cp.data?.languages) ? cp.data!.languages.length : 0;
  return profileCompletion({
    full_name: fullName,
    headline: cp.data?.headline,
    summary: cp.data?.summary,
    city: cp.data?.city,
    education: edu.count ?? 0,
    experience: exp.count ?? 0,
    skills: sk.count ?? 0,
    projects: pr.count ?? 0,
    certifications: ce.count ?? 0,
    languages: langs,
    cvs: cv.count ?? 0,
  });
}
