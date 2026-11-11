import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyIdentity, ListingBadge } from "@/components/app/company-mark";
import { Button } from "@/components/ui/button";
import { TaskPreviewCard, type TaskPreview } from "@/components/app/task-preview";
import { Badge } from "@/components/ui/primitives";
import { getSession, homeFor } from "@/lib/auth/session";
import { pick, pickArray, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { isPracticeListing } from "@/lib/domain/listings";

export default async function PublicJob({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: j } = await supabase
    .from("jobs")
    .select(
      "*, company:company_profiles(id, slug, name_en, name_ar, sector_en, sector_ar, organization_type, website, description_en, description_ar, company_brand_profiles(identity_status, usage_permission, logo_source_url, primary_hex), company_identity(logo_path, cover_path, tagline_en, tagline_ar, primary_hex, secondary_hex, accent_hex)), job_skills(importance, min_level, skill:skills(name_en, name_ar))",
    )
    .eq("id", id)
    .maybeSingle();
  // Imported practice scenarios are not vacancies and are never presented as opportunities.
  if (!j || isPracticeListing(j)) notFound();
  const [session, { data: preview }] = await Promise.all([
    getSession(),
    supabase.rpc("job_task_preview", { p_job: id }),
  ]);
  return (
    <article className="mx-auto max-w-3xl px-4 pt-32 pb-24 sm:px-6">
      {j.company && (
        <Link href={`/companies/${j.company.slug}`} className="inline-block">
          <CompanyIdentity company={j.company} locale={locale} />
        </Link>
      )}
      <h1 className="editorial mt-2 text-4xl font-extrabold">{pick(j, "title", locale)}</h1>
      <p className="text-muted mt-3 text-sm">
        {j.city} · {t.workMode[j.work_mode]} · {t.employmentType[j.employment_type]} ·{" "}
        {t.level[j.experience_level]} <ListingBadge job={j} locale={locale} />
      </p>
      <p className="text-muted mt-8 leading-relaxed">{pick(j, "description", locale)}</p>
      <h2 className="mt-8 font-bold">{L("Responsibilities", "المسؤوليات")}</h2>
      <ul className="text-muted mt-2 list-disc space-y-1 ps-5">
        {pickArray(j, "responsibilities", locale).map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <h2 className="mt-8 font-bold">{L("Skills", "المهارات")}</h2>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {j.job_skills.map((s, i) => (
          <Badge key={i} tone={s.importance === "required" ? "progress" : "neutral"}>
            {pick(s.skill, "name", locale)} · L{s.min_level}
          </Badge>
        ))}
      </div>
      {preview && (
        <div className="mt-8">
          <TaskPreviewCard task={preview as TaskPreview} locale={locale} />
        </div>
      )}
      <div className="mt-10 flex gap-3">
        {session?.isCandidate ? (
          <Button asChild size="lg">
            <Link href={`/candidate/jobs/${j.id}`}>{L("Apply for this job", "تقديم على الوظيفة")}</Link>
          </Button>
        ) : session ? (
          <Button asChild size="lg" variant="outline">
            <Link href={homeFor(session)}>{L("Dashboard", "لوحة التحكم")}</Link>
          </Button>
        ) : (
          <>
            <Button asChild size="lg">
              <Link href={`/sign-in?next=/candidate/jobs/${j.id}`}>
                {L("Sign in to apply", "سجّل الدخول للتقديم")}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/sign-up?type=candidate">{t.auth.signUp}</Link>
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
