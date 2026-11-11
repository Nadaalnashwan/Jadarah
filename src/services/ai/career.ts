import "server-only";
import { z } from "zod";
import type { GapAnalysis } from "@/lib/domain/career";
import type { createClient } from "@/lib/supabase/server";
import { AIUnavailableError, generateJSON } from "./provider";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

const planSchema = z.object({
  summary_en: z.string().max(700),
  summary_ar: z.string().max(700),
  items: z
    .array(
      z.object({
        title_en: z.string().max(140),
        title_ar: z.string().max(140),
        description_en: z.string().max(400),
        description_ar: z.string().max(400),
        skill_slug: z.string().nullable(),
        kind: z.enum(["milestone", "activity"]),
        resource_id: z.string().nullable(),
        estimated_hours: z.number().min(0).max(200),
      }),
    )
    .min(3)
    .max(12),
});

export type PersonalisedPlan = {
  summary_en: string;
  summary_ar: string;
  items: z.infer<typeof planSchema>["items"];
  provider: string;
  model: string;
};

/**
 * Personalise a development plan from the candidate's gap analysis (structured task → Gemini).
 * Facts (strong/developing/missing) come from the deterministic gap analysis; the AI only orders
 * and explains milestones, and may only reference verified learning resources from the platform
 * library (unknown resource IDs / skills are dropped). Returns null when AI is unavailable or
 * produced nothing usable — callers then keep the template plan, labelled rule-based.
 */
export async function personalisePlan(
  supabase: ServerSupabase,
  userId: string,
  target: { title_en: string; level: string | null; weeks: number; required: string[] },
  gap: GapAnalysis,
  skillLevels: { slug: string; level: number }[],
): Promise<PersonalisedPlan | null> {
  const { data: resources } = await supabase
    .from("learning_resources")
    .select("id, title_en, kind, level, duration_hours, skill_slugs, is_free")
    .eq("is_active", true)
    .overlaps("skill_slugs", target.required)
    .limit(40);
  const allowedRes = new Map((resources ?? []).map((r) => [r.id, r]));
  const allowedSkills = new Set(target.required);
  try {
    const { data, provider, model } = await generateJSON(
      {
        operation: "career_plan",
        userId,
        system: `You are a career coach on JADARAH. Build a realistic, motivating development plan.
Rules: rely ONLY on the given facts. Prioritise missing skills, then developing ones; do not add practice for strong skills except one capstone milestone.
Every activity should reference a resource_id from RESOURCES when one fits (never invent links or IDs); otherwise resource_id = null.
Use skill_slug values only from REQUIRED_SKILLS (or null). Mix 'activity' steps with 2-3 'milestone' checkpoints (e.g. a portfolio project).
Write both English and Modern Standard Arabic. Return JSON {summary_en, summary_ar, items:[...]}.`,
        prompt: `TARGET: ${target.title_en} (${target.level ?? "n/a"}), about ${target.weeks} weeks.
REQUIRED_SKILLS: ${target.required.join(", ")}
GAP (deterministic): strong=${gap.strong.join(", ") || "none"}; developing=${gap.developing.join(", ") || "none"}; missing=${gap.missing.join(", ") || "none"}
CURRENT_LEVELS: ${skillLevels.map((s) => `${s.slug}:${s.level}/5`).join(", ") || "none"}
RESOURCES: ${JSON.stringify((resources ?? []).map((r) => ({ id: r.id, title: r.title_en, kind: r.kind, level: r.level, hours: r.duration_hours, skills: r.skill_slugs, free: r.is_free })))}`,
      },
      planSchema,
    );
    const items = data.items.map((i) => ({
      ...i,
      skill_slug: i.skill_slug && allowedSkills.has(i.skill_slug) ? i.skill_slug : null,
      resource_id: i.resource_id && allowedRes.has(i.resource_id) ? i.resource_id : null,
      estimated_hours: Math.round(i.estimated_hours),
    }));
    return { summary_en: data.summary_en, summary_ar: data.summary_ar, items, provider, model };
  } catch (e) {
    if (e instanceof AIUnavailableError) return null;
    throw e;
  }
}
