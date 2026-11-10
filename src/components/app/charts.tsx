"use client";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
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

/** Brand-derived categorical palette (five official colours + derived shades). */
export const CHART_COLORS = ["#3B66F6", "#A9B8FF", "#0F1B3D", "#7DA0FF", "#CDE7F6", "#2343B5", "#5B6E9E", "#B9C6FF"];

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color?: string }[]; label?: string }) {
  const { locale } = useI18n();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-surface px-3 py-2 text-xs shadow-lg">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
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
            className={cn("group w-full text-start", onSelect && "cursor-pointer", selected && selected !== d.key && "opacity-40")}
          >
            <div className="mb-1 flex justify-between text-xs font-semibold">
              <span>{d.label}</span>
              <span className="ltr-nums text-subtle">{formatNumber(d.value, locale)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
              <motion.div
                className="h-full rounded-full"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
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

export function Donut({ data, centerLabel }: { data: { key: string; label: string; value: number }[]; centerLabel?: string }) {
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
                <Cell key={d.key} fill={CHART_COLORS[i % CHART_COLORS.length]} opacity={active === null || active === i ? 1 : 0.35} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="ltr-nums text-3xl font-extrabold">{formatNumber(shown ? shown.value : total, locale)}</span>
          <span className="max-w-24 truncate text-xs text-subtle">{shown ? shown.label : centerLabel}</span>
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
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-surface-2"
            >
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
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
        <AreaChart data={locale === "ar" ? [...data].reverse() : data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B66F6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#3B66F6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--subtle-foreground)" }} orientation="bottom" reversed={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--subtle-foreground)" }} orientation={locale === "ar" ? "right" : "left"} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="value" name={name} stroke="#3B66F6" strokeWidth={2.5} fill="url(#trendFill)" animationDuration={900} />
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
        <BarChart data={locale === "ar" ? [...data].reverse() : data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} onMouseLeave={() => setHover(null)}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10, fill: "var(--subtle-foreground)" }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--subtle-foreground)" }} orientation={locale === "ar" ? "right" : "left"} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="value" name={name} radius={[8, 8, 0, 0]} onMouseEnter={(_, i) => setHover(i)} animationDuration={800}>
            {data.map((_, i) => (
              <Cell key={i} fill={hover === null || hover === i ? "#3B66F6" : "#A9B8FF"} />
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
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
          {data.some((d) => d.target !== undefined) && (
            <Radar name={locale === "ar" ? "المطلوب" : "Target"} dataKey="target" stroke="#A9B8FF" fill="#A9B8FF" fillOpacity={0.2} strokeDasharray="4 4" />
          )}
          <Radar name={locale === "ar" ? "الحالي" : "Current"} dataKey="value" stroke="#3B66F6" fill="#3B66F6" fillOpacity={0.35} animationDuration={900} />
          <Tooltip content={<ChartTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
