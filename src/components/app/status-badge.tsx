import { Badge } from "@/components/ui/primitives";
import { statusTone, type ApplicationStatus } from "@/lib/domain/application-status";
import type { Messages } from "@/lib/i18n/messages";

export function StatusBadge({ status, t }: { status: ApplicationStatus; t: Messages }) {
  return (
    <Badge tone={statusTone(status)} dot>
      {t.status[status]}
    </Badge>
  );
}

export function JobStatusBadge({ status, t }: { status: keyof Messages["jobStatus"]; t: Messages }) {
  const tone =
    status === "published"
      ? "positive"
      : status === "draft"
        ? "neutral"
        : status === "paused"
          ? "progress"
          : "muted";
  return (
    <Badge tone={tone} dot>
      {t.jobStatus[status]}
    </Badge>
  );
}

export function CompanyStatusBadge({ status, t }: { status: keyof Messages["companyStatus"]; t: Messages }) {
  const tone =
    status === "approved"
      ? "positive"
      : status === "rejected" || status === "suspended"
        ? "negative"
        : "progress";
  return (
    <Badge tone={tone} dot>
      {t.companyStatus[status]}
    </Badge>
  );
}
