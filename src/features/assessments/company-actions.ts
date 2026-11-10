"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCompanyMember } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AIUnavailableError, generateJSON } from "@/services/ai/provider";

const DEFAULT_RUBRIC = [
  { key: "correctness", name_en: "Correctness", name_ar: "الصحة", max_points: 4 },
  { key: "reasoning", name_en: "Reasoning", name_ar: "الاستدلال", max_points: 3 },
  { key: "clarity", name_en: "Clarity", name_ar: "الوضوح", max_points: 3 },
];

async function ctx() {
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  return { s, cid: s.activeMembership.company_id, supabase: await createClient(), ...(await getI18n()) };
}

const metaSchema = z.object({
  title_en: z.string().trim().min(2).max(140),
  title_ar: z.string().trim().min(2).max(140),
  description_en: z.string().max(2000).optional(),
  description_ar: z.string().max(2000).optional(),
  duration_minutes: z.coerce.number().int().min(5).max(480),
  passing_score: z.coerce.number().int().min(0).max(100),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  category: z.string().trim().min(2).max(40),
});

export async function createAssessment(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { s, cid, supabase, locale } = await ctx();
  const parsed = metaSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: locale === "ar" ? "أكمل الحقول." : "Complete the fields." };
  const { data, error } = await supabase
    .from("assessments")
    .insert({ ...parsed.data, company_id: cid, created_by: s.userId, status: "draft" })
    .select("id")
    .single();
  if (error) return { ok: false, error: localizeError(error, locale) };
  await supabase
    .from("assessment_rubrics")
    .insert({
      assessment_id: data.id,
      title_en: "Open response rubric",
      title_ar: "معايير الإجابات المفتوحة",
      criteria: DEFAULT_RUBRIC,
    });
  redirect(`/company/assessments/${data.id}`);
}

/** Copies a published library assessment into the company's own editable draft. */
export async function cloneAssessment(sourceId: string): Promise<void> {
  const { s, cid, supabase } = await ctx();
  const { data: src } = await supabase
    .from("assessments")
    .select("*, assessment_questions(*, assessment_options(*)), assessment_rubrics(*)")
    .eq("id", sourceId)
    .single();
  if (!src) redirect("/company/assessments?error=1");
  const { data: copy } = await supabase
    .from("assessments")
    .insert({
      company_id: cid,
      title_en: `${src.title_en} (copy)`,
      title_ar: `${src.title_ar} (نسخة)`,
      description_en: src.description_en,
      description_ar: src.description_ar,
      category: src.category,
      difficulty: src.difficulty,
      duration_minutes: src.duration_minutes,
      passing_score: src.passing_score,
      learning_outcomes_en: src.learning_outcomes_en,
      learning_outcomes_ar: src.learning_outcomes_ar,
      status: "draft",
      created_by: s.userId,
    })
    .select("id")
    .single();
  const { data: rub } = await supabase
    .from("assessment_rubrics")
    .insert({
      assessment_id: copy!.id,
      title_en: src.assessment_rubrics[0]?.title_en ?? "Rubric",
      title_ar: src.assessment_rubrics[0]?.title_ar ?? "المعايير",
      criteria: src.assessment_rubrics[0]?.criteria ?? DEFAULT_RUBRIC,
    })
    .select("id")
    .single();
  for (const q of src.assessment_questions) {
    const { data: nq } = await supabase
      .from("assessment_questions")
      .insert({
        assessment_id: copy!.id,
        type: q.type,
        prompt_en: q.prompt_en,
        prompt_ar: q.prompt_ar,
        points: q.points,
        position: q.position,
        config: q.config,
        rubric_id: q.rubric_id ? rub!.id : null,
        explanation_en: q.explanation_en,
        explanation_ar: q.explanation_ar,
      })
      .select("id")
      .single();
    if (q.assessment_options.length)
      await supabase
        .from("assessment_options")
        .insert(
          q.assessment_options.map((o) => ({
            question_id: nq!.id,
            label_en: o.label_en,
            label_ar: o.label_ar,
            is_correct: o.is_correct,
            position: o.position,
          })),
        );
  }
  redirect(`/company/assessments/${copy!.id}`);
}

