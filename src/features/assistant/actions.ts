"use server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AIUnavailableError, generateJSON } from "@/services/ai/provider";

const replySchema = z.object({ reply: z.string().min(1).max(4000), suggestions: z.array(z.string().max(200)).max(4).default([]) });
export type AssistantReply = { reply: string; suggestions: string[]; mode: "ai" | "rule_based"; provider: string };

/**
 * Candidate / company assistant. Context is built ONLY from records the signed-in user can read
 * through RLS (their own profile, applications or company data). Without a provider, it returns
 * clearly-labelled rule-based guidance — never a simulated AI answer.
 */
export async function askAssistant(scope: "candidate" | "company", message: string): Promise<AssistantReply> {
  const session = await requireSession();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const text = message.trim().slice(0, 1500);

  let context = "";
  if (scope === "candidate") {
    const [{ data: cp }, { data: skills }, { data: apps }, { data: plan }] = await Promise.all([
      supabase.from("candidate_profiles").select("headline, summary, years_experience, experience_level").eq("user_id", session.userId).maybeSingle(),
      supabase.from("candidate_skills").select("level, source, skill:skills(name_en)").eq("candidate_id", session.userId),
      supabase.from("applications").select("status, job:jobs(title_en)").eq("candidate_id", session.userId).limit(10),
      supabase.from("development_plans").select("title_en, required_skill_slugs").eq("candidate_id", session.userId).eq("status", "active").maybeSingle(),
    ]);
    context = JSON.stringify({ profile: cp, skills: (skills ?? []).map((s) => `${s.skill?.name_en} L${s.level} (${s.source})`), applications: (apps ?? []).map((a) => `${a.job?.title_en}: ${a.status}`), target: plan });
  } else {
    const cid = session.activeMembership?.company_id;
    const { data: jobs } = await supabase.from("jobs").select("title_en, status, job_skills(importance, skill:skills(name_en))").eq("company_id", cid ?? "").limit(10);
    context = JSON.stringify({ company_jobs: jobs });
  }

  try {
    const { data, provider } = await generateJSON(
      {
        operation: `${scope}_assistant`,
        userId: session.userId,
        system: `You are JADARAH's ${scope} assistant. Reply in ${locale === "ar" ? "Arabic" : "English"}. Be concise and practical.
Use only the provided context about this user; never invent facts about them. You never make or suggest automatic hiring, rejection or shortlisting decisions — humans decide.
Return JSON {"reply": string, "suggestions": string[] (max 3 follow-up questions)}.`,
        prompt: `CONTEXT: ${context}\n\nQUESTION: ${text}`,
      },
      replySchema,
    );
    await supabase.from("ai_generation_records").insert({ user_id: session.userId, company_id: scope === "company" ? session.activeMembership?.company_id ?? null : null, kind: scope === "candidate" ? "candidate_assistant" : "company_assistant", provider, input_summary: text.slice(0, 200), output: { reply: data.reply.slice(0, 500) }, review_status: "not_required" });
    return { ...data, mode: "ai", provider };
  } catch (e) {
    if (!(e instanceof AIUnavailableError)) throw e;
    return { ...ruleBased(scope, text, locale), mode: "rule_based", provider: "rule_based" };
  }
}

function ruleBased(scope: "candidate" | "company", q: string, locale: "ar" | "en") {
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const lower = q.toLowerCase();
  const tips: [RegExp, string, string][] = scope === "candidate"
    ? [
        [/interview|مقابل/, "Prepare two project stories using Situation–Task–Action–Result, and be ready to explain one trade-off you made.", "حضّر قصتين عن مشاريعك بأسلوب الموقف–المهمة–الإجراء–النتيجة، وكن مستعدًا لشرح مفاضلة اتخذتها."],
        [/cv|resume|سيرة/, "Upload your CV and use Extract on the CV page: confirmed skills gain 'From CV' evidence, which improves your match explanations.", "ارفع سيرتك واستخدم الاستخراج في صفحة السير الذاتية: المهارات المؤكدة تكتسب دليل «من السيرة الذاتية» فتتحسن مطابقاتك."],
        [/gap|skill|مهار|فجو/, "Open Career Development, set a target role, and follow the milestones linked to verified resources.", "افتح التطوير المهني، وحدّد دورًا مستهدفًا، واتبع المراحل المرتبطة بمصادر موثّقة."],
        [/job|وظيف/, "Discover Jobs ranks roles by transparent evidence match — open a job to see which requirements are matched, partial, missing or unverified.", "صفحة الوظائف ترتّبها حسب مطابقة الأدلة — افتح الوظيفة لترى المتطلبات المطابقة والجزئية والمفقودة وغير الموثّقة."],
      ]
    : [
        [/job|description|وظيف|وصف/, "Write responsibilities as outcomes, list 3–5 required skills with minimum levels, and attach a practical assessment.", "اكتب المسؤوليات كنتائج، وحدّد 3–5 مهارات مطلوبة بمستوياتها الدنيا، وأرفق تقييمًا عمليًا."],
        [/interview|مقابل/, "Shortlist first, then schedule structured interviews with a shared rubric and at least one interviewer.", "أضف المرشح للقائمة المختصرة أولًا، ثم جدول مقابلات منظّمة بمعايير مشتركة ومُقابِل واحد على الأقل."],
        [/compare|قارن|مقارن/, "Use Compare on the Applications page to see requirement-by-requirement evidence side by side.", "استخدم المقارنة في صفحة الطلبات لرؤية الأدلة متطلبًا بمتطلب جنبًا إلى جنب."],
      ];
  const hit = tips.find(([re]) => re.test(lower));
  return {
    reply: hit ? L(hit[1], hit[2]) : L("I can help with your profile, CV, jobs, skill gaps and interviews. An AI provider isn't configured, so these are built-in guidelines rather than generated answers.", "أستطيع المساعدة في ملفك وسيرتك والوظائف وفجوات المهارات والمقابلات. لم يُضبط مزوّد ذكاء اصطناعي، لذا هذه إرشادات مدمجة وليست إجابات مولّدة."),
    suggestions: scope === "candidate" ? [L("How do I prepare for an interview?", "كيف أستعد لمقابلة؟"), L("What are my skill gaps?", "ما فجوات مهاراتي؟")] : [L("How should I write this job description?", "كيف أكتب وصف الوظيفة؟")],
  };
}
