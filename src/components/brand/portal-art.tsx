import { useId } from "react";
import { cn } from "@/lib/utils";
import { SYMBOL } from "./logo";

/**
 * Portal field — the recurring visual language of JADARAH, drawn only from the logo's own geometry: the three layered
 * portals and the luminous path, enlarged and softly lit, plus one flowing ribbon in the blue → violet signature.
 * Decorative only (aria-hidden). Mirrors for RTL so the light always falls towards the content.
 *
 * tone: "violet" (blue → violet, default), "mint" (green panels), "warm" (light sections: violet with a gold glint).
 */
export function PortalField({
  className,
  tone = "violet",
  ribbon = true,
  drift = true,
}: {
  className?: string;
  tone?: "violet" | "mint" | "warm";
  ribbon?: boolean;
  drift?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const id = (k: string) => `${k}-${uid}`;
  const stops =
    tone === "mint"
      ? ["#a7e3c2", "#6fd3a0", "#d4af37"]
      : tone === "warm"
        ? ["#3b66f6", "#8b5cf6", "#d4af37"]
        : ["#3b66f6", "#8b5cf6", "#d8b4fe"];
  return (
    <svg
      viewBox="0 0 220 200"
      className={cn("pointer-events-none select-none rtl:-scale-x-100", className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={id("a")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="1" stopColor={stops[1]} />
        </linearGradient>
        <linearGradient id={id("r")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={stops[0]} stopOpacity="0" />
          <stop offset=".45" stopColor={stops[1]} stopOpacity=".55" />
          <stop offset="1" stopColor={stops[2]} stopOpacity=".9" />
        </linearGradient>
        <radialGradient id={id("g")} cx=".62" cy=".55" r=".5">
          <stop offset="0" stopColor={stops[2]} stopOpacity=".55" />
          <stop offset="1" stopColor={stops[2]} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* the doorway light */}
      <circle cx="140" cy="110" r="70" fill={`url(#${id("g")})`} className={drift ? "jd-glow-soft" : undefined} />
      {/* the three portals from the symbol, enlarged */}
      <g transform="translate(40 4) scale(1.55)">
        <g className={drift ? "jd-drift-b" : undefined}>
          <path d={SYMBOL.back} fill={`url(#${id("a")})`} fillOpacity=".16" stroke={stops[2]} strokeOpacity=".35" strokeWidth=".6" />
        </g>
        <g className={drift ? "jd-drift-a" : undefined}>
          <path d={SYMBOL.middle} fillRule="evenodd" fill={`url(#${id("a")})`} fillOpacity=".24" stroke={stops[2]} strokeOpacity=".4" strokeWidth=".6" />
        </g>
        <path d={SYMBOL.front} fillRule="evenodd" fill={`url(#${id("a")})`} fillOpacity=".38" stroke={stops[2]} strokeOpacity=".55" strokeWidth=".6" />
        <path d={SYMBOL.path} fill={stops[2]} fillOpacity=".35" />
      </g>
      {ribbon && (
        <path
          d="M-10 190 C 40 160, 70 150, 110 152 C 150 154, 180 138, 230 96 L 230 108 C 182 150, 150 166, 110 164 C 72 162, 42 172, -10 200 Z"
          fill={`url(#${id("r")})`}
        />
      )}
    </svg>
  );
}
