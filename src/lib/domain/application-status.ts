/**
 * Application status machine.
 * Mirror of public.application_transition_allowed() in
 * supabase/migrations/20261110000006_business_rules.sql — the database is the
 * enforcement point; this module powers UI affordances and unit tests.
 */
export const APPLICATION_STATUSES = [
  "submitted",
  "under_review",
  "assessment_pending",
  "assessment_completed",
  "shortlisted",
  "interview_scheduled",
  "interview_completed",
  "hired",
  "rejected",
  "withdrawn",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const TERMINAL_STATUSES: readonly ApplicationStatus[] = ["hired", "rejected", "withdrawn"];

export const TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  submitted: ["under_review", "assessment_pending", "shortlisted", "rejected", "hired", "withdrawn"],
  under_review: ["assessment_pending", "shortlisted", "rejected", "hired", "withdrawn"],
  assessment_pending: [
    "assessment_completed",
    "under_review",
    "shortlisted",
    "rejected",
    "hired",
    "withdrawn",
  ],
  assessment_completed: [
    "under_review",
    "assessment_pending",
    "shortlisted",
    "rejected",
    "hired",
    "withdrawn",
  ],
  shortlisted: ["assessment_pending", "interview_scheduled", "rejected", "hired", "withdrawn"],
  interview_scheduled: ["interview_completed", "shortlisted", "rejected", "hired", "withdrawn"],
  interview_completed: ["interview_scheduled", "shortlisted", "rejected", "hired", "withdrawn"],
  hired: [],
  rejected: [],
  withdrawn: [],
};

/** Statuses produced only by their workflow, never chosen manually by a recruiter. */
export const WORKFLOW_ONLY_STATUSES: readonly ApplicationStatus[] = [
  "submitted",
  "assessment_completed",
  "interview_scheduled",
  "interview_completed",
  "withdrawn",
];

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Targets a recruiter may pick by hand from the given status. */
export function manualTargets(from: ApplicationStatus): ApplicationStatus[] {
  return TRANSITIONS[from].filter((s) => !WORKFLOW_ONLY_STATUSES.includes(s));
}

export function isTerminal(status: ApplicationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * MANDATORY RULE: a candidate must be shortlisted before an interview can be created.
 * `wasShortlisted` is set by the database the moment an application enters "shortlisted".
 */
export function canCreateInterview(app: { status: ApplicationStatus; was_shortlisted: boolean }): boolean {
  return (
    app.was_shortlisted &&
    (app.status === "shortlisted" ||
      app.status === "interview_scheduled" ||
      app.status === "interview_completed")
  );
}

/** A company may mark any open application as hired, without prior shortlisting. */
export function canHire(status: ApplicationStatus): boolean {
  return canTransition(status, "hired");
}

export function canWithdraw(status: ApplicationStatus): boolean {
  return canTransition(status, "withdrawn");
}

export type StatusTone = "neutral" | "info" | "progress" | "positive" | "negative" | "muted";

export function statusTone(status: ApplicationStatus): StatusTone {
  switch (status) {
    case "submitted":
    case "under_review":
      return "info";
    case "assessment_pending":
    case "assessment_completed":
    case "interview_scheduled":
    case "interview_completed":
      return "progress";
    case "shortlisted":
    case "hired":
      return "positive";
    case "rejected":
      return "negative";
    case "withdrawn":
      return "muted";
  }
}

/** Ordered milestones used for the candidate-facing progress rail. */
export const PIPELINE_STAGES: readonly ApplicationStatus[] = [
  "submitted",
  "under_review",
  "assessment_pending",
  "assessment_completed",
  "shortlisted",
  "interview_scheduled",
  "interview_completed",
  "hired",
];
