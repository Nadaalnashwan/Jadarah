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
    // Build the scene at the first idle moment (≤ 700 ms) instead of during first paint: compiling the city's
    // shaders blocks the main thread, and the poster of the same scene is already on screen meanwhile.
    let stop: (() => void) | undefined;
    let cancelled = false;
    const run = () => {
      if (!cancelled) stop = start();
    };
    const idle = "requestIdleCallback" in window; // Safari before 18 lacks it
    const handle = idle ? window.requestIdleCallback(run, { timeout: 700 }) : window.setTimeout(run, 120);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      stop?.();
    };

    function start(): (() => void) | undefined {
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
      // Adaptive quality: average the cost of the first frames and step the resolution down on slow devices.
      let ratio = c.renderer.getPixelRatio();
      let samples = 0;
      let spent = 0;
      c.renderer.setAnimationLoop((now) => {
        if (!visible || document.hidden) return;
        if (!first && now - last < (reducedMotion ? 400 : 22)) return;
        last = now;
        const t = performance.now();
        c.render(now);
        if (first) {
          first = false;
          onReady();
          return;
        }
        if (samples < 45) {
          spent += performance.now() - t;
          if (++samples === 45 && spent / samples > 16 && ratio > 0.75) {
            ratio = Math.max(0.75, ratio - 0.5);
            c.setPixelRatio(ratio);
            samples = 0;
            spent = 0;
          }
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
    }
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
