"use client";
import { useEffect, useRef } from "react";
import { createCityScene, type Chapter, type Mode } from "./scene";

/**
 * WebGL stage for the landing journey. Loaded lazily (next/dynamic, no SSR). Renders only while visible and the tab
 * is active; rebuilt when the colour mode changes. Purely visual — all navigation lives in the HTML overlay.
 */
export default function CityStage({
  chapter,
  onReady,
  reducedMotion,
  mode,
  shift,
}: {
  chapter: Chapter;
  onReady: () => void;
  reducedMotion: boolean;
  mode: Mode;
  /** Horizontal lens shift (−0.5..0.5): keeps the subject opposite the copy. */
  shift: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const city = useRef<ReturnType<typeof createCityScene> | null>(null);

  useEffect(() => {
    const el = wrap.current!;
    const small = window.matchMedia("(max-width: 767px)").matches;
    const lowPower = small || (navigator.hardwareConcurrency ?? 8) <= 4;
    let c: ReturnType<typeof createCityScene>;
    try {
      c = createCityScene(canvas.current!, { quality: lowPower ? "low" : "high", reducedMotion, mode });
    } catch {
      return; // no WebGL → the poster stays
    }
    city.current = c;
    const size = () => c.resize(el.clientWidth, el.clientHeight);
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    let first = true;
    let last = 0;
    c.renderer.setAnimationLoop((now) => {
      if (!visible || document.hidden) return;
      if (!first && now - last < (reducedMotion ? 400 : 22)) return;
      last = now;
      c.render(now);
      if (first) {
        first = false;
        onReady();
      }
    });
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      c.setPointer((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
    };
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointermove", move);
      ro.disconnect();
      io.disconnect();
      c.dispose();
      city.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, mode]);

  useEffect(() => {
    city.current?.focus(chapter);
  }, [chapter, mode]);
  useEffect(() => {
    city.current?.setShift(shift);
  }, [shift, mode]);

  return (
    <div ref={wrap} className="absolute inset-0" aria-hidden>
      <canvas ref={canvas} className="block h-full w-full" />
    </div>
  );
}