const questionSchema = z.object({
  type: z.enum([
    "multiple_choice",
    "multiple_select",
    "true_false",
    "short_answer",
    "long_answer",
    "coding",
    "sql",
    "case_study",
    "file_upload",
  ]),
  prompt_en: z.string().trim().min(3).max(2000),
  prompt_ar: z.string().trim().min(3).max(2000),
  points: z.coerce.number().int().min(1).max(100),
  accepted: z.string().max(500).optional(),
  language: z.string().max(30).optional(),
  explanation_en: z.string().max(1000).optional(),
  explanation_ar: z.string().max(1000).optional(),
});

export async function addQuestion(
  assessmentId: string,
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { supabase, locale } = await ctx();
  const parsed = questionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      ok: false,
      error:
        locale === "ar" ? "أكمل نص السؤال بالعربية والإنجليزية." : "Write the question in both languages.",
    };
  const v = parsed.data;
  const objective = ["multiple_choice", "multiple_select", "true_false"].includes(v.type);
  const optsEn = form.getAll("opt_en").map(String);
  const optsAr = form.getAll("opt_ar").map(String);
  const correct = new Set(form.getAll("opt_correct").map(String));
  let options = optsEn
    .map((en, i) => ({
      en: en.trim(),
      ar: (optsAr[i] ?? "").trim() || en.trim(),
      correct: correct.has(String(i)),
    }))
    .filter((o) => o.en);
  if (v.type === "true_false")
    options = [
      { en: "True", ar: "صحيح", correct: correct.has("0") },
      { en: "False", ar: "خطأ", correct: !correct.has("0") },
    ];
  if (objective) {
    const nCorrect = options.filter((o) => o.correct).length;
    if (options.length < 2)
      return { ok: false, error: locale === "ar" ? "أضف خيارين على الأقل." : "Add at least two options." };
    if (nCorrect === 0 || (v.type !== "multiple_select" && nCorrect !== 1))
      return {
        ok: false,
        error:
          locale === "ar"
            ? "حدّد الإجابة الصحيحة (واحدة فقط للاختيار المفرد)."
            : "Mark the correct answer (exactly one for single choice).",
      };
  }
  const { data: rub } = await supabase
    .from("assessment_rubrics")
    .select("id")
    .eq("assessment_id", assessmentId)
    .limit(1)
    .maybeSingle();
  const { count } = await supabase
    .from("assessment_questions")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId);
  const config: { accepted_answers?: string[]; language?: string } = {};
  if (v.type === "short_answer" && v.accepted?.trim())
    config.accepted_answers = v.accepted
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean);
  if ((v.type === "coding" || v.type === "sql") && v.language) config.language = v.language;
  const manual = !objective && !(v.type === "short_answer" && config.accepted_answers);
  const { data: q, error } = await supabase
    .from("assessment_questions")
    .insert({
      assessment_id: assessmentId,
      type: v.type,
      prompt_en: v.prompt_en,
      prompt_ar: v.prompt_ar,
      points: v.points,
      position: count ?? 0,
      config,
      rubric_id: manual ? (rub?.id ?? null) : null,
      explanation_en: v.explanation_en || null,
      explanation_ar: v.explanation_ar || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: localizeError(error, locale) };
  if (objective)
    await supabase
      .from("assessment_options")
      .insert(
        options.map((o, i) => ({
          question_id: q.id,
          label_en: o.en,
          label_ar: o.ar,
          is_correct: o.correct,
          position: i,
        })),
      );
  revalidatePath(`/company/assessments/${assessmentId}`);
  return { ok: true };
}

export async function deleteQuestion(assessmentId: string, questionId: string): Promise<void> {
  const { supabase } = await ctx();
  await supabase.from("assessment_questions").delete().eq("id", questionId).eq("assessment_id", assessmentId);
  revalidatePath(`/company/assessments/${assessmentId}`);
}

