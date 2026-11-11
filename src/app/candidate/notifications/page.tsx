import { redirect } from "next/navigation";

/**
 * Notifications are no longer part of the candidate interface (no tab, no bell). Notification records and the
 * workflows that create them are unchanged; the overview's "Next actions" surfaces what needs attention.
 */
export default function CandidateNotifications() {
  redirect("/candidate");
}
