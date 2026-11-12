import "server-only";
import type { createClient } from "@/lib/supabase/server";

/** Copying an assessment keeps each question's own rubric (never collapses them into one). */
type Supa = Awaited<ReturnType<typeof createClient>>;

type RubricRow = { id: string; title_en: string; title_ar: string; criteria: unknown; question_id: string | null };

/** Copies rubrics into another assessment; returns old id → new id. */
export async function copyRubrics(
  supabase: Supa,
  rubrics: RubricRow[],
  assessmentId: string,
  fallbackCriteria: unknown,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  // No rubric in the source: the copy still gets the default open-answer rubric (previous behaviour).
  const list = rubrics.length ? rubrics : [{ id: "", title_en: "Rubric", title_ar: "المعايير", criteria: fallbackCriteria, question_id: null }];
  for (const r of list) {
    const { data } = await supabase
      .from("assessment_rubrics")
      .insert({ assessment_id: assessmentId, title_en: r.title_en, title_ar: r.title_ar, criteria: r.criteria as never })
      .select("id")
      .single();
    if (data && r.id) map.set(r.id, data.id);
  }
  return map;
}

/** A copied question-scoped rubric points at the copied question. */
export async function relinkQuestionRubric(
  supabase: Supa,
  rubrics: RubricRow[],
  oldQuestionId: string,
  newRubricId: string | undefined,
  newQuestionId: string,
) {
  if (!newRubricId || !rubrics.some((r) => r.question_id === oldQuestionId)) return;
  await supabase.from("assessment_rubrics").update({ question_id: newQuestionId }).eq("id", newRubricId);
}
