/** Chart colours as theme-aware CSS variables. Plain module (not "use client") so server components can import it. */
/**
 * Categorical palette from the JADARAH identity: blue first, then teal/petrol and warm tones; lavender last.
 * Mid-tone values chosen to stay distinguishable on both the light (warm) and dark (midnight) surfaces.
 */
export const CHART_COLORS = [
  "var(--chart-1)", // blue
  "var(--chart-2)", // teal
  "var(--chart-3)", // peach
  "var(--chart-4)", // sky
  "var(--chart-5)", // petrol
  "var(--chart-6)", // sand
  "var(--chart-7)", // sage
  "var(--chart-8)", // lavender (accent, last)
];
/** Semantic series colours (theme-aware CSS variables). */
export const SERIES = {
  primary: "var(--chart-1)",
  secondary: "var(--chart-2)",
  success: "var(--chart-success)",
  failure: "var(--chart-failure)",
  warning: "var(--chart-6)",
  muted: "var(--chart-grid)",
  p50: "var(--chart-1)",
  p95: "var(--chart-3)",
  p99: "var(--chart-8)",
} as const;
