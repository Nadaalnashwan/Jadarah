"use server";
import { z } from "zod";
import { requireCompanyMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AIUnavailableError, generateJSON } from "./provider";

const jobDraftSchema = z.object({
  description_en: z.string().max(3000),
  description_ar: z.string().max(3000),
  responsibilities_en: z.array(z.string().max(300)).max(8),
  responsibilities_ar: z.array(z.string().max(300)).max(8),
  qualifications_en: z.array(z.string().max(300)).max(8),
  qualifications_ar: z.array(z.string().max(300)).max(8),
  skills: z
    .array(
      z.object({
        name: z.string(),
        importance: z.enum(["required", "preferred"]),
        min_level: z.number().int().min(1).max(5),
      }),
    )
    .max(10),
});
export type JobDraft = z.infer<typeof jobDraftSchema> & {
  skill_ids: { skill_id: string; importance: "required" | "preferred"; min_level: number }[];
  provider: string;
  recordId: string;
};

/** AI job-post draft. Returned to the form for human editing; never published automatically. */
export async function draftJobWithAI(
  title: string,
  level: string,
): Promise<{ ok: true; draft: JobDraft } | { ok: false; reason: "not_configured" | "failed" }> {
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const supabase = await createClient();
  const { data: taxonomy } = await supabase.from("skills").select("id, name_en");
  try {
    const { data, provider, model } = await generateJSON(
      {
        operation: "job_description",
        userId: s.userId,
        system:
          "You draft bilingual (English + Modern Standard Arabic) job posts for Saudi employers. Be specific, inclusive and realistic. Pick skills ONLY from the provided list. Return JSON.",
        prompt: `Title: ${title.slice(0, 140)}\nLevel: ${level}\nAllowed skills: ${(taxonomy ?? []).map((t) => t.name_en).join(", ")}\nReturn keys description_en, description_ar, responsibilities_en[], responsibilities_ar[], qualifications_en[], qualifications_ar[], skills[{name, importance, min_level}].`,
      },
      jobDraftSchema,
    );
    const byName = new Map((taxonomy ?? []).map((t) => [t.name_en.toLowerCase(), t.id]));
    const skill_ids = data.skills
      .map((x) => ({
        skill_id: byName.get(x.name.toLowerCase()) ?? "",
        importance: x.importance,
        min_level: x.min_level,
      }))
      .filter((x) => x.skill_id);
    const { data: rec } = await supabase
      .from("ai_generation_records")
      .insert({
        user_id: s.userId,
        company_id: s.activeMembership.company_id,
        kind: "job_description",
        provider,
        model,
        input_summary: title.slice(0, 140),
        output: data,
        review_status: "pending_review",
      })
      .select("id")
      .single();
    return { ok: true, draft: { ...data, skill_ids, provider: `${provider} · ${model}`, recordId: rec?.id ?? "" } };
  } catch (e) {
    if (e instanceof AIUnavailableError)
      return { ok: false, reason: e.message === "not_configured" ? "not_configured" : "failed" };
    return { ok: false, reason: "failed" };
  }
}

const questionsSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().max(400),
        kind: z.enum(["technical", "behavioral", "role", "follow_up"]),
      }),
    )
    .max(10),
});

/**
 * Interview question suggestions. With a provider: role-specific AI questions.
 * Without: a transparent, built-in question bank keyed to the job's required skills (labelled rule-based).
 */
export async function suggestInterviewQuestions(
  interviewId: string,
  locale: "ar" | "en",
): Promise<{
  questions: { question: string; kind: "technical" | "behavioral" | "role" | "follow_up" }[];
  mode: "ai" | "rule_based";
}> {
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const supabase = await createClient();
  const { data: iv } = await supabase
    .from("interviews")
    .select(
      "application:applications(job:jobs(title_en, experience_level, job_skills(importance, skill:skills(name_en, name_ar))))",
    )
    .eq("id", interviewId)
    .single();
  const job = iv?.application?.job;
  const skills = (job?.job_skills ?? []).filter((j) => j.importance === "required").map((j) => j.skill!);
  try {
    const { data, provider, model } = await generateJSON(
      {
        operation: "interview_questions",
        userId: s.userId,
        system: `You suggest structured interview questions. Language: ${locale === "ar" ? "Arabic" : "English"}. Mix technical, behavioral and role-specific questions plus one follow-up. Avoid questions about protected characteristics. Return JSON {questions:[{question, kind}]}.`,
        prompt: `Role: ${job?.title_en}; level: ${job?.experience_level}; required skills: ${skills.map((x) => x.name_en).join(", ")}`,
      },
      questionsSchema,
    );
    await supabase
      .from("ai_generation_records")
      .insert({
        user_id: s.userId,
        company_id: s.activeMembership.company_id,
        kind: "interview_questions",
        provider,
        model,
        input_summary: job?.title_en ?? "",
        output: data,
        review_status: "pending_review",
      });
    return { questions: data.questions, mode: "ai" };
  } catch (e) {
    if (!(e instanceof AIUnavailableError)) throw e;
    const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
    return {
      mode: "rule_based",
      questions: [
        ...skills
          .slice(0, 3)
          .map((sk) => ({
            question: L(
              `Walk us through a problem you solved using ${sk.name_en}. What trade-offs did you consider?`,
              `حدّثنا عن مشكلة حللتها باستخدام ${sk.name_ar}. ما المفاضلات التي أخذتها في الاعتبار؟`,
            ),
            kind: "technical" as const,
          })),
        {
          question: L(
            "Tell us about a time you disagreed with a teammate. How was it resolved?",
            "حدّثنا عن موقف اختلفت فيه مع زميل. كيف حُلّ الخلاف؟",
          ),
          kind: "behavioral",
        },
        {
          question: L(
            "What would you focus on in your first 90 days in this role?",
            "على ماذا ستركّز في أول 90 يومًا في هذا الدور؟",
          ),
          kind: "role",
        },
        {
          question: L(
            "If you could redo that project, what would you change and why?",
            "لو أعدت ذلك المشروع، ماذا ستغيّر ولماذا؟",
          ),
          kind: "follow_up",
        },
      ],
    };
  }
}