export async function setAssessmentStatus(
  assessmentId: string,
  status: "draft" | "published" | "archived",
): Promise<ActionResult> {
  const { s, supabase, locale } = await ctx();
  const { count } = await supabase
    .from("assessment_questions")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId);
  if (status === "published" && !count)
    return {
      ok: false,
      error: locale === "ar" ? "أضف سؤالًا واحدًا على الأقل." : "Add at least one question.",
    };
  const { error } = await supabase
    .from("assessments")
    .update({ status, reviewed_by: status === "published" ? s.userId : null })
    .eq("id", assessmentId);
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/company/assessments", "layout");
  return { ok: true };
}

const aiQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        type: z.enum(["multiple_choice", "true_false", "multiple_select", "long_answer", "case_study"]),
        prompt_en: z.string().max(1000),
        prompt_ar: z.string().max(1000),
        points: z.number().int().min(1).max(20),
        options: z
          .array(z.object({ en: z.string(), ar: z.string(), correct: z.boolean() }))
          .max(6)
          .default([]),
      }),
    )
    .max(8),
});

/** AI-drafted questions are inserted into a DRAFT assessment only; publication requires a human. */
export async function generateQuestionsWithAI(assessmentId: string, topic: string): Promise<ActionResult> {
  const { s, cid, supabase, locale } = await ctx();
  try {
    const { data, provider } = await generateJSON(
      {
        operation: "assessment_generation",
        userId: s.userId,
        system:
          "You write fair, practical bilingual (English + Arabic) assessment questions for hiring. Objective questions need exactly-specified correct options. Return JSON {questions:[...]}.",
        prompt: `Topic: ${topic.slice(0, 200)}. Create 5 questions: 3 objective (multiple_choice/true_false/multiple_select) and 2 open (long_answer or case_study) with points.`,
      },
      aiQuestionsSchema,
    );
    const { data: a } = await supabase.from("assessments").select("status").eq("id", assessmentId).single();
    if (a?.status !== "draft")
      return {
        ok: false,
        error: locale === "ar" ? "يمكن الإضافة إلى المسودات فقط." : "Questions can only be added to drafts.",
      };
    const { data: rub } = await supabase
      .from("assessment_rubrics")
      .select("id")
      .eq("assessment_id", assessmentId)
      .limit(1)
      .maybeSingle();
    const { count } = await supabase
      .from("assessment_questions")
      .select("id", { count: "exact", head: true })
      .eq("assessment_id", assessmentId);
    for (const [i, q] of data.questions.entries()) {
      const objective = q.type !== "long_answer" && q.type !== "case_study";
      const { data: nq } = await supabase
        .from("assessment_questions")
        .insert({
          assessment_id: assessmentId,
          type: q.type,
          prompt_en: q.prompt_en,
          prompt_ar: q.prompt_ar,
          points: q.points,
          position: (count ?? 0) + i,
          rubric_id: objective ? null : (rub?.id ?? null),
        })
        .select("id")
        .single();
      if (objective && q.options.length)
        await supabase
          .from("assessment_options")
          .insert(
            q.options.map((o, j) => ({
              question_id: nq!.id,
              label_en: o.en,
              label_ar: o.ar,
              is_correct: o.correct,
              position: j,
            })),
          );
    }
    await supabase.from("assessments").update({ ai_generated: true }).eq("id", assessmentId);
    await supabase
      .from("ai_generation_records")
      .insert({
        user_id: s.userId,
        company_id: cid,
        kind: "assessment",
        provider,
        input_summary: topic.slice(0, 200),
        output: data,
        review_status: "pending_review",
      });
    revalidatePath(`/company/assessments/${assessmentId}`);
    return {
      ok: true,
      message:
        locale === "ar"
          ? "أُضيفت أسئلة مقترحة إلى المسودة. راجعها قبل النشر."
          : "Draft questions added. Review them before publishing.",
    };
  } catch (e) {
    if (e instanceof AIUnavailableError)
      return {
        ok: false,
        error:
          e.message === "not_configured"
            ? locale === "ar"
              ? "لم يُضبط مزوّد ذكاء اصطناعي على المنصة."
              : "No AI provider is configured on this platform."
            : locale === "ar"
              ? "تعذّر توليد أسئلة صالحة."
              : "The AI provider did not return usable questions.",
      };
    throw e;
  }
}
