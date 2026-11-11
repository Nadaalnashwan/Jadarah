import "server-only";
import { z } from "zod";
import { DEFAULT_INTERVIEW_RUBRIC, type RubricCriterion } from "@/lib/domain/final-evaluation";
import type { createClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export const rubricSchema = z
  .array(
    z.object({
      key: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
      name_en: z.string().trim().min(2).max(60),
      name_ar: z.string().trim().min(2).max(60),
      weight: z.number().min(0.25).max(3),
    }),
  )
  .min(1)
  .max(12)
  .refine((a) => new Set(a.map((c) => c.key)).size === a.length, "duplicate keys");

/** The company's structured interview rubric (RLS: company members), or the default 7 dimensions. */
export async function getInterviewRubric(supabase: ServerSupabase, companyId: string): Promise<RubricCriterion[]> {
  const { data } = await supabase.from("interview_rubrics").select("criteria").eq("company_id", companyId).maybeSingle();
  const parsed = rubricSchema.safeParse(data?.criteria);
  return parsed.success ? parsed.data : DEFAULT_INTERVIEW_RUBRIC;
}
