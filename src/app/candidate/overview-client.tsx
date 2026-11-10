"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { BarList } from "@/components/app/charts";
import { Badge } from "@/components/ui/primitives";
import { APPLICATION_STATUSES, statusTone, type ApplicationStatus } from "@/lib/domain/application-status";
import { useI18n } from "@/lib/i18n/client";
import { formatDate } from "@/lib/i18n/config";

export function ApplicationsByStatus({
  rows,
}: {
  rows: { id: string; status: ApplicationStatus; title: string; company: string; submitted_at: string }[];
}) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const data = APPLICATION_STATUSES.map((s) => ({
    key: s,
    label: t.status[s],
    value: rows.filter((r) => r.status === s).length,
  })).filter((d) => d.value > 0);
  const visible = selected ? rows.filter((r) => r.status === selected) : rows;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <BarList data={data} selected={selected} onSelect={setSelected} />
      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {visible.slice(0, 6).map((r) => (
            <motion.li
              key={r.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Link
                href={`/candidate/applications/${r.id}`}
                className="hover:bg-surface-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{r.title}</span>
                  <span className="text-subtle block truncate text-xs">
                    {r.company} · {formatDate(r.submitted_at, locale)}
                  </span>
                </span>
                <Badge tone={statusTone(r.status)}>{t.status[r.status]}</Badge>
              </Link>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
