import {
  Antenna,
  BrainCircuit,
  Building2,
  Coins,
  Factory,
  Landmark,
  Laptop,
  PartyPopper,
  Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { brandVars, identityImageUrl, type CompanyIdentityRow } from "@/lib/brand";
import { listingProvenance } from "@/lib/domain/listings";

/**
 * Organization identity. Two sources, in order:
 *  1. company_identity — managed by the organization's own admin inside JADARAH (logo, cover, colours);
 *  2. company_brand_profiles — registry branding shown ONLY when verified and usage is granted.
 * Otherwise a neutral JADARAH tile with a generic SECTOR symbol is used — never an imitation of a logo.
 */
export type BrandInfo = {
  identity_status?: string | null;
  usage_permission?: string | null;
  logo_source_url?: string | null;
  primary_hex?: string | null;
} | null;

export type CompanyLike = {
  name_en: string;
  name_ar: string;
  sector_en?: string | null;
  sector_ar?: string | null;
  organization_type?: string | null;
  company_brand_profiles?: BrandInfo | BrandInfo[];
  company_identity?: CompanyIdentityRow | CompanyIdentityRow[];
};

export function identityOf(c: CompanyLike | null | undefined): CompanyIdentityRow {
  const v = c?.company_identity;
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

/** Scoped CSS variables for this company's colours (JADARAH fallback). Apply on a wrapper element only. */
export function companyScopeStyle(c: CompanyLike | null | undefined): React.CSSProperties {
  return brandVars(identityOf(c)) as React.CSSProperties;
}

function sectorKey(c: CompanyLike) {
  const s = `${c.sector_en ?? ""} ${c.organization_type ?? ""}`.toLowerCase();
  if (/artificial|data|\bai\b/.test(s)) return "ai";
  if (/telecom/.test(s)) return "telecom";
  if (/digital|software|technology/.test(s)) return "digital";
  if (/entertain|event|culture/.test(s)) return "events";
  if (/coastal|marine|tourism|sea/.test(s)) return "coastal";
  if (/petro|manufactur|industrial|chemical/.test(s) && !/financ/.test(s)) return "industry";
  if (/financ|fund|bank|budget/.test(s)) return "finance";
  if (/urban|heritage|construction|real estate/.test(s)) return "urban";
  if (/ministry|authority|regulat|government|trade/.test(s)) return "public";
  return "other";
}

/** Generic sector symbol (not an organization logo). */
function SectorGlyph({ company }: { company: CompanyLike }) {
  switch (sectorKey(company)) {
    case "ai":
      return <BrainCircuit />;
    case "telecom":
      return <Antenna />;
    case "digital":
      return <Laptop />;
    case "events":
      return <PartyPopper />;
    case "coastal":
      return <Waves />;
    case "industry":
      return <Factory />;
    case "finance":
      return <Coins />;
    case "public":
      return <Landmark />;
    default:
      return <Building2 />;
  }
}

export function brandOf(c: CompanyLike): BrandInfo {
  const b = c.company_brand_profiles;
  return Array.isArray(b) ? (b[0] ?? null) : (b ?? null);
}

/** Usage is authorised only when identity is verified AND permission granted. */
export function brandAuthorised(b: BrandInfo) {
  return Boolean(b && b.identity_status === "verified" && b.usage_permission === "granted");
}

const SIZE = { sm: "size-9 rounded-xl [&_svg]:size-4", md: "size-12 rounded-2xl [&_svg]:size-5", lg: "size-16 rounded-2xl [&_svg]:size-7" };

export function CompanyMark({ company, size = "md", className }: { company: CompanyLike; size?: keyof typeof SIZE; className?: string }) {
  const own = identityOf(company);
  const ownLogo = identityImageUrl(own?.logo_path);
  if (ownLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logo published by the organization's own admin
      <img src={ownLogo} alt="" className={cn("shrink-0 bg-white object-contain p-1", SIZE[size], className)} />
    );
  }
  const b = brandOf(company);
  if (brandAuthorised(b) && b?.logo_source_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- authorised external brand asset
      <img src={b.logo_source_url} alt="" className={cn("bg-white object-contain p-1.5", SIZE[size], className)} />
    );
  }
  const accent = own?.primary_hex ?? (brandAuthorised(b) && b?.primary_hex ? b.primary_hex : undefined);
  return (
    <span
      aria-hidden
      className={cn("ink text-primary-ink flex shrink-0 items-center justify-center", SIZE[size], className)}
      style={accent ? { backgroundColor: accent, color: "#fff" } : undefined}
    >
      <SectorGlyph company={company} />
    </span>
  );
}

