"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleDashed,
  CircleHelp,
  CircleSlash,
  Sparkles,
  UserRound,
} from "lucide-react";
import { SignatureLayers } from "@/components/brand/signature-layers";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import type { MatchStatus } from "@/lib/domain/matching";
import { ease, fadeUp, stagger, viewportOnce } from "@/lib/motion";
import { cn } from "@/lib/utils";

function Arrow({ className }: { className?: string }) {
  const { locale } = useI18n();
  const Icon = locale === "ar" ? ArrowLeft : ArrowRight;
  return <Icon className={className} aria-hidden />;
}

/* ------------------------------------------------------------------ HERO */
export function Hero() {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const visualY = useTransform(scrollY, [0, 600], [0, reduce ? 0 : 80]);
  const words = t.landing.heroTitle.split(" ");

  return (
    <section className="relative isolate overflow-hidden pt-28 pb-16 sm:pt-36 lg:min-h-[100dvh] lg:pt-40">
      <div className="grain pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] opacity-60" />
      <div className="pointer-events-none absolute start-1/2 -top-40 -z-10 size-[56rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--sky)_0%,transparent_60%)] opacity-60 rtl:translate-x-1/2" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
        <motion.div initial="hidden" animate="show" variants={stagger(0.06, 0.1)}>
          <motion.p variants={fadeUp} className="eyebrow mb-6 inline-flex items-center gap-2">
            <span className="bg-primary inline-block size-1.5 rounded-full" /> {t.landing.heroEyebrow}
          </motion.p>
          <h1 className="editorial text-[2.6rem] font-extrabold text-balance sm:text-6xl lg:text-[4.6rem]">
            {words.map((w, i) => (
              <span key={i}>
                <motion.span
                  className="inline-block"
                  initial={reduce ? false : { opacity: 0, y: "0.6em", filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.7, delay: 0.15 + i * 0.07, ease: ease.out }}
                >
                  {i === words.length - 1 ? (
                    <span className="from-royal to-lavender bg-gradient-to-r bg-clip-text text-transparent rtl:bg-gradient-to-l">
                      {w}
                    </span>
                  ) : (
                    w
                  )}
                </motion.span>
                {i < words.length - 1 && " "}
              </span>
            ))}
          </h1>
          <motion.p variants={fadeUp} className="text-muted mt-6 max-w-xl text-lg leading-relaxed sm:text-xl">
            {t.landing.heroBody}
          </motion.p>
          <motion.div variants={fadeUp} className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up?type=candidate">
                {t.landing.ctaExplore}
                <Arrow />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/for-companies">{t.landing.ctaCompanies}</Link>
            </Button>
          </motion.div>
        </motion.div>
        <motion.div style={{ y: visualY }} className="relative mx-auto w-full max-w-xl">
          <SignatureLayers labels={t.landing.layers} className="aspect-[52/46] w-full" />
        </motion.div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- PROBLEM */
export function ProblemComparison() {
  const { t } = useI18n();
  return (
    <section className="relative py-24 sm:py-32" aria-labelledby="problem-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <motion.div initial="hidden" whileInView="show" viewport={viewportOnce} variants={stagger()}>
            <motion.p variants={fadeUp} className="eyebrow mb-4">
              {t.landing.problemEyebrow}
            </motion.p>
            <motion.h2
              variants={fadeUp}
              id="problem-title"
              className="editorial text-4xl font-extrabold text-balance sm:text-5xl"
            >
              {t.landing.problemTitle}
            </motion.h2>
            <motion.p variants={fadeUp} className="text-muted mt-6 text-lg leading-relaxed">
              {t.landing.problemBody}
            </motion.p>
          </motion.div>
          <div className="flex flex-col gap-5">
            <Lane
              title={t.landing.traditional}
              steps={t.landing.traditionalSteps}
              note={t.landing.traditionalNote}
              muted
            />
            <Lane title={t.landing.jadarah} steps={t.landing.jadarahSteps} note={t.landing.jadarahNote} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Lane({
  title,
  steps,
  note,
  muted,
}: {
  title: string;
  steps: readonly string[];
  note: string;
  muted?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewportOnce}
      transition={{ duration: 0.7, ease: ease.out }}
      className={cn(
        "relative overflow-hidden rounded-3xl border p-6 sm:p-8",
        muted
          ? "bg-surface-2/60"
          : "bg-navy text-ivory border-transparent shadow-[0_30px_80px_-30px_rgb(15_27_61/0.6)]",
      )}
    >
      <div className="mb-6 flex items-center justify-between">
        <h3
          className={cn(
            "text-sm font-bold tracking-[0.18em] uppercase rtl:tracking-normal",
            muted ? "text-subtle" : "text-lavender",
          )}
        >
          {title}
        </h3>
        <span className={cn("text-xs", muted ? "text-subtle" : "text-sky/80")}>{note}</span>
      </div>
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <motion.li
            key={s}
            className="flex items-center gap-2"
            initial={reduce ? false : { opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={viewportOnce}
            transition={{ delay: 0.25 + i * 0.12, duration: 0.5, ease: ease.out }}
          >
            <span
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold",
                muted
                  ? "border-border-strong text-muted decoration-subtle/40 border line-through"
                  : i === steps.length - 1
                    ? "bg-royal text-white"
                    : "text-ivory bg-white/10",
              )}
            >
              {s}
            </span>
            {i < steps.length - 1 && (
              <span className={cn("h-px w-5", muted ? "bg-border-strong" : "bg-lavender/60")} aria-hidden />
            )}
          </motion.li>
        ))}
      </ol>
    </motion.div>
  );
}

