const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** "2021-03", "03/2021", "Mar 2021" → "2021-03". A bare year is NOT turned into a month (never guess). */
export function toYearMonth(s: string | null | undefined): string {
  if (!s) return "";
  const t = s.trim().toLowerCase();
  let m = t.match(/(\d{4})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = t.match(/(\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  m = t.match(/([a-z]{3})[a-z]*\.?\s+(\d{4})/);
  if (m && MONTHS.includes(m[1])) return `${m[2]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}`;
  return "";
}
