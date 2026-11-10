import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { pick, pickArray, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function PublicJob({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: j } = await supabase
    .from("jobs")
    .select(
      "*, company:company_profiles(name_en, name_ar, description_en, description_ar), job_skills(importance, min_level, skill:skills(name_en, name_ar))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!j) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 pt-32 pb-24 sm:px-6">
      <p className="text-subtle text-sm font-semibold">{pick(j.company, "name", locale)}</p>
      <h1 className="editorial mt-2 text-4xl font-extrabold">{pick(j, "title", locale)}</h1>
      <p className="text-muted mt-3 text-sm">
        {j.city} · {t.workMode[j.work_mode]} · {t.employmentType[j.employment_type]} ·{" "}
        {t.level[j.experience_level]}
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
      <div className="mt-10 flex gap-3">
        <Button asChild size="lg">
          <Link href={`/sign-in?next=/candidate/jobs/${j.id}`}>
            {L("Sign in to apply", "سجّل الدخول للتقديم")}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/sign-up?type=candidate">{t.auth.signUp}</Link>
        </Button>
      </div>
    </article>
  );
}
