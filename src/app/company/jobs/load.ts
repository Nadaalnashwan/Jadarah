import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { pick, type Locale } from "@/lib/i18n/config";

export async function loadJobFormOptions(supabase: ServerSupabase, companyId: string, locale: Locale) {
  const [{ data: skills }, { data: cats }, { data: asm }] = await Promise.all([
    supabase.from("skills").select("id, name_en, name_ar").order("name_en"),
    supabase.from("job_categories").select("id, name_en, name_ar").order("name_en"),
    supabase.from("assessments").select("id, title_en, title_ar, company_id").eq("status", "published").or(`company_id.is.null,company_id.eq.${companyId}`).order("title_en"),
  ]);
  return {
    skills: (skills ?? []).map((s) => ({ id: s.id, name: pick(s, "name", locale) })),
    categories: (cats ?? []).map((c) => ({ id: c.id, name: pick(c, "name", locale) })),
    assessments: (asm ?? []).map((a) => ({ id: a.id, name: pick(a, "title", locale) + (a.company_id ? " ★" : "") })),
  };
}
