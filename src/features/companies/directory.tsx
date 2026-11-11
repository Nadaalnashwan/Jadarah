import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { CompanyIdentity, ListingBadge } from "@/components/app/company-mark";
import type { Messages } from "@/lib/i18n/messages";
import { pick } from "@/lib/i18n/config";
import type { createClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

const COMPANY_SELECT =
  "id, slug, name_en, name_ar, sector_en, sector_ar, organization_type, website, careers_url, description_en, description_ar, verification_status, company_brand_profiles(identity_status, usage_permission, logo_source_url, primary_hex)";

/** Listed organizations with their published opportunity counts (RLS: public catalogue only). */
export async function loadDirectory(supabase: ServerSupabase) {
  const [{ data: companies }, { data: jobs }] = await Promise.all([
    supabase.from("company_profiles").select(COMPANY_SELECT).eq("listed", true).eq("status", "approved").order("name_en"),
    supabase.from("jobs").select("company_id").eq("status", "published"),
  ]);
  const count = new Map<string, number>();
  for (const j of jobs ?? []) count.set(j.company_id, (count.get(j.company_id) ?? 0) + 1);
  return (companies ?? []).map((c) => ({ ...c, openings: count.get(c.id) ?? 0 }));
}

export async function loadCompany(supabase: ServerSupabase, slug: string) {
  const { data: company } = await supabase.from("company_profiles").select(COMPANY_SELECT).eq("slug", slug).eq("listed", true).maybeSingle();
  if (!company) return null;
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title_en, title_ar, city, work_mode, experience_level, listing_type")
    .eq("company_id", company.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return { company, jobs: jobs ?? [] };
}

export function CompanyGrid({
  companies,
  locale,
  hrefBase,
}: {
  companies: Awaited<ReturnType<typeof loadDirectory>>;
  locale: "ar" | "en";
  hrefBase: string;
}) {
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {companies.map((c) => (
        <li key={c.id}>
          <Link
            href={`${hrefBase}/${c.slug}`}
            className="surface-card hover:border-primary/40 flex h-full flex-col gap-4 p-5 transition hover:-translate-y-0.5"
          >
            <CompanyIdentity company={c} locale={locale} />
            <p className="text-muted mt-auto text-sm">
              <span className="ltr-nums font-bold">{c.openings}</span> {L("opportunities", "فرص")}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CompanyProfile({
  data,
  locale,
  t,
  jobHref,
}: {
  data: NonNullable<Awaited<ReturnType<typeof loadCompany>>>;
  locale: "ar" | "en";
  t: Messages;
  jobHref: (id: string) => string;
}) {
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const { company: c, jobs } = data;
  const description = pick(c, "description", locale);
  return (
    <div className="flex flex-col gap-8">
      <section className="surface-card flex flex-col gap-5 p-6 sm:p-8">
        <CompanyIdentity company={c} locale={locale} size="lg" />
        {description && <p className="text-muted max-w-2xl leading-relaxed">{description}</p>}
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          {c.organization_type && (
            <div>
              <dt className="text-subtle text-xs">{L("Type", "النوع")}</dt>
              <dd className="font-semibold">{c.organization_type}</dd>
            </div>
          )}
          {c.website && (
            <div>
              <dt className="text-subtle text-xs">{L("Official website", "الموقع الرسمي")}</dt>
              <dd>
                <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-primary dark:text-lavender inline-flex items-center gap-1 font-semibold" dir="ltr">
                  {c.website.replace(/^https?:\/\//, "")} <ArrowUpRight className="size-3.5" />
                </a>
              </dd>
            </div>
          )}
          {c.careers_url && (
            <div>
              <dt className="text-subtle text-xs">{L("Careers", "التوظيف")}</dt>
              <dd>
                <a href={c.careers_url} target="_blank" rel="noopener noreferrer" className="text-primary dark:text-lavender inline-flex items-center gap-1 font-semibold" dir="ltr">
                  {c.careers_url.replace(/^https?:\/\//, "").replace(/\/$/, "")} <ArrowUpRight className="size-3.5" />
                </a>
              </dd>
            </div>
          )}
        </dl>
      </section>
      <section>
        <h2 className="mb-4 text-lg font-bold">{L("Opportunities", "الفرص")}</h2>
        {jobs.length === 0 ? (
          <p className="text-muted text-sm">{L("No open opportunities.", "لا توجد فرص متاحة.")}</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link href={jobHref(j.id)} className="surface-card hover:border-primary/40 block p-4 transition">
                  <p className="font-bold">{pick(j, "title", locale)}</p>
                  <p className="text-muted mt-1 flex flex-wrap items-center gap-1 text-xs">
                    <MapPin className="size-3.5" /> {j.city} · {t.workMode[j.work_mode]} · {t.level[j.experience_level]}{" "}
                    <ListingBadge type={j.listing_type} locale={locale} />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
