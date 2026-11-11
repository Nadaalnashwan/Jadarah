import "server-only";
import type { SessionContext } from "@/lib/auth/session";
import type { createClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
export type AssistantScope = "candidate" | "company";

/**
 * Assistant context built ONLY from rows the signed-in user can read through RLS
 * (their own profile/applications, or their company's jobs). Never other users' data.
 */
export async function buildAssistantContext(
  supabase: ServerSupabase,
  session: SessionContext,
  scope: AssistantScope,
): Promise<string> {
  if (scope === "candidate") {
    const [{ data: cp }, { data: skills }, { data: apps }, { data: plan }] = await Promise.all([
      supabase
        .from("candidate_profiles")
        .select("headline, summary, years_experience, experience_level")
        .eq("user_id", session.userId)
        .maybeSingle(),
      supabase
        .from("candidate_skills")
        .select("level, source, skill:skills(name_en)")
        .eq("candidate_id", session.userId),
      supabase
        .from("applications")
        .select("status, job:jobs(title_en)")
        .eq("candidate_id", session.userId)
        .limit(10),
      supabase
        .from("development_plans")
        .select("title_en, required_skill_slugs")
        .eq("candidate_id", session.userId)
        .eq("status", "active")
        .maybeSingle(),
    ]);
    return JSON.stringify({
      profile: cp,
      skills: (skills ?? []).map((s) => `${s.skill?.name_en} L${s.level} (${s.source})`),
      applications: (apps ?? []).map((a) => `${a.job?.title_en}: ${a.status}`),
      target: plan,
    });
  } else {
    const cid = session.activeMembership?.company_id;
    const { data: jobs } = await supabase
      .from("jobs")
      .select("title_en, status, job_skills(importance, skill:skills(name_en))")
      .eq("company_id", cid ?? "")
      .limit(10);
    return JSON.stringify({ company_jobs: jobs });
  }
}

export function assistantSystemPrompt(scope: AssistantScope, locale: "ar" | "en", format: "json" | "text") {
  return `You are JADARAH's ${scope} assistant. Reply in ${locale === "ar" ? "Arabic" : "English"}. Be concise and practical.
Use only the provided context about this user; never invent facts about them. You never make or suggest automatic hiring, rejection or shortlisting decisions — humans decide.
${
    format === "json"
      ? 'Return JSON {"reply": string, "suggestions": string[] (max 3 follow-up questions)}.'
      : `Write the answer as plain text (no markdown headings, no tables). Then on a new line write exactly ${SUGGESTIONS_MARKER} followed by up to 3 short follow-up questions, one per line.`
  }`;
}

import { SUGGESTIONS_MARKER } from "./markers";
export { SUGGESTIONS_MARKER };

export function ruleBased(scope: "candidate" | "company", q: string, locale: "ar" | "en") {
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const lower = q.toLowerCase();
  const tips: [RegExp, string, string][] =
    scope === "candidate"
      ? [
          [
            /interview|مقابل/,
            "Prepare two project stories using Situation–Task–Action–Result, and be ready to explain one trade-off you made.",
            "حضّر قصتين عن مشاريعك بأسلوب الموقف–المهمة–الإجراء–النتيجة، وكن مستعدًا لشرح مفاضلة اتخذتها.",
          ],
          [
            /cv|resume|سيرة/,
            "Upload your CV and use Extract on the CV page: confirmed skills gain 'From CV' evidence, which improves your match explanations.",
            "ارفع سيرتك واستخدم الاستخراج في صفحة السير الذاتية: المهارات المؤكدة تكتسب دليل «من السيرة الذاتية» فتتحسن مطابقاتك.",
          ],
          [
            /gap|skill|مهار|فجو/,
            "Open Career Development, set a target role, and follow the milestones linked to verified resources.",
            "افتح التطوير المهني، وحدّد دورًا مستهدفًا، واتبع المراحل المرتبطة بمصادر موثّقة.",
          ],
          [
            /job|وظيف/,
            "Discover Jobs ranks roles by transparent evidence match — open a job to see which requirements are matched, partial, missing or unverified.",
            "صفحة الوظائف ترتّبها حسب مطابقة الأدلة — افتح الوظيفة لترى المتطلبات المطابقة والجزئية والمفقودة وغير الموثّقة.",
          ],
        ]
      : [
          [
            /job|description|وظيف|وصف/,
            "Write responsibilities as outcomes, list 3–5 required skills with minimum levels, and attach a practical assessment.",
            "اكتب المسؤوليات كنتائج، وحدّد 3–5 مهارات مطلوبة بمستوياتها الدنيا، وأرفق تقييمًا عمليًا.",
          ],
          [
            /interview|مقابل/,
            "Shortlist first, then schedule structured interviews with a shared rubric and at least one interviewer.",
            "أضف المرشح للقائمة المختصرة أولًا، ثم جدول مقابلات منظّمة بمعايير مشتركة ومُقابِل واحد على الأقل.",
          ],
          [
            /compare|قارن|مقارن/,
            "Use Compare on the Applications page to see requirement-by-requirement evidence side by side.",
            "استخدم المقارنة في صفحة الطلبات لرؤية الأدلة متطلبًا بمتطلب جنبًا إلى جنب.",
          ],
        ];
  const hit = tips.find(([re]) => re.test(lower));
  return {
    reply: hit
      ? L(hit[1], hit[2])
      : L(
          "I can help with your profile, CV, jobs, skill gaps and interviews. An AI provider isn't configured, so these are built-in guidelines rather than generated answers.",
          "أستطيع المساعدة في ملفك وسيرتك والوظائف وفجوات المهارات والمقابلات. لم يُضبط مزوّد ذكاء اصطناعي، لذا هذه إرشادات مدمجة وليست إجابات مولّدة.",
        ),
    suggestions:
      scope === "candidate"
        ? [
            L("How do I prepare for an interview?", "كيف أستعد لمقابلة؟"),
            L("What are my skill gaps?", "ما فجوات مهاراتي؟"),
          ]
        : [L("How should I write this job description?", "كيف أكتب وصف الوظيفة؟")],
  };
}
