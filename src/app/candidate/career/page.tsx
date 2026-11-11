import Link from "next/link";
import { GroupTabs } from "@/components/shell/group-tabs";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, KpiCard, PageHeader } from "@/components/ui/primitives";
import { startCareerGoal } from "@/features/candidate/actions";
import { requireCandidate } from "@/lib/auth/session";
import { planProgress } from "@/lib/domain/career";
import { formatDate, formatNumber, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getCandidateSkills } from "@/services/candidate";
import { MilestoneList } from "./milestones";

export default async function CareerPage() {
  const session = await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const [
    { data: plan },
    { data: templates },
    { data: gap },
    { data: skillNames },
    mySkills,
    { data: results },
  ] = await Promise.all([
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
      .select("analysis, method, provider, created_at")
      .eq("candidate_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("skills").select("slug, name_en, name_ar"),
    getCandidateSkills(supabase, session.userId),
    supabase
      .from("assessment_assignments")
      .select(
        "id, assessment:assessments(title_en, title_ar), assessment_submissions(percentage, status, needs_review, submitted_at)",
      )
      .eq("candidate_id", session.userId)
      .in("status", ["submitted", "evaluated"])
      .order("created_at", { ascending: false })
      .limit(6),
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

  // Requirements of the target role, each classified by the evidence the candidate actually has.
  type Req = {
    slug: string;
    name: string;
    status: "demonstrated" | "cv" | "self" | "missing";
    level: number | null;
  };
  const bySlug = new Map(mySkills.filter((s) => s.skill).map((s) => [s.skill!.slug, s]));
  const reqs: Req[] = ((plan?.required_skill_slugs as string[] | null) ?? []).map((slug) => {
    const s = bySlug.get(slug);
    const status = !s
      ? "missing"
      : s.source === "assessment" || s.source === "verified"
        ? "demonstrated"
        : s.source === "cv"
          ? "cv"
          : "self";
    return { slug, name: nameOf(slug), status, level: s?.level ?? null };
  });
  const REQ_LABEL = {
    demonstrated: [L("Demonstrated", "مُثبتة"), "positive"],
    cv: [L("CV claim — not yet demonstrated", "ادعاء من السيرة — لم يُثبت بعد"), "info"],
    self: [L("Self-declared — not yet demonstrated", "تصريح ذاتي — لم يُثبت بعد"), "neutral"],
    missing: [L("Missing", "مفقودة"), "negative"],
  } as const;
  const priorities = [
    ...reqs.filter((r) => r.status === "missing"),
    ...reqs.filter((r) => r.status === "self" || r.status === "cv"),
  ];
  const demonstrated = reqs.filter((r) => r.status === "demonstrated").length;
  const scored = (results ?? []).filter((r) => r.assessment_submissions);
  const aiSummary =
    gap?.method === "ai" ? (analysis as { summary_en?: string; summary_ar?: string } | undefined) : undefined;

  return (
    <>
      <GroupTabs group="candidate-career" />
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
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              tone="blue"
              label={L("Role requirements demonstrated", "متطلبات الدور المُثبتة")}
              value={
                reqs.length
                  ? `${formatNumber(demonstrated, locale)}/${formatNumber(reqs.length, locale)}`
                  : "—"
              }
              hint={L("Shown in an assessment or verified by a reviewer", "ظهرت في تقييم أو تحقق منها مراجع")}
            />
            <KpiCard
              tone="peach"
              label={L("Development priorities", "أولويات التطوير")}
              value={formatNumber(priorities.length, locale)}
              hint={L("Missing or not yet demonstrated", "مفقودة أو لم تُثبت بعد")}
            />
            <KpiCard
              tone="sage"
              label={t.candidate.planProgress}
              value={`${formatNumber(progress, locale)}%`}
              hint={`${t.level[plan.target_level]} · ${formatNumber(plan.estimated_weeks, locale)} ${L("weeks", "أسبوعًا")}${
                plan.goal?.target_date
                  ? ` · ${L("target", "الهدف")} ${formatDate(plan.goal.target_date, locale)}`
                  : ""
              }`}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader
                title={L("1 · What the role requires", "1 · ما يتطلبه الدور")}
                description={L(
                  "Each essential skill and the evidence you have for it today.",
                  "كل مهارة أساسية والدليل المتوفر لديك عليها اليوم.",
                )}
              />
              <CardBody>
                {reqs.length === 0 ? (
                  <p className="text-subtle text-sm">
                    {L("This plan lists no required skills.", "لا تحدد هذه الخطة مهارات مطلوبة.")}
                  </p>
                ) : (
                  <ul className="divide-border divide-y">
                    {reqs.map((r) => (
                      <li key={r.slug} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <span className="font-semibold">{r.name}</span>
                        <span className="flex items-center gap-2">
                          {r.level !== null && (
                            <span className="ltr-nums text-subtle text-xs">{r.level}/5</span>
                          )}
                          <Badge tone={REQ_LABEL[r.status][1]}>{REQ_LABEL[r.status][0]}</Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-subtle mt-3 text-xs">
                  <Link href="/candidate/skills" className="text-primary font-semibold">
                    {L("Manage my skills", "إدارة مهاراتي")}
                  </Link>
                </p>
              </CardBody>
            </Card>
            <div className="flex flex-col gap-6">
              <Card tone="peach">
                <CardHeader title={L("2 · Development priorities", "2 · أولويات التطوير")} />
                <CardBody>
                  {priorities.length === 0 ? (
                    <p className="text-sm">
                      {L("Every requirement is demonstrated.", "كل المتطلبات مُثبتة.")}
                    </p>
                  ) : (
                    <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-sm">
                      {priorities.map((r) => (
                        <li key={r.slug}>
                          <span className="font-semibold">{r.name}</span>{" "}
                          <span className="text-subtle text-xs">
                            —{" "}
                            {r.status === "missing"
                              ? L("learn it", "تعلّمها")
                              : L("demonstrate it in a practical assessment", "أثبتها في تقييم عملي")}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardBody>
              </Card>
              <Card tone="sage">
                <CardHeader
                  title={L("3 · Assessment results", "3 · نتائج التقييمات")}
                  description={L(
                    "Scores appear after a person reviews your answers.",
                    "تظهر الدرجات بعد مراجعة شخص لإجاباتك.",
                  )}
                />
                <CardBody>
                  {scored.length === 0 ? (
                    <p className="text-sm">
                      {L("No submitted assessments yet.", "لا توجد تقييمات مُسلّمة بعد.")}
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2 text-sm">
                      {scored.map((r) => {
                        const sub = r.assessment_submissions!;
                        return (
                          <li key={r.id} className="flex items-center justify-between gap-2">
                            <Link
                              href={`/candidate/assessments/${r.id}`}
                              className="min-w-0 truncate font-semibold hover:underline"
                            >
                              {pick(r.assessment, "title", locale)}
                            </Link>
                            {sub.needs_review || sub.percentage === null ? (
                              <Badge tone="progress">{L("Under human review", "قيد المراجعة البشرية")}</Badge>
                            ) : (
                              <span className="ltr-nums font-extrabold">
                                {formatNumber(sub.percentage, locale)}%
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader
              title={L("4 · Recommended actions", "4 · الإجراءات المقترحة")}
              description={L(
                "Your plan's milestones. Mark progress as you go.",
                "مراحل خطتك. حدّث تقدّمك أولًا بأول.",
              )}
            />
            <CardBody className="flex flex-col gap-4">
              {aiSummary?.summary_en && (
                <div className="bg-tone-lilac/60 rounded-2xl p-3 text-sm leading-relaxed" dir="auto">
                  <Badge tone="muted" className="mb-1.5">
                    {t.common.aiGenerated}
                  </Badge>
                  <p>{locale === "ar" ? aiSummary.summary_ar : aiSummary.summary_en}</p>
                  <p className="text-subtle mt-1 text-[11px]">
                    {L(
                      "AI suggestion based on your gap analysis — not a human assessment of your ability.",
                      "اقتراح آلي مبني على تحليل فجواتك — وليس تقييمًا بشريًا لقدراتك.",
                    )}
                  </p>
                </div>
              )}
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
