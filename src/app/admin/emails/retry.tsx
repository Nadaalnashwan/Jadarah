"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { retryEmail } from "@/features/admin/actions";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

export function RetryEmailButton({ id }: { id: string }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await retryEmail(id);
          if (!res.ok) return void toast.error(res.error);
          toast.success(L("Queued again", "أُعيدت إلى الانتظار"));
          router.refresh();
        })
      }
    >
      {L("Retry", "إعادة المحاولة")}
    </Button>
  );
}
