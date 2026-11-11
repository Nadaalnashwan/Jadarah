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
