import Link from "next/link";
import { Card, CardBody, type CardTone } from "@/components/ui/primitives";
import { formatNumber, tx, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/** Shared, server-rendered building blocks for the monitoring tabs. */

export function pct(v: number | null | undefined, locale: Locale, digits = 0) {
  return v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : `${formatNumber(Number((v * 100).toFixed(digits)), locale)}%`;
}

export function ms(v: number | null | undefined, locale: Locale) {
  if (v === null || v === undefined) return "—";
  return v >= 10_000
    ? `${formatNumber(Number((v / 1000).toFixed(1)), locale)} s`
    : `${formatNumber(Math.round(v), locale)} ms`;
}

/** A chart/metric panel: title, what is measured (definition + sample), optional empty state. */
export function Panel({
  title,
  definition,
  sample,
  empty,
  emptyText,
  className,
  tone,
  children,
  action,
}: {
  title: string;
  definition?: React.ReactNode;
  sample?: React.ReactNode;
  empty?: boolean;
  emptyText?: string;
  className?: string;
  tone?: CardTone;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card tone={tone} className={cn("flex min-w-0 flex-col", className)}>
      <div className="flex items-start justify-between gap-3 p-5 pb-0 sm:p-6 sm:pb-0">
        <div className="min-w-0">
          <h3 className="text-base font-bold tracking-tight">{title}</h3>
          {sample && <p className="text-subtle ltr-nums mt-0.5 text-xs">{sample}</p>}
        </div>
        {action}
      </div>
      <CardBody className="flex-1">
        {empty ? <p className="text-subtle py-10 text-center text-sm">{emptyText}</p> : children}
      </CardBody>
      {definition && (
        <p className="text-subtle border-t px-5 py-3 text-xs leading-relaxed sm:px-6">{definition}</p>
      )}
    </Card>
  );
}

/** Explicit "Not evaluated" state — never a misleading 0% or 100%. */
export function NotEvaluated({ locale, reason }: { locale: Locale; reason: string }) {
  const L = tx(locale);
  return (
    <div className="bg-surface-2 rounded-xl px-4 py-3">
      <p className="text-sm font-bold">{L("Not evaluated", "لم يُقيَّم")}</p>
      <p className="text-subtle mt-0.5 text-xs">{reason}</p>
    </div>
  );
}

/** Funnel as proportional bars with counts and step conversion (text, not colour alone). */
export function Funnel({ steps, locale }: { steps: { label: string; value: number }[]; locale: Locale }) {
  const L = tx(locale);
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="flex flex-col gap-2.5">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : null;
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs font-semibold">
              <span>{s.label}</span>
              <span className="ltr-nums text-subtle">
                {formatNumber(s.value, locale)}
                {prev !== null && (
                  <span className="ms-2">
                    {prev ? `${pct(s.value / prev, locale)} ${L("of previous", "من السابقة")}` : "—"}
                  </span>
                )}
              </span>
            </div>
            <div className="bg-surface-2 h-3 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{ width: `${(s.value / top) * 100}%`, backgroundColor: `var(--chart-${(i % 8) + 1})` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Simple responsive table for per-entity breakdowns. */
export function MiniTable({
  head,
  rows,
  empty,
  align,
}: {
  head: string[];
  rows: (React.ReactNode[] & { key?: string })[];
  empty: string;
  /** Per-column alignment; default: first column start, the rest (numbers) end. */
  align?: ("start" | "end")[];
}) {
  const end = (i: number) => (align ? align[i] === "end" : i > 0);
  if (!rows.length) return <p className="text-subtle py-6 text-center text-sm">{empty}</p>;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="text-subtle border-b text-start text-xs">
            {head.map((h, i) => (
              <th
                key={h || i}
                scope="col"
                className={cn("px-1 py-2 font-semibold", end(i) ? "text-end" : "text-start")}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b last:border-0">
              {r.map((c, i) => (
                <td
                  key={i}
                  className={cn(
                    "ltr-nums px-1 py-2",
                    end(i) ? "text-end" : "text-start",
                    i === 0 && "font-medium",
                  )}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DrillLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-primary text-xs font-semibold underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
