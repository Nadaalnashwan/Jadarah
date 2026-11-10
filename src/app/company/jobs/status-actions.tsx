"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setJobStatus } from "@/features/company/actions";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

type S = "draft" | "published" | "paused" | "closed" | "archived";
const NEXT: Record<S, S[]> = {
  draft: ["published", "archived"],
  published: ["paused", "closed"],
  paused: ["published", "closed"],
  closed: ["archived"],
  archived: ["draft"],
};

export function JobStatusActions({ jobId, status }: { jobId: string; status: S }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const label: Record<S, string> = {
    published: L("Publish", "نشر"),
    paused: L("Pause", "إيقاف مؤقت"),
    closed: L("Close", "إغلاق"),
    archived: L("Archive", "أرشفة"),
    draft: L("Restore to draft", "إعادة كمسودة"),
  };
  return (
    <div className="flex gap-1">
      {NEXT[status].map((to) => (
        <Button
          key={to}
          size="sm"
          variant={to === "published" ? "primary" : "ghost"}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await setJobStatus(jobId, to);
              if (r.ok) {
                toast.success(label[to]);
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          {label[to]}
        </Button>
      ))}
    </div>
  );
}
