import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { pick, type Locale } from "@/lib/i18n/config";

export async function loadJobFormOptions(supabase: ServerSupabase, _companyId: string, locale: Locale) {
  const [{ data: skills }, { data: cats }] = await Promise.all([
    supabase.from("skills").select("id, name_en, name_ar").order("name_en"),
    supabase.from("job_categories").select("id, name_en, name_ar").order("name_en"),
  ]);
  return {
    skills: (skills ?? []).map((s) => ({ id: s.id, name: pick(s, "name", locale) })),
    categories: (cats ?? []).map((c) => ({ id: c.id, name: pick(c, "name", locale) })),
  };
}
