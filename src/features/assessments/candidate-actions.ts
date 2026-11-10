"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCandidate } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export interface AttemptQuestion {
  id: string;
  section_id: string | null;
  type: "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "long_answer" | "coding" | "sql" | "case_study" | "file_upload";
  prompt_en: string;
  prompt_ar: string;
  points: number;
  config: Record<string, unknown>;
  rubric: { title_en: string; title_ar: string; criteria: { key: string; name_en: string; name_ar: string; max_points: number }[] } | null;
  options: { id: string; label_en: string; label_ar: string }[];
  answer: { selected_option_ids: string[]; text_answer: string | null; file_path: string | null } | null;
}
export interface Attempt {
  assignment_id: string;
  submission_id: string;
  status: "in_progress" | "submitted" | "evaluated";
  started_at: string;
  ends_at: string;
  due_at: string | null;
  assessment: { id: string; title_en: string; title_ar: string; description_en: string | null; description_ar: string | null; duration_minutes: number; passing_score: number };
  questions: AttemptQuestion[];
}

export async function startAttempt(assignmentId: string): Promise<ActionResult<Attempt>> {
  await requireCandidate();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_assessment", { p_assignment: assignmentId });
  if (error) return { ok: false, error: localizeError(error, locale) };
  return { ok: true, data: data as unknown as Attempt };
}

const saveSchema = z.object({
  assignmentId: z.string().uuid(),
  questionId: z.string().uuid(),
  selected: z.array(z.string().uuid()).max(20),
  text: z.string().max(20000).nullable(),
});
export async function saveAnswer(input: z.infer<typeof saveSchema>): Promise<ActionResult<{ savedAt: string }>> {
  await requireCandidate();
  const { locale } = await getI18n();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: localizeError(null, locale) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_assessment_answer", {
    p_assignment: parsed.data.assignmentId,
    p_question: parsed.data.questionId,
    p_selected: parsed.data.selected,
    p_text: parsed.data.text ?? undefined,
  });
  if (error) return { ok: false, error: localizeError(error, locale) };
  return { ok: true, data: { savedAt: data as string } };
}

export async function submitAttempt(assignmentId: string): Promise<ActionResult> {
  await requireCandidate();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_assessment", { p_assignment: assignmentId });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/candidate", "layout");
  return { ok: true };
}
