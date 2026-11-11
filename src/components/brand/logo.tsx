import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * JADARAH symbol — the approved identity (Brand Identity Board, light & dark).
 * Three interconnected translucent layers stand like portals in perspective (skills developing, layer on layer);
 * a recessed doorway opens in the front layer (the convergence point: talent meets opportunity) and a continuous
 * luminous path flows out of it (the candidate's journey). Geometry is shared with /public/brand/*.svg —
 * never redraw, recolour outside the palette, or distort it.
 */
export const SYMBOL = {
  /** Frames the full geometry (x 4–104, y 14.8–124.6) with an even 3-unit margin; the old 2 7 104 115 cut off the base. */
  viewBox: "1 11.7 106 116",
  back: "M12,45.5 Q12,41 16.5,38.93 L67.5,15.47 Q72,13.4 72,17.9 L72,68.9 Q72,73.4 67.5,75.47 L16.5,98.93 Q12,101 12,96.5 Z",
  tunnel: "M42,62.02 Q42,59.02 45,57.64 L72,45.22 Q75,43.84 75,46.84 L75,80.84 Q75,83.84 72,85.22 L45,97.64 Q42,99.02 42,96.02 Z",
  middle:
    "M29,57 Q29,52.5 33.5,50.43 L83.5,27.43 Q88,25.36 88,29.86 L88,80.86 Q88,85.36 83.5,87.43 L33.5,110.43 Q29,112.5 29,108 Z M42,96 L42,62.02 Q42,59.02 45,57.64 L72,45.22 Q75,43.84 75,46.84 L75,96 Z",
  front:
    "M45,70.5 Q45,66 49.5,63.93 L99.5,40.93 Q104,38.86 104,43.36 L104,94.36 Q104,98.86 99.5,100.93 L49.5,123.93 Q45,126 45,121.5 Z M57,104 L57,65.48 Q57,63.48 59.5,63.98 L74.5,67.08 Q77,67.58 77,69.98 L77,104 Z",
  door: "M57,100 L57,65.48 Q57,63.48 59.5,63.98 L74.5,67.08 Q77,67.58 77,69.98 L77,97 Q67,103 57,100 Z",
  jamb: "M51.5,66.48 L57,63.48 L57,100 L51.5,102 Z",
  path: "M57,84 C57,96 50,101 36,105 C24,108 12,112 4,120 L46,120 C58,113 72,110 76,100 C77.5,95 77,90 77,86 Z",
} as const;

export function LogoMark({
  className,
  tone = "color",
  title,
}: {
  className?: string;
  /** color: approved full-colour symbol (light & dark surfaces). mono: single colour (currentColor). */
  tone?: "color" | "mono" | "auto" | "light" | "dark";
  title?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const id = (k: string) => `${k}-${uid}`;
  const mono = tone === "mono";
  return (
    <svg
      viewBox={SYMBOL.viewBox}
      className={cn("size-9", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {mono ? (
        <g fill="currentColor">
          <path d={SYMBOL.back} opacity=".55" />
          <path d={SYMBOL.middle} fillRule="evenodd" opacity=".75" />
          <path d={SYMBOL.front} fillRule="evenodd" />
          <path d={SYMBOL.path} opacity=".5" />
        </g>
      ) : (
        <>
          <defs>
            <linearGradient id={id("a")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#6A8CFF" />
              <stop offset="1" stopColor="#3B6CFF" />
            </linearGradient>
            <linearGradient id={id("b")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#A9B8FF" />
              <stop offset="1" stopColor="#8A8DFF" />
            </linearGradient>
            <linearGradient id={id("t")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#4C63E8" />
              <stop offset="1" stopColor="#2E46C9" />
            </linearGradient>
            <linearGradient id={id("c")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#4E62E6" />
              <stop offset=".6" stopColor="#5C6CF0" />
              <stop offset="1" stopColor="#4459E2" />
            </linearGradient>
            <linearGradient id={id("d")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#FFF7E8" />
            </linearGradient>
            <linearGradient id={id("p")} x1=".8" y1="0" x2=".1" y2="1">
              <stop offset="0" stopColor="#FFF7E8" />
              <stop offset=".55" stopColor="#FCE7EC" />
              <stop offset="1" stopColor="#C9C3FF" stopOpacity=".2" />
            </linearGradient>
          </defs>
          <path d={SYMBOL.back} fill={`url(#${id("a")})`} opacity=".92" />
          <path d={SYMBOL.tunnel} fill={`url(#${id("t")})`} />
          <path d={SYMBOL.middle} fill={`url(#${id("b")})`} fillRule="evenodd" opacity=".74" />
          <path d={SYMBOL.front} fill={`url(#${id("c")})`} fillRule="evenodd" opacity=".92" />
          <path d={SYMBOL.door} fill={`url(#${id("d")})`} />
          <path d={SYMBOL.jamb} fill="#BFC8FF" opacity=".95" />
          <path d={SYMBOL.path} fill={`url(#${id("p")})`} />
        </>
      )}
    </svg>
  );
}

/**
 * Approved lockup: Arabic wordmark «جَدارة» over the spaced Latin «JADARAH», symbol to the right.
 * The lockup never mirrors with the page direction.
 */
export function Logo({
  className,
  compact,
  size = "md",
}: {
  className?: string;
  compact?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const lg = size === "lg";
  const sm = size === "sm";
  return (
    <span
      dir="ltr"
      className={cn("text-foreground inline-flex shrink-0 items-center", lg ? "gap-4" : "gap-2", className)}
      aria-label="JADARAH | جدارة"
      role="img"
    >
      {!compact && (
        <span className="flex flex-col items-center leading-none" aria-hidden>
          <span
            className={cn(
              "font-arabic leading-[1.15] font-bold tracking-tight",
              lg ? "text-5xl" : sm ? "text-lg" : "text-[1.35rem]",
            )}
          >
            جَدارة
          </span>
          <span
            className={cn(
              "font-sans leading-none font-semibold text-current",
              lg
                ? "mt-1.5 ps-[0.55em] text-sm tracking-[0.55em]"
                : sm
                  ? "ps-[0.42em] text-[0.45rem] tracking-[0.42em]"
                  : "ps-[0.42em] text-[0.5rem] tracking-[0.42em]",
            )}
          >
            JADARAH
          </span>
        </span>
      )}
      {/* The symbol keeps its own proportions (viewBox 106 × 116) so it is never squashed or letterboxed. */}
      <LogoMark className={cn("aspect-[106/116] w-auto", lg ? "h-24" : sm ? "h-8" : "h-10")} />
    </span>
  );
}

/** Repeated brand-symbol pattern (board footer): faint portal outlines in a row. Decorative only. */
export function BrandPattern({ className, count = 14 }: { className?: string; count?: number }) {
  return (
    <svg
      viewBox={`0 0 ${count * 60} 70`}
      preserveAspectRatio="xMinYMid slice"
      className={cn("pointer-events-none text-[var(--lavender)]", className)}
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <g key={i} transform={`translate(${i * 60} 0)`} fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" opacity={0.5 - (i / count) * 0.35}>
          <path d="M6,64 V20 Q6,10 16,8 L40,4 Q50,3 50,13 V58" />
          <path d="M18,66 V32 Q18,24 26,23 L38,21 Q44,21 44,27 V60" />
        </g>
      ))}
    </svg>
  );
}

/** Signature visual pattern ("النمط البصري"): layered translucent sweeps with a luminous wave. Decorative only. */
export function BrandWave({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" className={cn("pointer-events-none", className)} aria-hidden>
      <defs>
        <linearGradient id={`w1-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--royal)" stopOpacity=".0" />
          <stop offset=".5" stopColor="var(--royal)" stopOpacity=".55" />
          <stop offset="1" stopColor="var(--lavender)" stopOpacity=".9" />
        </linearGradient>
        <linearGradient id={`w2-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--lavender)" stopOpacity="0" />
          <stop offset=".6" stopColor="var(--lavender)" stopOpacity=".55" />
          <stop offset="1" stopColor="#FFF7E8" stopOpacity=".9" />
        </linearGradient>
      </defs>
      <path d="M0,300 C220,290 330,170 520,120 C640,90 720,95 800,60 L800,300 Z" fill={`url(#w1-${uid})`} />
      <path d="M120,300 C330,280 460,200 620,170 C700,155 760,150 800,130 L800,300 Z" fill={`url(#w2-${uid})`} opacity=".8" />
      <path d="M0,300 C260,286 380,205 560,168 C660,148 740,140 800,112" fill="none" stroke="#FFF7E8" strokeOpacity=".75" strokeWidth="2" />
    </svg>
  );
}

/** Loading state: the symbol with its path softly pulsing (static under reduced motion). */
export function BrandLoader({ label, className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center gap-3", className)}>
      <LogoMark className="size-14 motion-safe:animate-[brand-breathe_1.8s_ease-in-out_infinite]" />
      {label && <span className="text-muted text-sm">{label}</span>}
    </div>
  );
}
