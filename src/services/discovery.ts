import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { pick, type Locale } from "@/lib/i18n/config";
import { recommendCareers, type CategoryDemand } from "@/lib/domain/discovery";
import { getCandidateSkills } from "@/services/candidate";
import { LISTED_JOB_FILTER, openDeadlineFilter } from "@/lib/domain/listings";

/** Real data only: the candidate's skills/interests and the skills published jobs ask for, per job category. */
export async function loadDiscovery(supabase: ServerSupabase, candidateId: string, locale: Locale) {
  const [skills, { data: cp }, { data: cats }, { data: jobs }, { data: tasks }, { data: attempts }] = await Promise.all([
    getCandidateSkills(supabase, candidateId),
    supabase.from("candidate_profiles").select("career_interests").eq("user_id", candidateId).maybeSingle(),
    supabase.from("job_categories").select("id, slug, name_en, name_ar").order("name_en"),
    supabase
      .from("jobs")
      .select("id, title_en, title_ar, category_id, job_skills(importance, skill:skills(id, name_en, name_ar))")
      .eq("status", "published")
      .or(LISTED_JOB_FILTER).or(openDeadlineFilter()),
    supabase.from("exploration_tasks").select("slug, category_id, title_en, title_ar, minutes").eq("active", true),
    supabase
      .from("exploration_attempts")
      .select("id, status, created_at, submitted_at, task:exploration_tasks(slug, title_en, title_ar)")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const demand: CategoryDemand[] = (cats ?? []).map((c) => {
    const inCat = (jobs ?? []).filter((j) => j.category_id === c.id);
    const map: CategoryDemand["skills"] = new Map();
    for (const j of inCat)
      for (const js of j.job_skills) {
        if (!js.skill) continue;
        const cur = map.get(js.skill.id) ?? { name: pick(js.skill, "name", locale), count: 0, required: 0 };
        cur.count += 1;
        if (js.importance === "required") cur.required += 1;
        map.set(js.skill.id, cur);
      }
    return {
      slug: c.slug,
      name: pick(c, "name", locale),
      jobs: inCat.map((j) => ({ id: j.id, title: pick(j, "title", locale) })),
      skills: map,
    };
  });
  const recommendations = recommendCareers(
    skills.filter((s) => s.skill).map((s) => ({ id: s.skill!.id, name: pick(s.skill!, "name", locale), source: s.source })),
    cp?.career_interests ?? [],
    demand,
  );
  const taskByCategory = new Map(
    (tasks ?? []).map((t) => {
      const c = (cats ?? []).find((x) => x.id === t.category_id);
      return [c?.slug ?? "", { slug: t.slug, title: pick(t, "title", locale), minutes: t.minutes }];
    }),
  );
  return {
    recommendations,
    hasSkills: skills.length > 0,
    fields: demand.map((d) => ({ slug: d.slug, name: d.name, openJobs: d.jobs.length, task: taskByCategory.get(d.slug) ?? null })),
    taskByCategory,
    attempts: attempts ?? [],
  };
}
