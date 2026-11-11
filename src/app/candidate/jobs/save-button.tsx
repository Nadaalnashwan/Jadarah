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
      aria-label={
        optimistic
          ? locale === "ar"
            ? "إزالة من المحفوظات"
            : "Remove from saved"
          : locale === "ar"
            ? "حفظ الوظيفة"
            : "Save job"
      }
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await toggleSavedJob(jobId, !optimistic);
        })
      }
      className="text-subtle hover:bg-surface-2 hover:text-primary flex size-9 items-center justify-center rounded-full"
    >
      {optimistic ? (
        <BookmarkCheck className="text-primary dark:text-lavender size-5" />
      ) : (
        <Bookmark className="size-5" />
      )}
    </motion.button>
  );
}
