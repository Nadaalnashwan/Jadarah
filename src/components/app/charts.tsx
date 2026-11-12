"use client";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  CartesianGrid,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "motion/react";
import { useI18n } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

import { CHART_COLORS, SERIES } from "./chart-colors";

export { CHART_COLORS, SERIES };

/**
 * Resolves `var(--token)` colours to concrete values. Some Recharts parts (bar fills, legend icons) are written as
 * SVG attributes, which do not resolve CSS variables; re-resolved whenever the theme changes.
 */
function useResolvedColors(colors: string[]): string[] {
  const key = colors.join("|");
  const [resolved, setResolved] = useState(colors);
  useEffect(() => {
    const list = key.split("|");
    const resolve = () => {
      const cs = getComputedStyle(document.documentElement);
      setResolved(
        list.map((c) => {
          const m = /^var\((--[\w-]+)\)$/.exec(c.trim());
          return m ? cs.getPropertyValue(m[1]).trim() || c : c;
        }),
      );
    };
    resolve();
    const mo = new MutationObserver(resolve);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class", "style"],
    });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", resolve);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", resolve);
    };
  }, [key]);
  return resolved;
}

function ChartTooltip({
  active,
  payload,
  label,
  colors,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color?: string }[];
  label?: string;
  /** Series name → colour, when the chart's own payload colour is unavailable. */
  colors?: Record<string, string>;
}) {
  const { locale } = useI18n();
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-elevated rounded-xl border px-3 py-2 text-xs shadow-lg">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: colors?.[p.name] ?? p.color }} />
          <span className="text-muted">{p.name}</span>
          <span className="ltr-nums font-bold">{formatNumber(p.value, locale)}</span>
        </p>
      ))}
    </div>
  );
}

