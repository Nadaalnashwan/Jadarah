"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmInterview } from "@/features/calendar/actions";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

export function ConfirmAttendance({ interviewId }: { interviewId: string }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await confirmInterview(interviewId);
          if (r.ok) {
            toast.success(r.message);
            router.refresh();
          } else toast.error(r.error);
        })
      }
    >
      <CheckCircle2 /> {L("Confirm attendance", "تأكيد الحضور")}
    </Button>
  );
}
