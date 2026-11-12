"use client";
import { useOptimistic, useTransition } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Circle, CircleDot, ExternalLink, Flag } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { setPlanItemStatus } from "@/features/candidate/actions";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  title: string;
  kind: string;
  status: "not_started" | "in_progress" | "completed";
  hours: number | null;
  skill: string | null;
  resource: { title: string; provider: string; url: string; verified: boolean } | null;
};
const NEXT = { not_started: "in_progress", in_progress: "completed", completed: "not_started" } as const;

export function MilestoneList({ items }: { items: Item[] }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [optimistic, apply] = useOptimistic(
    items,
    (state, { id, status }: { id: string; status: Item["status"] }) =>
      state.map((i) => (i.id === id ? { ...i, status } : i)),
  );
  const [, start] = useTransition();
  const label = {
    not_started: L("Not started", "لم يبدأ"),
    in_progress: L("In progress", "قيد التنفيذ"),
    completed: L("Completed", "مكتمل"),
  };
  return (
    <ol className="relative flex flex-col gap-3">
      {optimistic.map((i, idx) => (
        <motion.li
          key={i.id}
          layout
          className={cn(
            "relative flex gap-4 rounded-2xl border p-4 transition-colors",
            i.status === "completed" && "border-success/30 bg-success-soft/40",
          )}
        >
          <button
            onClick={() =>
              start(async () => {
                const s = NEXT[i.status];
                apply({ id: i.id, status: s });
                await setPlanItemStatus(i.id, s);
              })
            }
            className="mt-0.5 shrink-0"
            aria-label={`${i.title}: ${label[i.status]} → ${label[NEXT[i.status]]}`}
          >
            {i.status === "completed" ? (
              <CheckCircle2 className="text-success size-6" />
            ) : i.status === "in_progress" ? (
              <CircleDot className="text-primary size-6" />
            ) : (
              <Circle className="text-border-strong size-6" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="ltr-nums text-subtle text-xs">{idx + 1}</span>
              <p
                className={cn(
                  "font-semibold",
                  i.status === "completed" && "text-muted decoration-success/50 line-through",
                )}
              >
                {i.title}
              </p>
              {i.kind === "milestone" && (
                <Flag
                  className="text-primary size-3.5"
                  aria-label={L("Milestone", "مرحلة")}
                />
              )}
            </div>
            <div className="text-subtle mt-1 flex flex-wrap items-center gap-2 text-xs">
              {i.skill && <Badge tone="info">{i.skill}</Badge>}
              {i.hours && <span className="ltr-nums">~{i.hours}h</span>}
              <span>{label[i.status]}</span>
            </div>
            {i.resource && (
              <a
                href={i.resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-2 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
              >
                {i.resource.title} · <span className="text-subtle font-normal">{i.resource.provider}</span>{" "}
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
