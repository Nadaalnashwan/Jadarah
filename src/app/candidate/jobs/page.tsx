import Link from "next/link";
import { Bookmark, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/form";
import { CompanyIdentity, ListingBadge } from "@/components/app/company-mark";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireCandidate } from "@/lib/auth/session";
import { formatDate, formatNumber, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getCandidateSkills, JOB_LIST_SELECT, matchJob, toSkillRecords } from "@/services/candidate";
import { SaveJobButton } from "./save-button";

type SP = {
  q?: string;
  category?: string;
  city?: string;
  mode?: string;
  type?: string;
  level?: string;
  skill?: string;
  saved?: string;
  sort?: string;
  page?: string;
};
const PAGE = 12;

export default async function JobsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const session = await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();

  let query = supabase.from("jobs").select(JOB_LIST_SELECT).eq("status", "published");
  if (sp.q)
    query = query.or(
      `title_en.ilike.%${sp.q.replace(/[%,()]/g, "")}%,title_ar.ilike.%${sp.q.replace(/[%,()]/g, "")}%`,
    );
  if (sp.city) query = query.eq("city", sp.city);
  if (sp.mode) query = query.eq("work_mode", sp.mode as "remote");
  if (sp.type) query = query.eq("employment_type", sp.type as "full_time");
  if (sp.level) query = query.eq("experience_level", sp.level as "mid");
  const [
    { data: rawJobs },
    { data: categories },
    { data: saved },
    skills,
    { data: cp },
    { data: allSkills },
  ] = await Promise.all([
    query.order("published_at", { ascending: false }).limit(200),
    supabase.from("job_categories").select("slug, name_en, name_ar").order("name_en"),
    supabase.from("saved_jobs").select("job_id").eq("candidate_id", session.userId),
    getCandidateSkills(supabase, session.userId),
    supabase
      .from("candidate_profiles")
      .select("years_experience")
      .eq("user_id", session.userId)
      .maybeSingle(),
    supabase.from("skills").select("slug, name_en, name_ar").order("name_en"),
  ]);
  const savedSet = new Set((saved ?? []).map((s) => s.job_id));
  const records = toSkillRecords(skills);
  let jobs = (rawJobs ?? []).map((j) => ({
    ...j,
    match: matchJob(j, records, cp?.years_experience ?? null, locale),
  }));
  if (sp.category) jobs = jobs.filter((j) => j.category?.slug === sp.category);
  if (sp.skill) jobs = jobs.filter((j) => j.job_skills.some((s) => s.skill?.slug === sp.skill));
  if (sp.saved === "1") jobs = jobs.filter((j) => savedSet.has(j.id));
  if (sp.sort !== "recent") jobs.sort((a, b) => b.match.score - a.match.score);
  const cities = [...new Set((rawJobs ?? []).map((j) => j.city))].sort();
  const page = Math.max(1, Number(sp.page ?? 1));
  const total = jobs.length;
  const slice = jobs.slice((page - 1) * PAGE, page * PAGE);
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams(
      Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][],
    );
    return `?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        eyebrow={t.candidate.nav.jobs}
        title={L("Find work that fits what you can do", "اعثر على عمل يناسب ما تستطيع فعله")}
      />
      <form
        className="surface-card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8"
        role="search"
      >
        <Input
          name="q"
          defaultValue={sp.q}
          placeholder={L("Job title…", "المسمى الوظيفي…")}
          aria-label={t.common.search}
          className="xl:col-span-2"
        />
        <Select name="category" defaultValue={sp.category ?? ""} aria-label={L("Industry / field", "المجال")}>
          <option value="">{L("All fields", "كل المجالات")}</option>
          {(categories ?? []).map((c) => (
            <option key={c.slug} value={c.slug}>
              {pick(c, "name", locale)}
            </option>
          ))}
        </Select>
        <Select name="city" defaultValue={sp.city ?? ""} aria-label={L("Location", "الموقع")}>
          <option value="">{L("All locations", "كل المواقع")}</option>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select name="level" defaultValue={sp.level ?? ""} aria-label={L("Experience", "الخبرة")}>
          <option value="">{L("Any experience", "أي خبرة")}</option>
          {(["entry", "junior", "mid", "senior", "lead"] as const).map((l) => (
            <option key={l} value={l}>
              {t.level[l]}
            </option>
          ))}
        </Select>
        <Select name="type" defaultValue={sp.type ?? ""} aria-label={L("Employment type", "نوع التوظيف")}>
          <option value="">{L("Any type", "أي نوع")}</option>
          {(["full_time", "part_time", "contract", "internship", "temporary"] as const).map((v) => (
            <option key={v} value={v}>
              {t.employmentType[v]}
            </option>
          ))}
        </Select>
        <Select name="skill" defaultValue={sp.skill ?? ""} aria-label={L("Skill", "مهارة")}>
          <option value="">{L("Any skill", "أي مهارة")}</option>
          {(allSkills ?? []).map((s) => (
            <option key={s.slug} value={s.slug}>
              {pick(s, "name", locale)}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            {t.common.filter}
          </Button>
          <Button
            asChild
            variant={sp.saved === "1" ? "primary" : "outline"}
            size="icon"
            aria-label={L("Saved jobs", "الوظائف المحفوظة")}
          >
            <Link href={qs({ saved: sp.saved === "1" ? undefined : "1", page: undefined })}>
              <Bookmark />
            </Link>
          </Button>
        </div>
      </form>

      <div className="text-muted mb-4 flex items-center justify-between text-sm">
        <span className="ltr-nums">
          {formatNumber(total, locale)} {t.common.results}
        </span>
        <span className="flex gap-1">
          <Link
            href={qs({ sort: undefined })}
            className={sp.sort !== "recent" ? "text-foreground font-bold" : ""}
          >
            {L("Best match", "الأنسب")}
          </Link>
          ·
          <Link
            href={qs({ sort: "recent" })}
            className={sp.sort === "recent" ? "text-foreground font-bold" : ""}
          >
            {L("Most recent", "الأحدث")}
          </Link>
        </span>
      </div>

      {slice.length === 0 ? (
        <Card>
          <EmptyState
            title={L("No jobs match these filters", "لا توجد وظائف تطابق هذه المرشحات")}
            action={
              <Button asChild variant="outline">
                <Link href="/candidate/jobs">{L("Clear filters", "مسح المرشحات")}</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {slice.map((j) => (
            <li
              key={j.id}
              className="surface-card group hover:border-primary/40 relative flex flex-col p-5 transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {j.company && <CompanyIdentity company={j.company} locale={locale} size="sm" showSector={false} />}
                  <Link
                    href={`/candidate/jobs/${j.id}`}
                    className="group-hover:text-primary dark:group-hover:text-lavender mt-3 block text-lg leading-snug font-bold after:absolute after:inset-0"
                  >
                    {pick(j, "title", locale)}
                  </Link>
                </div>
                <div className="relative z-10">
                  <SaveJobButton jobId={j.id} saved={savedSet.has(j.id)} />
                </div>
              </div>
              <p className="text-muted mt-2 flex flex-wrap items-center gap-1 text-xs">
                <MapPin className="size-3.5" /> {j.city} · {t.workMode[j.work_mode]} ·{" "}
                {t.employmentType[j.employment_type]} <ListingBadge type={j.listing_type} locale={locale} />
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {j.match.requirements.slice(0, 4).map((r) => (
                  <Badge
                    key={r.skill_id}
                    tone={r.status === "matched" ? "positive" : r.status === "missing" ? "muted" : "progress"}
                  >
                    {r.name}
                  </Badge>
                ))}
              </div>
              <div className="mt-auto flex items-end justify-between pt-5">
                <div>
                  <p className="text-subtle text-[0.7rem] font-semibold">{t.match.score}</p>
                  <p className="ltr-nums text-2xl font-extrabold">
                    {j.match.score}
                    <span className="text-subtle text-sm">/100</span>
                  </p>
                </div>
                <p className="text-subtle text-xs">
                  {j.deadline ? `${L("Apply by", "قدّم قبل")} ${formatDate(j.deadline, locale)}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {total > PAGE && (
        <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
          <Button
            asChild
            variant="outline"
            size="sm"
            className={page <= 1 ? "pointer-events-none opacity-40" : ""}
          >
            <Link href={qs({ page: String(page - 1) })}>{t.common.previous}</Link>
          </Button>
          <span className="ltr-nums text-muted text-sm">
            {page} / {Math.ceil(total / PAGE)}
          </span>
          <Button
            asChild
            variant="outline"
            size="sm"
            className={page * PAGE >= total ? "pointer-events-none opacity-40" : ""}
          >
            <Link href={qs({ page: String(page + 1) })}>{t.common.next}</Link>
          </Button>
        </nav>
      )}
    </>
  );
}
