import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, PageHeader, Progress } from "@/components/ui/primitives";
import { startCareerGoal } from "@/features/candidate/actions";
import { requireCandidate } from "@/lib/auth/session";
import { planProgress } from "@/lib/domain/career";
import { formatDate, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { MilestoneList } from "./milestones";

export default async function CareerPage() {
  const session = await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const [{ data: plan }, { data: templates }, { data: gap }, { data: skillNames }] = await Promise.all([
    supabase
      .from("development_plans")
      .select(
        "*, goal:career_goals(target_date, target_level), development_plan_items(*, resource:learning_resources(title_en, title_ar, provider, url, kind, duration_hours, link_verified_at))",
      )
      .eq("candidate_id", session.userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("development_plans")
      .select(
        "id, role_slug, title_en, title_ar, description_en, description_ar, estimated_weeks, target_level",
      )
      .eq("is_template", true)
      .order("title_en"),
    supabase
      .from("skill_gap_analyses")
      .select("analysis, method, created_at")
      .eq("candidate_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("skills").select("slug, name_en, name_ar"),
  ]);
  const nameOf = (slug: string) =>
    pick(
      (skillNames ?? []).find((s) => s.slug === slug),
      "name",
      locale,
    ) || slug;
  const analysis = gap?.analysis as
    { strong: string[]; developing: string[]; missing: string[]; coverage: number } | undefined;
  const items = (plan?.development_plan_items ?? []).sort((a, b) => a.position - b.position);
  const progress = planProgress(items);

  return (
    <>
      <PageHeader
        eyebrow={t.candidate.nav.career}
        title={plan ? pick(plan, "title", locale) : L("Choose where you want to go", "اختر وجهتك")}
        description={
          plan
            ? pick(plan, "description", locale)
            : L(
                "Pick a target role. We compare it with your current skills and build a plan with verified learning resources.",
                "اختر دورًا مستهدفًا. نقارنه بمهاراتك الحالية ونبني خطة بمصادر تعلّم موثّقة.",
              )
        }
      />
      {plan && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
          <div className="flex flex-col gap-6">
            <Card className="p-6">
              <p className="text-subtle text-xs font-semibold">{t.candidate.planProgress}</p>
              <p className="ltr-nums mt-1 text-5xl font-extrabold">{progress}%</p>
              <Progress value={progress} className="mt-3" />
              <p className="text-subtle mt-3 text-xs">
                {t.level[plan.target_level]} · <span className="ltr-nums">{plan.estimated_weeks}</span>{" "}
                {L("weeks", "أسبوعًا")}
                {plan.goal?.target_date &&
                  ` · ${L("target", "الهدف")} ${formatDate(plan.goal.target_date, locale)}`}
              </p>
            </Card>
            {analysis && (
              <Card>
                <CardHeader
                  title={L("Skill gap analysis", "تحليل فجوات المهارات")}
                  description={gap!.method === "ai" ? t.common.aiGenerated : t.common.ruleBased}
                />
                <CardBody className="flex flex-col gap-4 text-sm">
                  <div>
                    <p className="text-success mb-1.5 font-semibold">{L("Strong", "قوية")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.strong.length
                        ? analysis.strong.map((s) => (
                            <Badge key={s} tone="positive">
                              {nameOf(s)}
                            </Badge>
                          ))
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <p className="text-primary dark:text-lavender mb-1.5 font-semibold">
                      {L("Partially developed", "قيد التطوير")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.developing.length
                        ? analysis.developing.map((s) => (
                            <Badge key={s} tone="progress">
                              {nameOf(s)}
                            </Badge>
                          ))
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <p className="text-danger mb-1.5 font-semibold">{L("Missing", "مفقودة")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.missing.length
                        ? analysis.missing.map((s) => (
                            <Badge key={s} tone="negative">
                              {nameOf(s)}
                            </Badge>
                          ))
                        : "—"}
                    </div>
                  </div>
                  <p className="ltr-nums text-subtle text-xs">
                    {L("Coverage", "التغطية")}: {Math.round(analysis.coverage * 100)}%
                  </p>
                </CardBody>
              </Card>
            )}
          </div>
          <Card>
            <CardHeader
              title={t.landing.careerMilestones}
              description={L(
                "Mark progress as you go — your plan and skill map update.",
                "حدّث تقدّمك أولًا بأول — تتحدّث خطتك وخريطة مهاراتك.",
              )}
            />
            <CardBody>
              <MilestoneList
                items={items.map((i) => ({
                  id: i.id,
                  title: pick(i, "title", locale),
                  kind: i.kind,
                  status: i.status,
                  hours: i.estimated_hours,
                  skill: i.skill_slug ? nameOf(i.skill_slug) : null,
                  resource: i.resource
                    ? {
                        title: pick(i.resource, "title", locale),
                        provider: i.resource.provider,
                        url: i.resource.url,
                        verified: Boolean(i.resource.link_verified_at),
                      }
                    : null,
                }))}
              />
            </CardBody>
          </Card>
        </div>
      )}
      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold">
          {plan ? L("Switch target role", "تغيير الدور المستهدف") : L("Target roles", "الأدوار المستهدفة")}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(templates ?? []).map((tpl) => (
            <li key={tpl.id} className="surface-card flex flex-col p-5">
              <p className="font-bold">{pick(tpl, "title", locale)}</p>
              <p className="text-muted mt-1 flex-1 text-sm">{pick(tpl, "description", locale)}</p>
              <p className="ltr-nums text-subtle mt-3 text-xs">
                {tpl.estimated_weeks} {L("weeks", "أسبوعًا")} · {t.level[tpl.target_level]}
              </p>
              <form action={startCareerGoal.bind(null, tpl.id)} className="mt-4">
                <Button
                  size="sm"
                  variant={plan?.role_slug === tpl.role_slug ? "outline" : "primary"}
                  disabled={plan?.role_slug === tpl.role_slug}
                >
                  {plan?.role_slug === tpl.role_slug
                    ? L("Current goal", "هدفك الحالي")
                    : L("Set as my goal", "اجعله هدفي")}
                </Button>
              </form>
            </li>
          ))}
        </ul>
        <p className="text-subtle mt-4 flex items-center gap-1 text-xs">
          <ExternalLink className="size-3" />{" "}
          {L(
            "Learning links point to third-party providers; availability can change.",
            "روابط التعلّم تشير إلى جهات خارجية وقد يتغير توفرها.",
          )}
        </p>
      </section>
    </>
  );
}
