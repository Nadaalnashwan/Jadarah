/**
 * Opportunity provenance.
 *  - verified   : an external vacancy with a recorded source (listing_type = 'verified').
 *  - employer   : posted by the organization itself from its JADARAH workspace (has an author, created_by).
 *  - practice   : an imported practice scenario (listing_type = 'simulation' with no employer author).
 * Practice scenarios are not vacancies, so they are never listed as opportunities. Employer-posted jobs are real
 * postings even though the column default labels them 'simulation' — that label is never shown for them.
 */
export type ListingProvenance = "verified" | "employer" | "practice";

export function listingProvenance(job: { listing_type?: string | null; created_by?: string | null }): ListingProvenance {
  if (job.listing_type === "verified") return "verified";
  // 'employer' is the explicit value added by proposal 0030; until then, an author marks an employer posting.
  return job.listing_type === "employer" || job.created_by ? "employer" : "practice";
}

export function isPracticeListing(job: { listing_type?: string | null; created_by?: string | null }): boolean {
  return listingProvenance(job) === "practice";
}

/** PostgREST `.or()` filter for job queries: keep verified vacancies and employer-posted jobs only. */
export const LISTED_JOB_FILTER = "listing_type.in.(verified,employer),created_by.not.is.null";

/** Today's date (YYYY-MM-DD) in Saudi Arabia — job deadlines are calendar dates in Asia/Riyadh. */
export function riyadhToday(nowMs: number = Date.now()): string {
  return new Date(nowMs + 3 * 3_600_000).toISOString().slice(0, 10); // Asia/Riyadh is UTC+3 all year (no DST)
}

/** A job is open to applications while published and on or before its deadline (Riyadh calendar date). */
export function isJobOpen(job: { status: string; deadline: string | null }, today: string = riyadhToday()): boolean {
  return job.status === "published" && (job.deadline === null || job.deadline >= today);
}

/** PostgREST `.or()` filter: no deadline, or a deadline today or later (combine with the published-status filter). */
export function openDeadlineFilter(today: string = riyadhToday()): string {
  return `deadline.is.null,deadline.gte.${today}`;
}
