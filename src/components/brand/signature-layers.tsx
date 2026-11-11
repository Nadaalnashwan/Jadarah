"use client";
import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { LogoMark } from "./logo";
import { cn } from "@/lib/utils";

/**
 * Signature brand visual (brand board, "فكرة الشعار"): the approved symbol at monumental scale, glowing, with the
 * three logo concepts — skill development (layers), connecting opportunities (the path), arrival (the opening).
 * Gentle pointer parallax; static under prefers-reduced-motion.
 */
export function SignatureLayers({ className, concepts }: { labels?: readonly string[]; className?: string; concepts?: { title: string; body: string }[] }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });
  const rx = useTransform(sy, [-0.5, 0.5], [4, -4]);
  const ry = useTransform(sx, [-0.5, 0.5], [-6, 6]);
  return (
    <div
      ref={ref}
      className={cn("relative grid place-items-center", className)}
      onPointerMove={(e) => {
        if (reduce || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,rgb(169_184_255/0.55),transparent_65%)] blur-2xl" aria-hidden />
      <motion.div style={reduce ? undefined : { rotateX: rx, rotateY: ry }} className="relative w-[78%] [perspective:900px]">
        <LogoMark className="h-auto w-full drop-shadow-[0_30px_60px_rgb(59_108_255/0.45)]" />
      </motion.div>
      {concepts && (
        <ul className="relative mt-8 grid w-full gap-4 sm:grid-cols-3">
          {concepts.map((c) => (
            <li key={c.title} className="text-center">
              <p className="font-bold">{c.title}</p>
              <p className="text-sm opacity-75">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
