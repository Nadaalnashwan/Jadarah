"use client";
/**
 * JADARAH landing — a short cinematic introduction over the 3D Riyadh skyline.
 *
 * The existing Three.js scene (city/scene.ts) is the stage: the camera flies along the luminous path between
 * stations while the overlay plays three scenes like a short film — opening → candidates → companies.
 * The timeline autoplays (no audio), shows a continuously filling progress bar, and can be paused, replayed, scrubbed
 * per scene or skipped. It pauses when off-screen or when the tab is hidden. With prefers-reduced-motion there is no
 * autoplay and no camera flight (instant cuts); without WebGL a pre-rendered poster of the same scene is shown.
 * CTAs only lead into the existing authentication journeys (candidate sign-up; employer access request — approval
 * and subscriptions stay with the Super Admin).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ChevronDown, Pause, Play, RotateCcw } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { Chapter } from "./city/scene-chapters";

const CityStage = dynamic(() => import("./city/city-stage"), { ssr: false });

/** Length of one scene on the timeline (the camera flight takes ~5 s of it). */
const SCENE_MS = 9000;

type Pair = [string, string];
type Scene = {
  key: "opening" | "candidates" | "companies";
  chapter: Chapter;
  eyebrow: Pair;
  title: Pair;
  body: Pair;
  cta?: { label: Pair; href: string };
  secondary?: { label: Pair; href: string };
};

const SCENES: Scene[] = [
  {
    key: "opening",
    chapter: "enter",
    eyebrow: ["JADARAH · From skill to opportunity", "جدارة · من المهارة إلى الفرصة"],
    title: ["Your next opportunity starts here.", "مستقبلك المهني يبدأ بخطوة."],
    body: [
      "Explore opportunities, build your skills, and show employers what you can do.",
      "اكتشف فرصك، وطوّر مهاراتك، وخلّ إنجازك يتكلم عنك.",
    ],
  },
  {
    key: "candidates",
    chapter: "develop",
    eyebrow: ["For candidates", "للمرشحين"],
    title: ["Ready for your next opportunity?", "تبحث عن فرصة جديدة؟"],
    body: [
      "Explore jobs, put your skills into practice, and let your work speak for itself.",
      "استكشف الوظائف، وجرّب مهاراتك في مهام عملية، وخلّ أصحاب العمل يشوفون قدراتك.",
    ],
    cta: { label: ["Start your journey", "ابدأ رحلتك"], href: "/sign-up" },
    secondary: { label: ["Browse jobs", "تصفّح الوظائف"], href: "/jobs" },
  },
  {
    key: "companies",
    chapter: "converge",
    eyebrow: ["For companies", "للشركات"],
    title: ["Looking for the right talent?", "تبحث عن الشخص المناسب لفريقك؟"],
    body: [
      "See what candidates can actually do through practical assessments, and hire with confidence.",
      "تعرّف على مهارات المتقدمين من خلال تجارب عملية، واتخذ قرارك بثقة.",
    ],
    cta: { label: ["Discover talent", "اكتشف المواهب"], href: "/employer/request-access" },
    secondary: { label: ["Employer sign-in", "دخول أصحاب العمل"], href: "/sign-in?next=/company" },
  },
];

/** Current colour mode (data-theme attribute set by the theme toggle, else the OS preference). */
function useThemeMode(): "light" | "dark" {
  const [mode, setMode] = useState<"light" | "dark">("light");
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const read = () =>
      setMode((root.dataset.theme as "light" | "dark" | undefined) ?? (mq.matches ? "dark" : "light"));
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    mq.addEventListener("change", read);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", read);
    };
  }, []);
  return mode;
}

