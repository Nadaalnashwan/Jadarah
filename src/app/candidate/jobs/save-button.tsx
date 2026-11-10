"use client";
import { useOptimistic, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { motion } from "motion/react";
import { toggleSavedJob } from "@/features/candidate/actions";
import { useI18n } from "@/lib/i18n/client";

export function SaveJobButton({ jobId, saved }: { jobId: string; saved: boolean }) {
  const { locale } = useI18n();
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [, start] = useTransition();
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      type="button"
      aria-pressed={optimistic}
      aria-label={optimistic ? (locale === "ar" ? "إزالة من المحفوظات" : "Remove from saved") : locale === "ar" ? "حفظ الوظيفة" : "Save job"}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await toggleSavedJob(jobId, !optimistic);
        })
      }
      className="flex size-9 items-center justify-center rounded-full text-subtle hover:bg-surface-2 hover:text-primary"
    >
      {optimistic ? <BookmarkCheck className="size-5 text-primary dark:text-lavender" /> : <Bookmark className="size-5" />}
    </motion.button>
  );
}