export function CompanyIdentity({
  company,
  locale,
  size = "md",
  showSector = true,
  heading = false,
  className,
}: {
  company: CompanyLike;
  locale: "ar" | "en";
  size?: keyof typeof SIZE;
  showSector?: boolean;
  /** Render the name as the page heading (profile pages). */
  heading?: boolean;
  className?: string;
}) {
  const Name = heading ? "h1" : "span";
  const name = locale === "ar" ? company.name_ar : company.name_en;
  const sector = locale === "ar" ? company.sector_ar : company.sector_en;
  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      <CompanyMark company={company} size={size} />
      <span className="min-w-0">
        <Name className={cn("block truncate font-bold", heading ? "text-2xl" : size === "lg" ? "text-lg" : "text-sm")}>{name}</Name>
        {showSector && sector && <span className="text-subtle block truncate text-xs">{sector}</span>}
      </span>
    </span>
  );
}

/**
 * Concise provenance label. Verified external vacancies show their source status; imported practice scenarios
 * (never listed as opportunities) are labelled if they are ever shown; employer-posted jobs need no label.
 */
export function ListingBadge({
  job,
  locale,
}: {
  job: { listing_type?: string | null; created_by?: string | null };
  locale: "ar" | "en";
}) {
  const kind = listingProvenance(job);
  if (kind === "employer") return null;
  return (
    <span className="border-border text-subtle inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold">
      {kind === "verified" ? (locale === "ar" ? "مصدر موثّق" : "Verified source") : locale === "ar" ? "سيناريو تدريبي" : "Practice scenario"}
    </span>
  );
}

export const COMPANY_IDENTITY_SELECT =
  "id, slug, name_en, name_ar, sector_en, sector_ar, organization_type, company_brand_profiles(identity_status, usage_permission, logo_source_url, primary_hex), company_identity(logo_path, cover_path, tagline_en, tagline_ar, primary_hex, secondary_hex, accent_hex)";

/** Company-branded header band: cover image or the company's colours, logo, name and tagline. */
export function CompanyBanner({
  company,
  locale,
  children,
  className,
}: {
  company: CompanyLike;
  locale: "ar" | "en";
  children?: React.ReactNode;
  className?: string;
}) {
  const id = identityOf(company);
  const cover = identityImageUrl(id?.cover_path);
  const tagline = locale === "ar" ? id?.tagline_ar : id?.tagline_en;
  return (
    <div
      style={companyScopeStyle(company)}
      className={cn("relative overflow-hidden rounded-2xl text-[var(--brand-fg)]", className)}
    >
      <div
        className="absolute inset-0 bg-[var(--brand)]"
        style={
          cover
            ? { backgroundImage: `linear-gradient(to top, var(--brand) 10%, transparent 120%), url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { backgroundImage: "linear-gradient(120deg, var(--brand) 55%, var(--brand-2) 140%)" }
        }
        aria-hidden
      />
      <div className="relative flex flex-wrap items-end justify-between gap-4 p-5 sm:p-6">
        <span className="flex min-w-0 items-center gap-3">
          <CompanyMark company={company} size="md" className="ring-2 ring-white/40" />
          <span className="min-w-0">
            <span className="block truncate text-lg font-bold">{locale === "ar" ? company.name_ar : company.name_en}</span>
            {tagline && <span className="block truncate text-sm opacity-85">{tagline}</span>}
          </span>
        </span>
        {children}
      </div>
    </div>
  );
}