export function SaudiCity() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const P = (pair: Pair) => (ar ? pair[1] : pair[0]);
  const reduce = useReducedMotion();
  const mode = useThemeMode();
  const [index, setIndex] = useState(0);
  const [take, setTake] = useState(0); // restarts the progress animation of the current scene
  const [userPaused, setUserPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [wide, setWide] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const elapsed = useRef({ take: 0, ms: 0 }); // playing time already spent in the current take
  const Next = ar ? ArrowLeft : ArrowRight;
  const Prev = ar ? ArrowRight : ArrowLeft;
  const scene = SCENES[index];
  const last = SCENES.length - 1;
  const autoplay = !reduce;
  const playing = autoplay && !userPaused && !ended && visible;

  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let ok = false;
    try {
      const c = document.createElement("canvas");
      ok = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capability check runs once on the client
    setWebgl(ok && !conn?.saveData);
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    // Pause the film when it is off-screen or the tab is hidden.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting && !document.hidden), {
      threshold: 0.35,
    });
    if (sectionRef.current) io.observe(sectionRef.current);
    const vis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => {
      mq.removeEventListener("change", on);
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the 3D stage is rebuilt per mode; show the poster meanwhile
  useEffect(() => setReady(false), [mode]);

  // Timeline: advance after SCENE_MS of playing time; pausing keeps the elapsed time of the current take.
  useEffect(() => {
    if (!playing) return;
    if (elapsed.current.take !== take) elapsed.current = { take, ms: 0 };
    const started = performance.now();
    const t = window.setTimeout(
      () => {
        if (index < last) {
          setIndex(index + 1);
          setTake((n) => n + 1);
        } else setEnded(true);
      },
      Math.max(0, SCENE_MS - elapsed.current.ms),
    );
    return () => {
      window.clearTimeout(t);
      if (elapsed.current.take === take) elapsed.current.ms += performance.now() - started;
    };
  }, [playing, index, take, last]);

  const go = useCallback(
    (i: number) => {
      setIndex(Math.max(0, Math.min(last, i)));
      setTake((n) => n + 1);
      setEnded(false);
      requestAnimationFrame(() => copyRef.current?.focus({ preventScroll: true }));
    },
    [last],
  );
  const replay = () => {
    setUserPaused(false);
    go(0);
  };
  const skip = () => {
    setUserPaused(true);
    const el = document.getElementById("after-city");
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    el?.focus({ preventScroll: true });
  };
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input,textarea")) return;
    if (e.key === (ar ? "ArrowLeft" : "ArrowRight")) go(index + 1);
    else if (e.key === (ar ? "ArrowRight" : "ArrowLeft")) go(index - 1);
  };
  // Keep the architecture opposite the copy (the copy sits on the start side).
  const shift = !wide ? 0 : (ar ? -1 : 1) * (index === 0 ? 0.28 : 0.2);
  const dark = mode === "dark";

  return (
    <section
      ref={sectionRef}
      aria-roledescription={L("introduction film", "فيلم تعريفي")}
      aria-label={L("JADARAH introduction", "تعريف بجدارة")}
      onKeyDown={onKey}
      className="text-foreground relative isolate overflow-hidden"
    >
      <h1 className="sr-only">
        {L("JADARAH — your next opportunity starts here", "جدارة — مستقبلك المهني يبدأ بخطوة")}
      </h1>
      {/* Fills the first viewport exactly: the next section starts at the fold. */}
      <div className="relative h-svh min-h-[600px] w-full">
        <div className="absolute inset-0">
          <Image
            src={`/city/poster-${dark ? "dark" : "light"}-${ar ? "rtl" : "ltr"}.jpg`}
            alt=""
            fill
            priority
            sizes="100vw"
            className={cn("object-cover transition-opacity duration-700", ready && "opacity-0")}
          />
          {webgl && (
            <CityStage
              key={mode}
              mode={mode}
              shift={shift}
              chapter={scene.chapter}
              onReady={() => setReady(true)}
              reducedMotion={!!reduce}
            />
          )}
        </div>
        {/* Legibility veil on the copy side only, in the page colour. */}
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 start-0 w-full from-[var(--background)] via-[var(--background)]/75 to-transparent lg:w-[62%]",
            ar ? "bg-gradient-to-l" : "bg-gradient-to-r",
          )}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--background)]/90 to-transparent" />

        <div
          ref={copyRef}
          tabIndex={-1}
          aria-live="polite"
          className="absolute inset-x-0 top-0 mx-auto flex h-full max-w-7xl flex-col justify-center px-4 pt-16 pb-28 outline-none sm:px-6 lg:pt-20"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={scene.key}
              initial={reduce ? false : { opacity: 0, y: 18, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12, filter: "blur(4px)" }}
              transition={{
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
                delay: reduce || index === 0 ? 0 : 0.35,
              }}
              className="max-w-xl"
            >
              {scene.key === "opening" && (
                <LogoMark className="mb-6 size-14 drop-shadow-[0_8px_24px_rgb(var(--shadow-color)/0.35)]" />
              )}
              <p className="text-primary-ink flex items-center gap-3 text-sm font-bold">
                <span className="h-px w-10 bg-current opacity-60" aria-hidden />
                {P(scene.eyebrow)}
              </p>
              <h2 className="editorial mt-4 text-[2.4rem] leading-[1.12] font-bold text-balance sm:text-6xl">
                {P(scene.title)}
              </h2>
              <p className="text-muted mt-5 max-w-lg text-lg sm:text-xl">{P(scene.body)}</p>
              {scene.cta && (
                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <Button asChild size="lg">
                    <Link href={scene.cta.href}>
                      {P(scene.cta.label)} <Next aria-hidden />
                    </Link>
                  </Button>
                  {scene.secondary && (
                    <Link
                      href={scene.secondary.href}
                      className="text-primary-ink text-sm font-semibold underline-offset-4 hover:underline"
                    >
                      {P(scene.secondary.label)}
                    </Link>
                  )}
                </div>
              )}
              {scene.key === "opening" && (
                <nav aria-label={L("Choose your path", "اختر مسارك")} className="mt-8 flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    size="lg"
                    className="bg-surface/70 backdrop-blur"
                    onClick={() => go(1)}
                  >
                    {L("I'm a candidate", "أنا مرشح")}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="bg-surface/70 backdrop-blur"
                    onClick={() => go(2)}
                  >
                    {L("I'm hiring", "أنا شركة")}
                  </Button>
                </nav>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Player bar: play/pause · timeline (one segment per scene, the current one fills over time) · replay · skip */}
        <div className="absolute inset-x-0 bottom-5 px-4 sm:px-6">
          <div className="bg-surface/75 mx-auto flex max-w-7xl items-center gap-2 rounded-full border p-1.5 shadow-[var(--glow)] backdrop-blur sm:gap-3">
            {autoplay && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => (ended ? replay() : setUserPaused((p) => !p))}
                aria-label={
                  ended ? L("Replay", "إعادة") : userPaused ? L("Play", "تشغيل") : L("Pause", "إيقاف مؤقت")
                }
              >
                {ended ? <RotateCcw /> : userPaused ? <Play /> : <Pause />}
              </Button>
            )}
            {!autoplay && (
              <Button
                size="icon"
                variant="ghost"
                disabled={index === 0}
                onClick={() => go(index - 1)}
                aria-label={L("Previous", "السابق")}
              >
                <Prev />
              </Button>
            )}
            <ol
              className="flex flex-1 items-center gap-1.5"
              aria-label={L("Introduction timeline", "مراحل التعريف")}
            >
              {SCENES.map((s, i) => (
                <li key={s.key} className="flex-1">
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={i === index ? "step" : undefined}
                    aria-label={`${i + 1} / ${SCENES.length} · ${P(s.eyebrow)}`}
                    className="group block w-full py-2.5"
                  >
                    <span className="bg-foreground/15 group-hover:bg-foreground/25 relative block h-1 overflow-hidden rounded-full">
                      <span
                        key={i === index ? `${take}` : "idle"}
                        className={cn(
                          "absolute inset-y-0 start-0 rounded-full bg-[var(--primary)]",
                          i < index || (i === index && (ended || !autoplay)) ? "w-full" : "w-0",
                          i === index && autoplay && !ended && "jd-progress-fill",
                        )}
                        style={
                          i === index && autoplay && !ended
                            ? {
                                animationDuration: `${SCENE_MS}ms`,
                                animationPlayState: playing ? "running" : "paused",
                              }
                            : undefined
                        }
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {!autoplay && index < last && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => go(index + 1)}
                aria-label={L("Next", "التالي")}
              >
                <Next />
              </Button>
            )}
            {autoplay && ended && (
              <span className="text-subtle hidden text-xs font-semibold sm:inline">
                {L("Replay", "إعادة التشغيل")}
              </span>
            )}
            <button
              type="button"
              onClick={skip}
              className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--navy-800)] px-4 py-2 text-xs font-semibold text-[var(--mist)] dark:bg-[var(--surface-2)] dark:text-[var(--foreground)]"
            >
              {L("Skip", "تخطَّ")} <ChevronDown className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
      <p className="sr-only">
        {L(
          "Kingdom Centre, the KAFD skyline, Jeddah Tower and the Al Khobar Water Tower appear as illustrated landmarks; the layered forms are JADARAH architecture.",
          "يظهر برج المملكة وأفق مركز الملك عبدالله المالي وبرج جدة وبرج مياه الخبر كمعالم توضيحية؛ والأشكال الطبقية عمارة من هوية جدارة.",
        )}
      </p>
    </section>
  );
}
