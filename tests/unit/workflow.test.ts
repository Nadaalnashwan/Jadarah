import { describe, expect, it } from "vitest";
import {
  canCreateInterview,
  canHire,
  canTransition,
  employerTargets,
  PIPELINE_STAGES,
  pipelineFor,
} from "@/lib/domain/application-status";
import { isPracticeListing, LISTED_JOB_FILTER, listingProvenance } from "@/lib/domain/listings";

describe("recruitment workflow: no employer gate before the assessment", () => {
  it("goes straight from application to the practical task", () => {
    // apply_to_job moves a task application submitted → assessment_pending in the same transaction.
    expect(canTransition("submitted", "assessment_pending")).toBe(true);
    expect(PIPELINE_STAGES.indexOf("assessment_pending")).toBe(1);
    // Employer review comes after the evidence is submitted.
    expect(PIPELINE_STAGES.indexOf("under_review")).toBeGreaterThan(PIPELINE_STAGES.indexOf("assessment_completed"));
  });
  it("shows assessment steps only for applications that have one", () => {
    expect(pipelineFor(true)).toEqual([
      "submitted",
      "assessment_pending",
      "assessment_completed",
      "under_review",
      "shortlisted",
      "interview_scheduled",
      "interview_completed",
      "hired",
    ]);
    expect(pipelineFor(false)).not.toContain("assessment_pending");
    expect(pipelineFor(false, ["submitted", "assessment_pending"])).toContain("assessment_completed");
  });
  it("while the task is outstanding the employer may only reject or hire", () => {
    expect(employerTargets("assessment_pending", true).sort()).toEqual(["hired", "rejected"]);
    expect(employerTargets("assessment_pending", true)).not.toContain("shortlisted");
    expect(employerTargets("assessment_pending", true)).not.toContain("under_review");
  });
  it("after submission the employer can review and shortlist", () => {
    const t = employerTargets("assessment_completed", false);
    expect(t).toContain("under_review");
    expect(t).toContain("shortlisted");
    expect(t).not.toContain("assessment_completed"); // workflow-only
  });
  it("keeps the mandatory rules: shortlist before interview, hire without shortlist", () => {
    expect(canCreateInterview({ status: "assessment_completed", was_shortlisted: false })).toBe(false);
    expect(canCreateInterview({ status: "shortlisted", was_shortlisted: true })).toBe(true);
    expect(canHire("assessment_pending")).toBe(true);
    expect(canHire("submitted")).toBe(true);
    expect(employerTargets("submitted", false)).toContain("hired");
  });
});

describe("listing provenance: practice scenarios are never listed as opportunities", () => {
  it("classifies jobs", () => {
    expect(listingProvenance({ listing_type: "simulation", created_by: null })).toBe("practice");
    expect(listingProvenance({ listing_type: "simulation", created_by: "u1" })).toBe("employer");
    expect(listingProvenance({ listing_type: "employer", created_by: null })).toBe("employer");
    expect(listingProvenance({ listing_type: "verified", created_by: null })).toBe("verified");
    expect(isPracticeListing({ listing_type: "simulation", created_by: null })).toBe(true);
  });
  it("filters at query level", () => {
    expect(LISTED_JOB_FILTER).toBe("listing_type.in.(verified,employer),created_by.not.is.null");
  });
});
