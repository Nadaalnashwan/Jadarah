import Link from "next/link";
import { ArrowUpRight, Globe, Mail, MapPin, Phone } from "lucide-react";
import { CompanyBanner, CompanyIdentity, identityOf, ListingBadge } from "@/components/app/company-mark";
import type { Messages } from "@/lib/i18n/messages";
import { pick } from "@/lib/i18n/config";
import type { createClient } from "@/lib/supabase/server";
import { LISTED_JOB_FILTER } from "@/lib/domain/listings";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

const COMPANY_SELECT =
  "id, slug, name_en, name_ar, sector_en, sector_ar, organization_type, website, careers_url, description_en, description_ar, verification_status, contact_email, contact_phone, city, company_brand_profiles(identity_status, usage_permission, logo_source_url, primary_hex), company_identity(logo_path, cover_path, tagline_en, tagline_ar, primary_hex, secondary_hex, accent_hex)";

type DirectoryCompany = {
  website: string | null;
  careers_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  verification_status: string;
};

/**
 * Public contact actions, shown ONLY for verified information: the registry verified the organization
 * (verified_official) or its own admin published the details in JADARAH (employer identity configured).
 * Never invented, never personal; listing ≠ partnership.
 */
export function verifiedContacts(c: DirectoryCompany, selfPublished: boolean) {
  const verified = c.verification_status === "verified_official" || selfPublished;
  const safeUrl = (u: string | null) => (u && /^https:\/\/[^\s]+$/i.test(u) ? u : null);
  const email = c.contact_email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.contact_email) ? c.contact_email : null;
  const phone = c.contact_phone && /^\+?[0-9 ()-]{6,20}$/.test(c.contact_phone) ? c.contact_phone : null;
  return {
    website: verified ? safeUrl(c.website) : null,
    careers: verified ? safeUrl(c.careers_url) : null,
    email: verified ? email : null,
    phone: verified ? phone : null,
  };
}

/** Listed organizations with their published opportunity counts (RLS: public catalogue only). */
export async function loadDirectory(supabase: ServerSupabase) {
  const [{ data: companies }, { data: jobs }] = await Promise.all([
    supabase.from("company_profiles").select(COMPANY_SELECT).eq("listed", true).eq("status", "approved").order("name_en"),
    supabase.from("jobs").select("company_id").eq("status", "published").or(LISTED_JOB_FILTER),
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
    .select("id, title_en, title_ar, city, work_mode, experience_level, listing_type, created_by")
    .eq("company_id", company.id)
    .eq("status", "published")
    .or(LISTED_JOB_FILTER)
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
            {identityOf(c)?.[locale === "ar" ? "tagline_ar" : "tagline_en"] && (
              <p className="text-muted line-clamp-2 text-sm">{identityOf(c)?.[locale === "ar" ? "tagline_ar" : "tagline_en"]}</p>
            )}
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
  const selfPublished = !!identityOf(c);
  const contacts = verifiedContacts(c, selfPublished);
  const action =
    "border-border-strong hover:bg-surface-2 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold";
  return (
    <div className="flex flex-col gap-8">
      {selfPublished && <CompanyBanner company={c} locale={locale} className="min-h-36" />}
      <section className="surface-card flex flex-col gap-5 p-6 sm:p-8">
        <CompanyIdentity company={c} locale={locale} size="lg" heading />
        {description && <p className="text-muted max-w-2xl leading-relaxed">{description}</p>}
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          {(locale === "ar" ? c.sector_ar : c.sector_en) && (
            <div>
              <dt className="text-subtle text-xs">{L("Sector", "القطاع")}</dt>
              <dd className="font-semibold">{locale === "ar" ? c.sector_ar : c.sector_en}</dd>
            </div>
          )}
          {c.organization_type && (
            <div>
              <dt className="text-subtle text-xs">{L("Type", "النوع")}</dt>
              <dd className="font-semibold">{c.organization_type}</dd>
            </div>
          )}
          {c.city && (
            <div>
              <dt className="text-subtle text-xs">{L("Location", "الموقع")}</dt>
              <dd className="flex items-center gap-1 font-semibold">
                <MapPin className="size-3.5" /> {c.city}
              </dd>
            </div>
          )}
        </dl>
        {(contacts.website || contacts.careers || contacts.email || contacts.phone) && (
          <div className="flex flex-wrap gap-2" aria-label={L("Official contact", "قنوات التواصل الرسمية")}>
            {contacts.website && (
              <a href={contacts.website} target="_blank" rel="noopener noreferrer" className={action}>
                <Globe className="size-4" /> {L("Visit website", "زيارة الموقع")} <ArrowUpRight className="size-3.5" />
              </a>
            )}
            {contacts.careers && (
              <a href={contacts.careers} target="_blank" rel="noopener noreferrer" className={action}>
                <ArrowUpRight className="size-4" /> {L("Careers page", "صفحة التوظيف")}
              </a>
            )}
            {contacts.email && (
              <a href={`mailto:${contacts.email}`} className={action} dir="ltr">
                <Mail className="size-4" /> {contacts.email}
              </a>
            )}
            {contacts.phone && (
              <a href={`tel:${contacts.phone.replace(/[^+0-9]/g, "")}`} className={action} dir="ltr">
                <Phone className="size-4" /> {contacts.phone}
              </a>
            )}
          </div>
        )}
        <p className="text-subtle text-xs">
          {c.verification_status === "verified_official"
            ? L("Public information verified from official sources.", "معلومات عامة تم التحقق منها من مصادر رسمية.")
            : selfPublished
              ? L("Details published by the organization's own account on JADARAH.", "بيانات نشرها حساب الجهة نفسها على جدارة.")
              : L("Contact details are shown once verified.", "تُعرض بيانات التواصل بعد التحقق منها.")}{" "}
          {L(
            "Being listed does not mean a partnership with or endorsement by JADARAH.",
            "لا يعني الإدراج في الدليل شراكة مع جدارة أو تزكية منها.",
          )}
        </p>
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
                    <ListingBadge job={j} locale={locale} />
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