export function BarList({
  data,
  onSelect,
  selected,
}: {
  data: { key: string; label: string; value: number }[];
  onSelect?: (key: string | null) => void;
  selected?: string | null;
}) {
  const { locale } = useI18n();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="flex flex-col gap-2">
      {data.map((d, i) => (
        <li key={d.key}>
          <button
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(selected === d.key ? null : d.key)}
            aria-pressed={selected === d.key}
            className={cn(
              "group w-full text-start",
              onSelect && "cursor-pointer",
              selected && selected !== d.key && "opacity-40",
            )}
          >
            <div className="mb-1 flex justify-between text-xs font-semibold">
              <span>{d.label}</span>
              <span className="ltr-nums text-subtle">{formatNumber(d.value, locale)}</span>
            </div>
            <div className="bg-surface-2 h-2 overflow-hidden rounded-full">
              <motion.div
                className="h-full rounded-full"
                // One series: length carries the value, so every bar uses the primary series colour.
                style={{ backgroundColor: SERIES.primary }}
                initial={{ width: 0 }}
                animate={{ width: `${(d.value / max) * 100}%` }}
                transition={{ duration: 0.8, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Donut({
  data,
  centerLabel,
}: {
  data: { key: string; label: string; value: number }[];
  centerLabel?: string;
}) {
  const { locale } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const shown = active === null ? null : data[active];
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative size-44 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((d, i) => (
                <Cell
                  key={d.key}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  opacity={active === null || active === i ? 1 : 0.35}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="ltr-nums text-3xl font-extrabold">
            {formatNumber(shown ? shown.value : total, locale)}
          </span>
          <span className="text-subtle max-w-24 truncate text-xs">{shown ? shown.label : centerLabel}</span>
        </div>
      </div>
      <ul className="grid w-full grid-cols-1 gap-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.key}>
            <button
              type="button"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="hover:bg-surface-2 flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1"
            >
              <span className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                {d.label}
              </span>
              <span className="ltr-nums font-semibold">{formatNumber(d.value, locale)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrendArea({ data, name }: { data: { label: string; value: number }[]; name: string }) {
  const { locale } = useI18n();
  return (
    <div className="h-56 w-full" dir="ltr">
      <ResponsiveContainer>
        <AreaChart
          data={locale === "ar" ? [...data].reverse() : data}
          margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
        >
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
            orientation="bottom"
            reversed={false}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
            orientation={locale === "ar" ? "right" : "left"}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            name={name}
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            fill="url(#trendFill)"
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Columns({ data, name }: { data: { label: string; value: number }[]; name: string }) {
  const { locale } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="h-60 w-full" dir="ltr">
      <ResponsiveContainer>
        <BarChart
          data={locale === "ar" ? [...data].reverse() : data}
          margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
          onMouseLeave={() => setHover(null)}
        >
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
            orientation={locale === "ar" ? "right" : "left"}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar
            dataKey="value"
            name={name}
            radius={[8, 8, 0, 0]}
            onMouseEnter={(_, i) => setHover(i)}
            animationDuration={800}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={hover === null || hover === i ? "var(--chart-1)" : "var(--chart-4)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SkillRadar({ data }: { data: { label: string; value: number; target?: number }[] }) {
  const { locale } = useI18n();
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--chart-grid)" />
          <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
          {data.some((d) => d.target !== undefined) && (
            <Radar
              name={locale === "ar" ? "المطلوب" : "Target"}
              dataKey="target"
              stroke="var(--chart-2)"
              fill="var(--chart-2)"
              fillOpacity={0.2}
              strokeDasharray="4 4"
            />
          )}
          <Radar
            name={locale === "ar" ? "الحالي" : "Current"}
            dataKey="value"
            stroke="var(--chart-1)"
            fill="var(--chart-1)"
            fillOpacity={0.35}
            animationDuration={900}
          />
          <Tooltip content={<ChartTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

type SeriesDef = { key: string; name: string; color: string; dashed?: boolean };

/** Legend rendered by us so swatches use theme variables (Recharts' own legend icons cannot resolve them). */
function SeriesLegend({ series }: { series: SeriesDef[] }) {
  return (
    <ul className="text-muted mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: s.color }}
            aria-hidden
          />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

/** Multi-series line chart (e.g. p50/p95 latency). Null values are gaps, never interpolated as zeros. */
export function LineSeries({
  data,
  xKey,
  series,
  unit,
  height = "h-64",
}: {
  data: Record<string, string | number | null>[];
  xKey: string;
  series: SeriesDef[];
  unit?: string;
  height?: string;
}) {
  const { locale } = useI18n();
  const colors = useResolvedColors(series.map((s) => s.color));
  return (
    <figure className={cn(height, "w-full")} dir="ltr">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
            orientation={locale === "ar" ? "right" : "left"}
            tickFormatter={(v: number) =>
              unit === " ms" && v >= 1000
                ? `${formatNumber(Number((v / 1000).toFixed(1)), locale)} s`
                : unit
                  ? `${formatNumber(v, locale)}${unit}`
                  : formatNumber(v, locale)
            }
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={colors[i]}
              strokeWidth={2.25}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              dot={{ r: 2.5, strokeWidth: 0, fill: colors[i] }}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}

/** Stacked (or grouped) bars over a shared x axis, e.g. success vs failure per day. */
export function StackedBars({
  data,
  xKey,
  series,
  stacked = true,
  height = "h-64",
  horizontal = false,
}: {
  data: Record<string, string | number | null>[];
  xKey: string;
  series: SeriesDef[];
  stacked?: boolean;
  height?: string;
  /** Horizontal bars with category labels on the y axis (for long labels). */
  horizontal?: boolean;
}) {
  const { locale } = useI18n();
  return (
    <figure className="w-full" dir="ltr">
      <div className={height}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{ top: 8, right: 12, left: horizontal ? 4 : -6, bottom: 0 }}
          >
            <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="var(--chart-grid)" />
            {horizontal ? (
              <>
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
                />
                <YAxis
                  type="category"
                  dataKey={xKey}
                  width={170}
                  interval={0}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey={xKey}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={16}
                  tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
                  orientation={locale === "ar" ? "right" : "left"}
                />
              </>
            )}
            <Tooltip
              content={<ChartTooltip colors={Object.fromEntries(series.map((s) => [s.name, s.color]))} />}
              cursor={{ fill: "var(--surface-2)" }}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stackId={stacked ? "a" : undefined}
                fill={s.color}
                radius={
                  horizontal
                    ? stacked
                      ? i === series.length - 1
                        ? [0, 6, 6, 0]
                        : [0, 0, 0, 0]
                      : [0, 6, 6, 0]
                    : stacked
                      ? i === series.length - 1
                        ? [6, 6, 0, 0]
                        : [0, 0, 0, 0]
                      : [6, 6, 0, 0]
                }
                isAnimationActive={false}
              >
                {data.map((_, j) => (
                  <Cell key={j} fill={s.color} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <SeriesLegend series={series} />
    </figure>
  );
}
