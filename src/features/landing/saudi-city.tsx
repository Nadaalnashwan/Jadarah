"use client";
/**
 * JADARAH landing — the journey "from skill to opportunity" through a Saudi architectural city.
 *
 * A branded visual experience, not a map: one continuous luminous path leads from the plaza through the JADARAH
 * portal, past Kingdom Centre and the KAFD skyline (environment only — never clickable, never a directory), through
 * the layered forms of skill development and practical work, to the convergence gateway.
 * Chapters: enter → discover → develop → demonstrate → converge. Jobs, companies and recruitment live in the
 * application, outside this experience.
 *
 * Accessibility & performance: the 3D stage is lazy-loaded over a static poster rendered from the same scene;
 * arrow keys and buttons move between chapters; prefers-reduced-motion removes flights, drift and moving light;
 * low-power devices get a lighter scene; without WebGL the poster and all copy still work; skipping is one click.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { CHAPTERS, type Chapter } from "./city/scene-chapters";

const CityStage = dynamic(() => import("./city/city-stage"), { ssr: false });

type Pair = [string, string];
type Copy = { eyebrow: Pair; title: Pair; body: Pair; points: Pair[] };

const COPY: Record<Exclude<Chapter, "enter">, Copy> = {
  discover: {
    eyebrow: ["01 · Discover", "٠١ · اكتشف"],
    title: ["Discover your abilities.", "اكتشف قدراتك."],
    body: [
      "Your profile starts from what you really know — your CV, projects and interests — and shows you the skills you already have.",
      "يبدأ ملفك مما تعرفه فعلًا — سيرتك ومشاريعك واهتماماتك — ويُظهر لك المهارات التي تملكها.",
    ],
    points: [
      ["Your CV is read for you; you approve every item", "نقرأ سيرتك وتعتمد أنت كل عنصر"],
      ["Career paths that fit what your profile shows", "مسارات مهنية تناسب ما يُظهره ملفك"],
      ["Try a field with a short exploratory task", "جرّب المجال بمهمة استكشافية قصيرة"],
    ],
  },
  develop: {
    eyebrow: ["02 · Develop", "٠٢ · طوّر"],
    title: ["Develop your skills, layer by layer.", "طوّر مهاراتك، طبقة فوق طبقة."],
    body: [
      "See the gap between where you are and the role you want, then close it with a plan you can follow.",
      "اعرف الفجوة بين موقعك الحالي والدور الذي تريده، ثم اسدّها بخطة واضحة تتابعها.",
    ],
    points: [
      ["Clear skill-gap analysis for a target role", "تحليل واضح للفجوة في المهارات لدور تستهدفه"],
      ["A development plan with milestones and resources", "خطة تطوير بمراحل وموارد تعلّم"],
      ["Progress you can track", "تقدّم يمكنك متابعته"],
    ],
  },
  demonstrate: {
    eyebrow: ["03 · Demonstrate", "٠٣ · أثبت"],
    title: ["Demonstrate what you can do.", "أثبت ما تستطيع فعله."],
    body: [
      "Practical tasks show what a CV can't. Apply, and the job's task opens right away — the same task for every applicant.",
      "المهام العملية تُظهر ما لا تقوله السيرة. قدّم، فتُفتح مهمة الوظيفة فورًا — المهمة نفسها لكل المتقدمين.",
    ],
    points: [
      ["A practical task linked to each role", "مهمة عملية مرتبطة بكل وظيفة"],
      ["Fair: one locked version for everyone", "عدالة: نسخة واحدة ثابتة للجميع"],
      ["Evidence employers can actually review", "أدلة يراجعها صاحب العمل فعلًا"],
    ],
  },
  converge: {
    eyebrow: ["04 · Converge", "٠٤ · الالتقاء"],
    title: ["Every skill opens a path for you.", "كل مهارة تفتح لك طريقًا."],
    body: [
      "Where your demonstrated ability meets the opportunity that matches your potential. People decide — AI only assists.",
      "حيث تلتقي قدراتك المُثبتة بالفرصة التي تناسب إمكاناتك. القرار للإنسان، والذكاء الاصطناعي يساعد فقط.",
    ],
    points: [
      ["Matching explained by evidence, not guesswork", "مطابقة مبنية على الأدلة لا على التخمين"],
      ["Structured interviews, scheduled clearly", "مقابلات منظمة بمواعيد واضحة"],
      ["You are more than your CV says", "أنت أكثر مما تقوله سيرتك"],
    ],
  },
};

/** Current colour mode (data-theme attribute set by the theme toggle, else the OS preference). */
function useThemeMode(): "light" | "dark" {
  const [mode, setMode] = useState<"light" | "dark">("light");
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const read = () => setMode((root.dataset.theme as "light" | "dark" | undefined) ?? (mq.matches ? "dark" : "light"));
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
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [wide, setWide] = useState(true);
  const copyRef = useRef<HTMLDivElement>(null);
  const Next = ar ? ArrowLeft : ArrowRight;
  const Prev = ar ? ArrowRight : ArrowLeft;
  const chapter = CHAPTERS[step];
  const last = CHAPTERS.length - 1;

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
    return () => mq.removeEventListener("change", on);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the 3D stage is rebuilt per mode; show the poster meanwhile
  useEffect(() => setReady(false), [mode]);

  const go = useCallback(
    (i: number) => {
      setStep(Math.max(0, Math.min(last, i)));
      requestAnimationFrame(() => copyRef.current?.focus({ preventScroll: true }));
    },
    [last],
  );
  const skip = () => {
    const el = document.getElementById("after-city");
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    el?.focus({ preventScroll: true });
  };
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input,textarea")) return;
    if (e.key === (ar ? "ArrowLeft" : "ArrowRight")) go(step + 1);
    else if (e.key === (ar ? "ArrowRight" : "ArrowLeft")) go(step - 1);
  };
  // Keep the architecture opposite the copy (the copy sits on the start side).
  const shift = !wide ? 0 : (ar ? -1 : 1) * (step === 0 ? 0.3 : 0.2);
  const dark = mode === "dark";
  const copy = chapter === "enter" ? null : COPY[chapter];

  return (
    <section aria-labelledby="city-title" onKeyDown={onKey} className="text-foreground relative isolate overflow-hidden bg-[var(--background)]">
      <div className="relative h-[100svh] max-h-[1000px] min-h-[660px] w-full">
        <Image
          src={`/city/poster-${dark ? "dark" : "light"}-${ar ? "rtl" : "ltr"}.jpg`}
          alt=""
          fill
          priority
          sizes="100vw"
          className={cn("object-cover transition-opacity duration-700", ready && "opacity-0")}
        />
        {webgl && <CityStage key={mode} mode={mode} shift={shift} chapter={chapter} onReady={() => setReady(true)} reducedMotion={!!reduce} />}
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 start-0 w-full from-[var(--background)] via-[var(--background)]/70 to-transparent lg:w-[60%]",
            ar ? "bg-gradient-to-l" : "bg-gradient-to-r",
          )}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[var(--background)]/85 to-transparent" />

        <div ref={copyRef} tabIndex={-1} aria-live="polite" className="absolute inset-x-0 top-0 mx-auto max-w-7xl px-4 pt-28 outline-none sm:px-6 sm:pt-36">
          <AnimatePresence mode="wait">
            <motion.div
              key={chapter}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.6, delay: reduce || step === 0 ? 0 : 0.5 }}
              className="max-w-xl"
            >
              <p className="text-primary flex items-center gap-3 text-sm font-bold dark:text-[var(--lavender)]">
                <span className="h-px w-10 bg-current opacity-60" aria-hidden />
                {copy ? P(copy.eyebrow) : L("From skill to opportunity", "من المهارة إلى الفرصة")}
              </p>
              {copy ? (
                <>
                  <h2 className="editorial mt-4 text-[2.2rem] leading-[1.15] font-bold text-balance sm:text-5xl">{P(copy.title)}</h2>
                  <p className="text-muted mt-5 text-lg">{P(copy.body)}</p>
                  <ul className="mt-6 flex flex-col gap-2.5">
                    {copy.points.map((pt) => (
                      <li key={pt[0]} className="flex items-start gap-3 text-sm sm:text-base">
                        <span className="mt-2 size-2 shrink-0 rotate-45 rounded-[2px] bg-[var(--royal)] shadow-[0_0_10px_var(--lavender)]" aria-hidden />
                        {P(pt)}
                      </li>
                    ))}
                  </ul>
                  {chapter === "converge" && (
                    <div className="mt-8 flex flex-wrap gap-3">
                      <Button asChild size="lg">
                        <Link href="/sign-up?type=candidate">{L("Create your account and start now", "أنشئ حسابك وابدأ الآن")}</Link>
                      </Button>
                      <Button size="lg" variant="outline" className="bg-surface/60 backdrop-blur" onClick={() => go(0)}>
                        <RotateCcw /> {L("Replay the journey", "أعد الرحلة")}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h1 id="city-title" className="editorial mt-4 text-[2.5rem] leading-[1.12] font-bold text-balance sm:text-6xl">
                    {L("Your career starts here.", "مستقبلك المهني يبدأ من هنا.")}
                  </h1>
                  <p className="text-muted mt-5 text-lg sm:text-xl">
                    {L(
                      "Discover opportunities, try your skills, and get closer to the place you deserve.",
                      "اكتشف الفرص، جرّب مهاراتك، واقترب من المكان الذي تستحقه.",
                    )}
                  </p>
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Button size="lg" onClick={() => go(1)}>
                      {L("Start your journey", "ابدأ رحلتك")} <Next />
                    </Button>
                    <Button asChild size="lg" variant="outline" className="bg-surface/60 backdrop-blur">
                      <Link href="/sign-up?type=candidate">{L("I'm looking for an opportunity", "أنا أبحث عن فرصة")}</Link>
                    </Button>
                  </div>
                  <nav aria-label={L("Direct paths", "مسارات مباشرة")} className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
                    <Link href="/employer/request-access" className="underline-offset-4 hover:underline">
                      {L("I represent a company", "أنا أمثل شركة")}
                    </Link>
                    <Link href="/jobs" className="underline-offset-4 hover:underline">
                      {L("Explore jobs", "استكشف الوظائف")}
                    </Link>
                    <Link href="/sign-in" className="underline-offset-4 hover:underline">
                      {L("Sign in", "تسجيل الدخول")}
                    </Link>
                  </nav>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Journey controls: a luminous progress line (the path), previous / next, skip */}
        <div className="absolute inset-x-0 bottom-5 px-4 sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center gap-3 sm:gap-4">
            <Button
              size="icon"
              variant="ghost"
              disabled={step === 0}
              onClick={() => go(step - 1)}
              aria-label={L("Previous", "السابق")}
              className="bg-surface/60 backdrop-blur"
            >
              <Prev />
            </Button>
            <ol className="flex flex-1 items-center gap-1.5" aria-label={L("Journey progress", "مراحل الرحلة")}>
              {CHAPTERS.map((c, i) => (
                <li key={c} className="flex-1">
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={i === step ? "step" : undefined}
                    aria-label={`${i + 1} / ${CHAPTERS.length}`}
                    className="group block w-full py-3"
                  >
                    <span
                      className={cn(
                        "block h-1 rounded-full transition-all duration-500",
                        i < step && "bg-[var(--lavender)]",
                        i === step && "bg-[var(--royal)] shadow-[0_0_14px_var(--lavender)]",
                        i > step && "bg-foreground/15 group-hover:bg-foreground/30",
                      )}
                    />
                  </button>
                </li>
              ))}
            </ol>
            {step < last ? (
              <Button size="sm" onClick={() => go(step + 1)}>
                {step === 0 ? L("Start", "ابدأ") : L("Continue", "تابع")} <Next />
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link href="/sign-up?type=candidate">{L("Create account", "إنشاء حساب")}</Link>
              </Button>
            )}
            <button
              type="button"
              onClick={skip}
              className="flex shrink-0 items-center gap-1 rounded-full bg-[#0D1B3F] px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/15"
            >
              {L("Skip", "تخطَّ")} <ChevronDown className="size-3.5" />
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
