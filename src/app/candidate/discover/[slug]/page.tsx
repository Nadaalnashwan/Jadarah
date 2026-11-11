import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireCandidate } from "@/lib/auth/session";
import { pick, pickArray, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { Criterion } from "@/lib/domain/discovery";
import { ExplorationForm } from "./form";
import { LISTED_JOB_FILTER } from "@/lib/domain/listings";

type Feedback = {
  source: "ai" | "rule_based";
  covered: string[];
  missed: string[];
  strengths: string[];
  improvements: string[];
  summary: string;
};

export default async function ExplorationTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ attempt?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const session = await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("exploration_tasks")
    .select("*, category:job_categories(id, slug, name_en, name_ar)")
    .eq("slug", slug)
    .maybeSingle();
  if (!task) notFound();
  const [{ data: attempt }, { data: jobs }] = await Promise.all([
    sp.attempt
      ? supabase.from("exploration_attempts").select("*").eq("id", sp.attempt).eq("candidate_id", session.userId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("jobs")
      .select("id, title_en, title_ar, job_skills(skill:skills(name_en, name_ar))")
      .eq("status", "published")
      .or(LISTED_JOB_FILTER)
      .eq("category_id", task.category_id)
      .limit(4),
  ]);
  const criteria = (task.criteria ?? []) as unknown as Criterion[];
  const fb = attempt?.feedback as Feedback | null | undefined;
  const skills = [...new Set((jobs ?? []).flatMap((j) => j.job_skills.map((s) => pick(s.skill, "name", locale))).filter(Boolean))].slice(0, 10);
  return (
    <>
      <PageHeader
        eyebrow={`${L("Exploratory task", "مهمة استكشافية")} · ${pick(task.category, "name", locale)}`}
        title={pick(task, "title", locale)}
        description={L(
          "A short learning exercise to experience the work. Not a job application, not an employer assessment, and never a hiring score.",
          "تمرين قصير لتعيش طبيعة العمل. ليس تقديمًا على وظيفة ولا تقييمًا من جهة توظيف، ولا يُعدّ درجة توظيف.",
        )}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={L("The role", "الدور")} />
            <CardBody className="flex flex-col gap-4 text-sm">
              <p className="text-muted leading-relaxed">{pick(task, "role", locale)}</p>
              <div>
                <p className="mb-1.5 text-xs font-semibold">{L("What people in this role typically do", "ما يقوم به أصحاب هذا الدور عادةً")}</p>
                <ul className="text-muted list-disc space-y-1 ps-5">
                  {pickArray(task, "daily", locale).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              {skills.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold">{L("Skills open roles ask for", "مهارات تطلبها الوظائف المتاحة")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((s) => (
                      <Badge key={s} tone="neutral">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
          {(jobs ?? []).length > 0 && (
            <Card>
              <CardHeader title={L("Related opportunities", "فرص ذات صلة")} />
              <CardBody className="flex flex-col gap-1.5 text-sm">
                {jobs!.map((j) => (
                  <Link key={j.id} href={`/candidate/jobs/${j.id}`} className="text-primary font-semibold dark:text-lavender">
                    {pick(j, "title", locale)} →
                  </Link>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title={L("Your task", "مهمتك")}
              action={
                <span className="text-subtle ltr-nums flex items-center gap-1 text-xs">
                  <Clock className="size-3.5" /> ~{task.minutes} {t.common.minutes}
                </span>
              }
            />
            <CardBody className="flex flex-col gap-4 text-sm">
              <p className="leading-relaxed">{pick(task, "scenario", locale)}</p>
              <p className="bg-sky-soft text-navy rounded-xl px-3 py-2 font-semibold dark:text-sky">{pick(task, "deliverable", locale)}</p>
              {!fb && <ExplorationForm slug={slug} />}
            </CardBody>
          </Card>
          {fb && attempt && (
            <Card>
              <CardHeader
                title={L("Feedback", "الملاحظات")}
                description={L("For your learning only — not shared with employers, not a hiring score.", "لتعلّمك فقط — لا تُشارك مع جهات التوظيف وليست درجة توظيف.")}
                action={<Badge tone={fb.source === "ai" ? "progress" : "neutral"}>{fb.source === "ai" ? t.common.aiGenerated : t.common.ruleBased}</Badge>}
              />
              <CardBody className="flex flex-col gap-5 text-sm">
                <p className="leading-relaxed">{fb.summary}</p>
                <ul className="flex flex-col gap-1.5" aria-label={L("Key points", "النقاط الرئيسية")}>
                  {criteria.map((c) => {
                    const ok = fb.covered.includes(c.key);
                    return (
                      <li key={c.key} className="flex items-start gap-2">
                        {ok ? <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" /> : <Circle className="text-subtle mt-0.5 size-4 shrink-0" />}
                        <span className={ok ? "" : "text-muted"}>{L(c.en, c.ar)}</span>
                      </li>
                    );
                  })}
                </ul>
                {fb.strengths.length > 0 && (
                  <div>
                    <p className="mb-1 font-bold">{L("Strengths", "نقاط القوة")}</p>
                    <ul className="text-muted list-disc space-y-1 ps-5">{fb.strengths.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                )}
                {fb.improvements.length > 0 && (
                  <div>
                    <p className="mb-1 font-bold">{L("To improve", "مجالات للتحسين")}</p>
                    <ul className="text-muted list-disc space-y-1 ps-5">{fb.improvements.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                )}
                <div>
                  <p className="mb-1 font-bold">{L("Suggested next steps", "خطوات مقترحة")}</p>
                  <ul className="text-muted list-disc space-y-1 ps-5">
                    {pickArray(task, "next_steps", locale).map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
                <details className="rounded-xl border p-3">
                  <summary className="cursor-pointer text-xs font-semibold">{L("Your response", "إجابتك")}</summary>
                  <p className="text-muted mt-2 whitespace-pre-wrap" dir="auto">{attempt.response}</p>
                </details>
                <div className="flex flex-wrap gap-3 border-t pt-3">
                  <Link href={`/candidate/discover/${slug}`} className="text-primary font-semibold dark:text-lavender">{L("Try again", "حاول مجددًا")}</Link>
                  <Link href="/candidate/career" className="text-primary font-semibold dark:text-lavender">{L("Development plan", "خطة التطوير")}</Link>
                  <Link href="/candidate/discover" className="text-primary font-semibold dark:text-lavender">{L("Other fields", "مجالات أخرى")}</Link>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