/* -------------------------------------------------------------- SOLUTION */
export function SolutionStages() {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const stages = t.landing.stages;
  return (
    <section
      id="product"
      className="bg-surface relative scroll-mt-24 py-24 sm:py-32"
      aria-labelledby="solution-title"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="eyebrow mb-4">{t.landing.solutionEyebrow}</p>
        <h2
          id="solution-title"
          className="editorial max-w-3xl text-4xl font-extrabold text-balance sm:text-5xl"
        >
          {t.landing.solutionTitle}
        </h2>
        <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div role="tablist" aria-orientation="vertical" className="relative flex flex-col">
            <span className="bg-border absolute start-[1.15rem] top-4 bottom-4 w-px" aria-hidden />
            <motion.span
              className="bg-primary absolute start-[1.15rem] top-4 w-px"
              animate={{ height: `calc(${(active / (stages.length - 1)) * 100}% - 2rem)` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
              aria-hidden
            />
            {stages.map((s, i) => (
              <button
                key={s.key}
                role="tab"
                aria-selected={active === i}
                aria-controls="stage-panel"
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                className="group relative flex items-center gap-4 rounded-2xl py-3 pe-4 text-start transition"
              >
                <span
                  className={cn(
                    "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300",
                    i <= active
                      ? "border-primary bg-primary text-white"
                      : "border-border-strong bg-surface text-subtle",
                  )}
                >
                  {i + 1}
                </span>
                <span
                  className={cn(
                    "text-xl font-bold transition-colors sm:text-2xl",
                    active === i ? "text-foreground" : "text-subtle group-hover:text-muted",
                  )}
                >
                  {s.title}
                </span>
              </button>
            ))}
          </div>
          <div
            id="stage-panel"
            role="tabpanel"
            aria-live="polite"
            className="bg-navy text-ivory relative min-h-72 overflow-hidden rounded-3xl p-8 sm:p-10"
          >
            <StageGlyph index={active} />
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: ease.out }}
                className="relative"
              >
                <p className="ltr-nums text-lavender text-sm font-bold">0{active + 1}</p>
                <h3 className="mt-3 text-3xl font-extrabold sm:text-4xl">{stages[active].title}</h3>
                <p className="text-sky/90 mt-4 max-w-md text-lg leading-relaxed">{stages[active].body}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

function StageGlyph({ index }: { index: number }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className="pointer-events-none absolute -end-10 -bottom-10 size-72 opacity-90"
      aria-hidden
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <motion.path
          key={i}
          d={`M${40 + i * 14} ${150 - i * 22}h80l-14 18h-80z`}
          animate={{ opacity: i <= index ? 1 : 0.12, x: i <= index ? 0 : -8 }}
          transition={{ duration: 0.45, delay: i * 0.04, ease: ease.out }}
          fill={i === index ? "var(--royal)" : i < index ? "var(--lavender)" : "var(--ivory)"}
        />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------- SHOWCASE */
// Product explainer. It shows how JADARAH works without any candidate, company, job or statistic —
// the landing page never presents fictional or sample records as platform activity.
const statusIcon: Record<MatchStatus, React.ReactNode> = {
  matched: <CheckCircle2 className="text-success size-4" aria-hidden />,
  partial: <CircleDashed className="text-warning size-4" aria-hidden />,
  unverified: <CircleHelp className="text-primary dark:text-lavender size-4" aria-hidden />,
  missing: <CircleSlash className="text-danger size-4" aria-hidden />,
};

export function ProductShowcase() {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<"candidate" | "company">("candidate");
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);

  const evidence: [string, string, string][] = [
    ["self", L("Self-declared", "مُصرَّح بها ذاتيًا"), L("You add it; it is shown as your claim.", "تضيفها أنت، وتظهر كتصريح منك.")],
    ["cv", L("From your reviewed CV", "من سيرتك بعد مراجعتها"), L("Extracted from your CV and approved by you.", "مستخرجة من سيرتك ومعتمدة منك.")],
    ["task", L("Demonstrated", "مُثبتة عمليًا"), L("Shown in a practical task you submitted.", "ظهرت في مهمة عملية سلّمتها.")],
    ["verified", L("Verified", "موثّقة"), L("Confirmed by an accountable reviewer.", "أكّدها مُراجِع مسؤول.")],
  ];
  const statuses: MatchStatus[] = ["matched", "partial", "unverified", "missing"];
  const statusNote: Record<MatchStatus, string> = {
    matched: L("Your evidence meets the requirement.", "أدلتك تستوفي المتطلب."),
    partial: L("Present, below the required level.", "موجودة بمستوى أقل من المطلوب."),
    unverified: L("Claimed but not yet demonstrated.", "مُصرَّح بها ولم تُثبت بعد."),
    missing: L("Not in your profile yet.", "غير موجودة في ملفك بعد."),
  };
  const candidateSteps = [
    L("Apply with your profile and CV", "تقدّم بملفك وسيرتك"),
    L("The job's practical task opens immediately", "تُفتح المهمة العملية للوظيفة فورًا"),
    L("Submit — your application is complete", "سلّمها — فيكتمل طلبك"),
    L("Follow every decision on your timeline", "تابع كل قرار في مسار طلبك"),
  ];
  const companySteps: [string, string][] = [
    [L("Application + practical task", "الطلب + المهمة العملية"), L("Candidates receive the job's task the moment they apply — no manual step.", "يستلم المرشح مهمة الوظيفة لحظة تقديمه — دون خطوة يدوية.")],
    [L("Evaluate the evidence", "قيّم الأدلة"), L("CV, profile and the submitted task, scored against your rubric.", "السيرة والملف والمهمة المسلّمة، مقيّمة وفق معاييرك.")],
    [L("Shortlist, then interview", "القائمة المختصرة ثم المقابلة"), L("Interviews are scheduled only for shortlisted candidates.", "تُجدول المقابلات للمرشحين في القائمة المختصرة فقط.")],
    [L("Decide", "القرار"), L("People decide. A hiring decision never requires a shortlist.", "القرار للأشخاص، ولا يتطلب قرار التعيين قائمة مختصرة.")],
  ];

  return (
    <section className="py-24 sm:py-32" aria-labelledby="showcase-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow mb-4">{t.landing.showcaseEyebrow}</p>
            <h2 id="showcase-title" className="editorial text-4xl font-extrabold text-balance sm:text-5xl">
              {t.landing.showcaseTitle}
            </h2>
          </div>
          <div role="tablist" className="bg-surface relative flex rounded-full border p-1">
            {(["candidate", "company"] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn(
                  "relative z-10 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-colors",
                  tab === k ? "text-white" : "text-muted",
                )}
              >
                {tab === k && (
                  <motion.span
                    layoutId="showcase-pill"
                    className="bg-navy dark:bg-royal absolute inset-0 -z-10 rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {k === "candidate" ? <UserRound className="size-4" /> : <Building2 className="size-4" />}
                {k === "candidate" ? t.landing.showcaseCandidate : t.landing.showcaseCompany}
              </button>
            ))}
          </div>
        </div>
        <p className="text-subtle mt-4 text-xs font-semibold">{t.landing.showcaseNote}</p>

        <div className="bg-surface mt-8 overflow-hidden rounded-[2rem] border p-2 shadow-[0_40px_120px_-50px_rgb(15_27_61/0.5)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: ease.out }}
              className="bg-background grid gap-2 rounded-[1.6rem] p-4 sm:p-6 lg:grid-cols-3"
            >
              {tab === "candidate" ? (
                <>
                  <Panel title={L("Every skill carries its source", "كل مهارة تحمل مصدرها")}>
                    <ul className="flex flex-col gap-3">
                      {evidence.map(([k, title, body]) => (
                        <li key={k} className="bg-surface rounded-xl px-3 py-2.5">
                          <p className="text-sm font-semibold">{title}</p>
                          <p className="text-subtle text-xs">{body}</p>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                  <Panel title={L("An explainable match", "مطابقة قابلة للتفسير")}>
                    <ul className="flex flex-col gap-3">
                      {statuses.map((st) => (
                        <li key={st} className="flex items-start gap-2.5 text-sm">
                          <span className="mt-0.5">{statusIcon[st]}</span>
                          <span>
                            <span className="font-semibold">{t.match[st]}</span>
                            <span className="text-subtle block text-xs">{statusNote[st]}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                  <Panel title={L("Apply → practical task", "التقديم ← المهمة العملية")}>
                    <Steps items={candidateSteps} />
                  </Panel>
                </>
              ) : (
                <>
                  <Panel title={L("From application to decision", "من الطلب إلى القرار")} className="lg:col-span-2">
                    <ol className="grid gap-3 sm:grid-cols-2">
                      {companySteps.map(([title, body], i) => (
                        <li key={title} className="bg-surface flex gap-3 rounded-xl p-3">
                          <span className="bg-accent-soft text-primary dark:text-lavender ltr-nums flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                            {i + 1}
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">{title}</span>
                            <span className="text-subtle block text-xs">{body}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </Panel>
                  <Panel title={L("Compare on evidence", "قارن بالأدلة")}>
                    <p className="text-muted text-sm leading-relaxed">
                      {L(
                        "Put candidates side by side requirement by requirement — what is demonstrated, claimed or missing. AI suggestions are labelled; your team decides.",
                        "ضع المرشحين جنبًا إلى جنب متطلبًا بمتطلب — ما أُثبت وما صُرّح به وما ينقص. اقتراحات الذكاء الاصطناعي موسومة، والقرار لفريقك.",
                      )}
                    </p>
                  </Panel>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-surface-2/40 rounded-2xl border p-4 sm:p-5", className)}>
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((label, i) => (
        <li key={label} className="bg-surface flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm">
          <span className="bg-accent-soft text-primary dark:text-lavender ltr-nums flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
            {i + 1}
          </span>
          <span className="font-semibold">{label}</span>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------- AI PIPELINE */
export function AIPipeline() {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const legend = [
    { key: "verified", tone: "bg-success", label: t.landing.aiLegend.verified },
    { key: "extracted", tone: "bg-sky", label: t.landing.aiLegend.extracted },
    { key: "inferred", tone: "bg-lavender", label: t.landing.aiLegend.inferred },
    { key: "human", tone: "bg-royal", label: t.landing.aiLegend.human },
  ];
  return (
    <section
      className="bg-navy text-ivory relative overflow-hidden py-24 sm:py-32"
      aria-labelledby="ai-title"
    >
      <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(var(--ivory)_1px,transparent_1px),linear-gradient(90deg,var(--ivory)_1px,transparent_1px)] [background-size:56px_56px] opacity-[0.07]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <p className="eyebrow !text-lavender mb-4">{t.landing.aiEyebrow}</p>
        <h2 id="ai-title" className="editorial max-w-3xl text-4xl font-extrabold text-balance sm:text-5xl">
          {t.landing.aiTitle}
        </h2>
        <ol className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {t.landing.aiSteps.map((s, i) => (
            <motion.li
              key={s}
              initial={reduce ? false : { opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewportOnce}
              transition={{ delay: i * 0.1, duration: 0.6, ease: ease.out }}
              className={cn(
                "relative flex min-h-36 flex-col justify-between rounded-2xl border p-4",
                i === 5
                  ? "border-royal bg-royal"
                  : i >= 3
                    ? "border-lavender/30 bg-lavender/10"
                    : "border-sky/20 bg-white/5",
              )}
            >
              <span className="ltr-nums text-sky/70 text-xs font-bold">0{i + 1}</span>
              <span className="text-lg font-bold">{s}</span>
              {i === 4 && <Sparkles className="text-lavender absolute end-4 top-4 size-4" aria-hidden />}
            </motion.li>
          ))}
        </ol>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {legend.map((l) => (
            <li key={l.key} className="text-sky/90 flex items-center gap-3 text-sm">
              <span className={cn("size-3 shrink-0 rounded-sm", l.tone)} aria-hidden />
              {l.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------------------------------------------- CAREER TRANSFORMATION */
export function CareerTransformation() {
  const { t, locale } = useI18n();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const steps: [string, string][] = [
    [L("Choose a target role", "اختر دورًا مستهدفًا"), L("Pick where you want to go next.", "حدّد وجهتك التالية.")],
    [L("See your real gaps", "اعرف فجواتك الحقيقية"), L("Calculated only from the evidence in your own profile.", "تُحسب من الأدلة في ملفك فقط.")],
    [L("Follow a plan", "اتبع خطة"), L("Milestones linked to vetted learning resources.", "مراحل مرتبطة بمصادر تعلّم معتمدة.")],
    [L("Prove it in practice", "أثبتها عمليًا"), L("Practical tasks turn learning into demonstrated evidence.", "المهام العملية تحوّل التعلّم إلى أدلة مُثبتة.")],
  ];
  return (
    <section className="py-24 sm:py-32" aria-labelledby="career-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="eyebrow mb-4">{t.landing.careerEyebrow}</p>
        <h2 id="career-title" className="editorial max-w-3xl text-4xl font-extrabold text-balance sm:text-5xl">
          {t.landing.careerTitle}
        </h2>
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label={t.landing.careerMilestones}>
          {steps.map(([title, body], i) => (
            <motion.li
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewportOnce}
              transition={{ duration: 0.5, delay: i * 0.08, ease: ease.out }}
              className="surface-card flex flex-col gap-3 p-6"
            >
              <span className="bg-primary ltr-nums flex size-8 items-center justify-center rounded-full text-xs font-bold text-white">
                {i + 1}
              </span>
              <p className="text-lg font-extrabold">{title}</p>
              <p className="text-muted text-sm">{body}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* --------------------------------------------------- AUDIENCES + CLOSING */
export function Audiences() {
  const { t } = useI18n();
  const cards = [
    {
      title: t.landing.audiencesCompaniesTitle,
      body: t.landing.audiencesCompaniesBody,
      href: "/for-companies",
      dark: true,
    },
    {
      title: t.landing.audiencesCandidatesTitle,
      body: t.landing.audiencesCandidatesBody,
      href: "/for-candidates",
      dark: false,
    },
  ];
  return (
    <section className="pb-24 sm:pb-32">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 lg:grid-cols-2">
        {cards.map((c) => (
          <motion.div
            key={c.href}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            variants={fadeUp}
          >
            <Link
              href={c.href}
              className={cn(
                "group relative flex min-h-80 flex-col justify-between overflow-hidden rounded-[2rem] p-8 transition-transform duration-500 hover:-translate-y-1 sm:p-10",
                c.dark ? "bg-navy text-ivory" : "bg-sky text-navy",
              )}
            >
              <h3 className="editorial max-w-md text-4xl font-extrabold sm:text-5xl">{c.title}</h3>
              <div className="flex items-end justify-between gap-6">
                <p
                  className={cn(
                    "max-w-md text-base leading-relaxed",
                    c.dark ? "text-sky/90" : "text-navy/75",
                  )}
                >
                  {c.body}
                </p>
                <span
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110",
                    c.dark ? "bg-royal" : "bg-navy text-ivory",
                  )}
                >
                  <Arrow className="size-5" />
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function Closing() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden py-28 sm:py-40">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,var(--accent-soft),transparent_65%)]" />
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <motion.h2
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={fadeUp}
          className="editorial text-4xl font-extrabold text-balance sm:text-6xl"
        >
          {t.landing.closingTitle}
        </motion.h2>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up?type=candidate">{t.landing.closingCandidate}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/employer/request-access">{t.landing.closingCompany}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
