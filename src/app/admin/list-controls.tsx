import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { tx, type Locale } from "@/lib/i18n/config";
import { ADMIN_PAGE_SIZE, hasFilters, withPage, type AdminListParams } from "@/lib/admin-filters";

type Option = { value: string; label: string };

/**
 * GET filter form for Super Admin lists. Submitting resets to page 1; "Clear" drops every filter.
 * Only the filters a page passes are rendered, so there are no decorative controls.
 */
export function AdminFilterBar({
  params,
  locale,
  searchPlaceholder,
  status,
  role,
  companies,
  dates = true,
}: {
  params: AdminListParams;
  locale: Locale;
  searchPlaceholder: string;
  status?: { label: string; options: Option[] };
  role?: { label: string; options: Option[] };
  companies?: Option[];
  dates?: boolean;
}) {
  const L = tx(locale);
  return (
    <form method="get" className="surface-card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" role="search">
      <Input
        name="q"
        defaultValue={params.q}
        placeholder={searchPlaceholder}
        aria-label={L("Search", "بحث")}
        className="lg:col-span-2"
      />
      {role && (
        <Select name="role" defaultValue={params.role ?? ""} aria-label={role.label}>
          <option value="">{role.label}: {L("all", "الكل")}</option>
          {role.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
      {status && (
        <Select name="status" defaultValue={params.status ?? ""} aria-label={status.label}>
          <option value="">{status.label}: {L("all", "الكل")}</option>
          {status.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
      {companies && (
        <Select name="company" defaultValue={params.company ?? ""} aria-label={L("Company", "الشركة")}>
          <option value="">{L("Company: all", "الشركة: الكل")}</option>
          {companies.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
      {dates && (
        <div className="flex items-center gap-2 lg:col-span-2">
          <Input type="date" name="from" defaultValue={params.from} aria-label={L("From date", "من تاريخ")} className="ltr-nums" />
          <span className="text-subtle text-xs">–</span>
          <Input type="date" name="to" defaultValue={params.to} aria-label={L("To date", "إلى تاريخ")} className="ltr-nums" />
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm">
          {L("Apply filters", "تطبيق")}
        </Button>
        {hasFilters(params) && (
          <Link href="?" className="text-primary text-xs font-semibold">
            {L("Clear", "مسح")}
          </Link>
        )}
      </div>
    </form>
  );
}

/** Result count + previous/next links that keep the current filters. */
export function AdminPager({
  params,
  page,
  count,
  locale,
  size = ADMIN_PAGE_SIZE,
}: {
  params: AdminListParams;
  page: number;
  count: number;
  locale: Locale;
  size?: number;
}) {
  const L = tx(locale);
  const pages = Math.max(1, Math.ceil(count / size));
  return (
    <nav aria-label={L("Pagination", "التنقل بين الصفحات")} className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted ltr-nums">
        {count === 0
          ? L("No results", "لا نتائج")
          : L(
              `${(page - 1) * size + 1}–${Math.min(count, page * size)} of ${count}`,
              `${(page - 1) * size + 1}–${Math.min(count, page * size)} من ${count}`,
            )}
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Button asChild size="sm" variant="outline">
            <Link href={withPage(params, page - 1)}>{L("Previous", "السابق")}</Link>
          </Button>
        )}
        {page < pages && (
          <Button asChild size="sm" variant="outline">
            <Link href={withPage(params, page + 1)}>{L("Next", "التالي")}</Link>
          </Button>
        )}
      </div>
    </nav>
  );
}
