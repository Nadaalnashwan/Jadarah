/**
 * Server-side list filters for Super Admin tables. Every filter is applied in the database query (never client-side),
 * combined with AND, and kept in the URL so it survives pagination, reloads and sharing.
 */
export const ADMIN_PAGE_SIZE = 25;

export type AdminListParams = {
  q?: string;
  status?: string;
  role?: string;
  company?: string;
  from?: string;
  to?: string;
  page?: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Text for PostgREST `ilike` inside `.or()`: drops characters with filter-syntax meaning. */
export function searchTerm(q: string | undefined): string | null {
  const t = (q ?? "").replace(/[%,()*\\:"']/g, " ").trim().slice(0, 80);
  return t.length ? t : null;
}

/** Inclusive date range on a timestamptz column, Riyadh calendar days (UTC+3, no DST). */
export function dateRange(p: AdminListParams): { gte?: string; lt?: string } {
  const out: { gte?: string; lt?: string } = {};
  if (p.from && DATE.test(p.from)) out.gte = `${p.from}T00:00:00+03:00`;
  if (p.to && DATE.test(p.to)) {
    const d = new Date(`${p.to}T00:00:00+03:00`);
    d.setUTCDate(d.getUTCDate() + 1);
    out.lt = d.toISOString();
  }
  return out;
}

export function validUuid(v: string | undefined): string | null {
  return v && UUID.test(v) ? v : null;
}

export function pageOf(p: AdminListParams): number {
  const n = Number(p.page ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** Range for `.range()`; `page` is 1-based. */
export function pageRange(page: number, size = ADMIN_PAGE_SIZE): [number, number] {
  return [(page - 1) * size, page * size - 1];
}

/** Query string for another page with the same filters. */
export function withPage(p: AdminListParams, page: number): string {
  const entries = Object.entries({ ...p, page: String(page) }).filter(([, v]) => v !== undefined && v !== "");
  return `?${new URLSearchParams(entries as [string, string][])}`;
}

export function hasFilters(p: AdminListParams): boolean {
  return Boolean(p.q || p.status || p.role || p.company || p.from || p.to);
}
