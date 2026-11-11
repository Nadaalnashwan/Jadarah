import { redirect } from "next/navigation";

/**
 * Notifications are no longer part of the employer interface (no tab, no bell). Notification records and the
 * workflows that create them are unchanged; the overview shows what needs attention.
 */
export default function CompanyNotifications() {
  redirect("/company");
}
