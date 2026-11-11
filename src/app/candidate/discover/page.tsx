import Link from "next/link";
import { GroupTabs } from "@/components/shell/group-tabs";
import { ArrowUpRight, Compass, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireCandidate } from "@/lib/auth/session";
import { formatDate, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { loadDiscovery } from "@/services/discovery";

const SOURCE: Record<string, [string, string]> = {
  cv: ["from your CV", "من سيرتك"],
  self: ["self-reported", "مُصرَّح بها"],
  assessment: ["assessment evidence", "دليل من تقييم"],
  verified: ["verified", "موثّقة"],
};

export default async function DiscoverPage() {
  const session = await requireCandidate();
  const { locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const d = await loadDiscovery(supabase, session.userId, locale);
  return (
    <>
      <GroupTabs group="candidate-career" />
      <PageHeader
        eyebrow={L("Career discovery", "اكتشاف المسار")}
        title={L("Try the field before you choose it", "جرّب المجال قبل تختاره")}
        description={L(
          "Fields that fit what your profile shows, why they fit, what's missing — and a short real-world task to feel what the work is like.",
          "مجالات تناسب ما يُظهره ملفك، ولماذا تناسبك، وما ينقصك، ومهمة قصيرة واقعية لتعيش طبيعة العمل.",
        )}
      />
      <section className="mb-8" aria-labelledby="rec-title">
        <h2 id="rec-title" className="mb-3 flex items-center gap-2 font-bold">
          <Compass className="text-primary size-5 dark:text-lavender" /> {L("Recommended for you", "مقترحة لك")}
        </h2>
        {d.recommendations.length === 0 ? (
          <Card>
            <CardBody className="text-muted flex flex-wrap items-center justify-between gap-3 text-sm">
              {d.hasSkills
                ? L("Your current skills don't overlap with the fields that have open roles yet. Explore any field below.", "لا تتقاطع مهاراتك الحالية بعد مع المجالات التي لديها وظائف متاحة. استكشف أي مجال أدناه.")
                : L("Add skills (or upload your CV) to get recommendations based on your profile.", "أضف مهاراتك (أو ارفع سيرتك) لتحصل على اقتراحات مبنية على ملفك.")}
              <Button asChild size="sm" variant="outline">
                <Link href="/candidate/cvs">{L("Upload CV", "رفع السيرة")}</Link>
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {d.recommendations.map((r) => {
              const task = d.taskByCategory.get(r.slug);
              return (
                <Card key={r.slug}>
                  <CardHeader
                    title={r.name}
                    description={
                      r.matched.length
                        ? L(
                            `You already have ${r.matched.length} of the skills open roles in this field ask for.`,
                            `لديك ${r.matched.length} من المهارات التي تطلبها الوظائف المتاحة في هذا المجال.`,
                          )
                        : L("Matches an interest in your profile.", "يطابق اهتمامًا مذكورًا في ملفك.")
                    }
                    action={r.interest ? <Badge tone="info">{L("Your interest", "من اهتماماتك")}</Badge> : undefined}
                  />
                  <CardBody className="flex flex-col gap-4 pt-4 text-sm">
                    {r.matched.length > 0 && (
                      <div>
                        <p className="text-subtle mb-1.5 text-xs font-semibold">{L("Relevant skills you have", "مهارات لديك ذات صلة")}</p>
                        <ul className="flex flex-wrap gap-1.5">
                          {r.matched.map((m) => (
                            <li key={m.name}>
                              <Badge tone="positive">
                                {m.name} <span className="opacity-70">· {L(...(SOURCE[m.source] ?? [m.source, m.source]))}</span>
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {r.missing.length > 0 && (
                      <div>
                        <p className="text-subtle mb-1.5 text-xs font-semibold">{L("Skills to develop", "مهارات تحتاج تطويرها")}</p>
                        <ul className="flex flex-wrap gap-1.5">
                          {r.missing.map((m) => (
                            <li key={m}>
                              <Badge tone="neutral">{m}</Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {r.jobs.length > 0 && (
                      <div>
                        <p className="text-subtle mb-1.5 text-xs font-semibold">{L("Related open jobs", "وظائف متاحة ذات صلة")}</p>
                        <ul className="flex flex-col gap-1">
                          {r.jobs.map((j) => (
                            <li key={j.id}>
                              <Link href={`/candidate/jobs/${j.id}`} className="text-primary inline-flex items-center gap-1 font-semibold dark:text-lavender">
                                {j.title} <ArrowUpRight className="size-3.5" />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      {task && (
                        <Button asChild size="sm">
                          <Link href={`/candidate/discover/${task.slug}`}>
                            <FlaskConical /> {L("Try a role task", "جرّب مهمة الدور")}
                          </Link>
                        </Button>
                      )}
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/candidate/jobs?category=${r.slug}`}>{L("Browse jobs", "تصفح الوظائف")}</Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link href="/candidate/career">{L("Build a development plan", "ابنِ خطة تطوير")}</Link>
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-8" aria-labelledby="fields-title">
        <h2 id="fields-title" className="mb-3 font-bold">{L("Explore every field", "استكشف كل المجالات")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {d.fields.map((f) => (
            <li key={f.slug} className="surface-card flex flex-col gap-2 p-4">
              <p className="font-semibold">{f.name}</p>
              <p className="text-subtle ltr-nums text-xs">
                {f.openJobs} {L("open jobs", "وظائف متاحة")}
                {f.task && <> · {f.task.minutes} {L("min task", "دقيقة للمهمة")}</>}
              </p>
              {f.task && (
                <Link href={`/candidate/discover/${f.task.slug}`} className="text-primary mt-auto text-sm font-semibold dark:text-lavender">
                  {f.task.title} →
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      {d.attempts.length > 0 && (
        <Card>
          <CardHeader title={L("Your exploratory tasks", "مهامك الاستكشافية")} description={L("Private to you — never shared with employers.", "خاصة بك — لا تُشارك مع أي جهة توظيف.")} />
          <CardBody>
            <ul className="flex flex-col gap-2 text-sm">
              {d.attempts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3">
                  <Link href={`/candidate/discover/${a.task?.slug}?attempt=${a.id}`} className="font-semibold hover:underline">
                    {pick(a.task, "title", locale)}
                  </Link>
                  <span className="text-subtle text-xs">{formatDate(a.submitted_at ?? a.created_at, locale)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </>
  );
}
