"use client";
import { useEffect, useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ease } from "@/lib/motion";

const LAYERS = [
  { fill: "var(--navy-700)", y: 330, depth: 6 },
  { fill: "var(--royal)", y: 262, depth: 12, opacity: 0.85 },
  { fill: "var(--lavender)", y: 194, depth: 18 },
  { fill: "var(--sky)", y: 126, depth: 24 },
  { fill: "var(--royal)", y: 58, depth: 32 },
] as const;

/**
 * Signature motion: five capability layers rise into view —
 * hidden ability → discovery → evidence → intelligence → opportunity —
 * and are connected by a single evidence thread ending in the diamond.
 * Pointer movement adds controlled depth parallax. Honours prefers-reduced-motion.
 */
export function SignatureLayers({ labels, className }: { labels: readonly string[]; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
      my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
    };
    const onLeave = () => {
      mx.set(0);
      my.set(0);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [mx, my, reduce]);

  return (
    <div ref={ref} className={className}>
      <svg
        viewBox="0 0 520 460"
        className="h-full w-full overflow-visible"
        role="img"
        aria-label={labels.join(" → ")}
      >
        <defs>
          <linearGradient id="thread" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="var(--lavender)" stopOpacity="0.2" />
            <stop offset="1" stopColor="var(--royal)" />
          </linearGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>

        {/* ambient glow */}
        <motion.circle
          cx="330"
          cy="170"
          r="120"
          fill="var(--lavender)"
          opacity={0.25}
          filter="url(#soft)"
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.25 }}
          transition={{ duration: 1.6, ease: ease.out }}
        />

        {LAYERS.map((layer, i) => (
          <Layer key={i} index={i} layer={layer} label={labels[i] ?? ""} sx={sx} sy={sy} reduce={!!reduce} />
        ))}

        {/* evidence thread */}
        <motion.path
          d="M120 352 C 180 300, 150 270, 210 284 S 260 230, 270 216 S 320 160, 330 148 S 390 90, 444 92"
          fill="none"
          stroke="url(#thread)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="1 0"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.8, delay: 0.9, ease: ease.inOut }}
        />
        {/* the merit diamond */}
        <motion.path
          d="M452 62 l26 26 -26 26 -26 -26z"
          fill="var(--royal)"
          initial={reduce ? false : { scale: 0, rotate: -45, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 14, delay: 2.4 }}
          style={{ transformOrigin: "452px 88px" }}
        />
        {!reduce && (
          <motion.path
            d="M452 62 l26 26 -26 26 -26 -26z"
            fill="none"
            stroke="var(--royal)"
            strokeWidth="1.5"
            initial={{ scale: 1, opacity: 0 }}
            animate={{ scale: [1, 1.9], opacity: [0.6, 0] }}
            transition={{ duration: 2.4, delay: 2.8, repeat: Infinity, repeatDelay: 1.2, ease: "easeOut" }}
            style={{ transformOrigin: "452px 88px" }}
          />
        )}
      </svg>
    </div>
  );
}

function Layer({
  index,
  layer,
  label,
  sx,
  sy,
  reduce,
}: {
  index: number;
  layer: (typeof LAYERS)[number];
  label: string;
  sx: MotionValue<number>;
  sy: MotionValue<number>;
  reduce: boolean;
}) {
  const x0 = 40 + index * 58;
  const tx = useTransform(sx, (v) => v * layer.depth);
  const ty = useTransform(sy, (v) => v * layer.depth * 0.5);
  const w = 250;
  const h = 46;
  const skew = 26;
  const d = `M${x0 + skew} ${layer.y} h${w} l${-skew} ${h} h${-w} z`;
  return (
    <motion.g style={{ x: tx, y: ty }}>
      <motion.g
        initial={reduce ? false : { opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.15 + index * 0.16, ease: ease.out }}
      >
        <path d={d} fill={layer.fill} opacity={"opacity" in layer ? layer.opacity : 1} />
        <circle
          cx={x0 + 80}
          cy={layer.y + h / 2 + 4}
          r="4"
          fill={index === 0 ? "var(--ivory)" : "var(--navy)"}
          opacity="0.85"
        />
        <text
          x={x0 + 96}
          y={layer.y + h / 2 + 9}
          fontSize="15"
          fontWeight="700"
          fill={index === 0 || index === 1 || index === 4 ? "var(--ivory)" : "var(--navy)"}
          style={{ fontFamily: "var(--font-sans)", direction: "ltr", unicodeBidi: "plaintext" }}
        >
          {label}
        </text>
      </motion.g>
    </motion.g>
  );
}
