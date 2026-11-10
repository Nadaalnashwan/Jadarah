export interface ShowcaseSkill {
  skill_id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  level: number;
  source: "self" | "cv" | "assessment" | "verified";
  evidence: string | null;
}

export interface ShowcaseJobSkill {
  skill_id: string;
  name_en: string;
  name_ar: string;
  importance: "required" | "preferred";
  min_level: number;
}

export interface ShowcaseData {
  stats: { companies: number; jobs: number; candidates: number; assessments: number; resources: number };
  candidate: {
    first_name: string;
    headline: string | null;
    years_experience: number | null;
    skills: ShowcaseSkill[];
    applications: { status: string; title_en: string; title_ar: string; company_en: string; company_ar: string }[];
    assessment: { title_en: string; title_ar: string; percentage: number | null } | null;
  } | null;
  job: {
    title_en: string;
    title_ar: string;
    company_en: string;
    company_ar: string;
    min_years: number;
    skills: ShowcaseJobSkill[];
  } | null;
  company: {
    name_en: string;
    name_ar: string;
    funnel: { applied: number; reviewed: number; assessed: number; shortlisted: number; interviewed: number; hired: number };
    candidates: { alias: string; years: number | null; skills: ShowcaseSkill[] }[];
    upcoming_interviews: number;
  } | null;
  plan: {
    title_en: string;
    title_ar: string;
    estimated_weeks: number;
    required_skill_slugs: string[];
    items: { title_en: string; title_ar: string; skill_slug: string | null; estimated_hours: number | null }[];
  } | null;
}
