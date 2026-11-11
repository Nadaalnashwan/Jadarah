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

/**
 * Organization identity. An official logo/colour is shown ONLY when its identity is verified and
 * usage is granted (company_brand_profiles). Otherwise a neutral JADARAH tile with a generic
 * SECTOR symbol is used — never an imitation of an organization's logo.
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
};

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
  const b = brandOf(company);
  if (brandAuthorised(b) && b?.logo_source_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- authorised external brand asset
      <img src={b.logo_source_url} alt="" className={cn("bg-white object-contain p-1.5", SIZE[size], className)} />
    );
  }
  const accent = brandAuthorised(b) && b?.primary_hex ? b.primary_hex : undefined;
  return (
    <span
      aria-hidden
      className={cn("bg-navy text-lavender flex shrink-0 items-center justify-center", SIZE[size], className)}
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

/** Concise provenance label: simulation opportunities are never presented as official vacancies. */
export function ListingBadge({ type, locale }: { type?: string | null; locale: "ar" | "en" }) {
  if (type !== "simulation") return null;
  return (
    <span className="border-border text-subtle inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold">
      {locale === "ar" ? "محاكاة" : "Simulation"}
    </span>
  );
}

export const COMPANY_IDENTITY_SELECT =
  "id, slug, name_en, name_ar, sector_en, sector_ar, organization_type, company_brand_profiles(identity_status, usage_permission, logo_source_url, primary_hex)";
