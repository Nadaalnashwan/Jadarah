"use client";
/**
 * Landing sections after the opening. Content is visible on arrival (no scroll-triggered reveals); the live parts
 * advance on their own at a calm pace, pause while the tab is hidden and stay still under reduced motion.
 * Everything described here exists in the product; no records, people or figures are shown.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, CircleDashed, CircleHelp, CircleSlash, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Pair = [string, string];
const ease = [0.22, 1, 0.36, 1] as const;

/** Index that advances every `ms` (paused while the tab is hidden; fixed at -1 with reduced motion). */
function useCycle(count: number, ms: number) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setI((n) => (n + 1) % count);
    }, ms);
    return () => window.clearInterval(id);
  }, [count, ms, reduce]);
  return reduce ? -1 : i;
}

function useL() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  return { ar, P: (p: Pair) => (ar ? p[1] : p[0]) };
}

function SectionHeading({ eyebrow, title, body, id }: { eyebrow: string; title: string; body?: string; id: string }) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h2 id={id} className="editorial text-[2rem] font-extrabold sm:text-[2.6rem]">
        {title}
      </h2>
      {body && <p className="text-muted mt-4 text-base leading-relaxed sm:text-lg">{body}</p>}
    </div>
  );
}

/* ------------------------------------------------------------ HOW IT WORKS */
const CANDIDATE_STEPS: [Pair, Pair][] = [
  [
    ["Build your profile", "ابنِ ملفك"],
    ["Upload your CV, review the skills read from it and add your own", "ارفع سيرتك، وراجع المهارات المستخرجة منها، وأضف ما تراه"],
  ],
  [
    ["Apply to a role", "تقدّم إلى وظيفة"],
    ["If the job has a practical task, it opens the moment you apply", "إذا كانت للوظيفة مهمة عملية فإنها تُفتح لحظة تقديمك"],
  ],
  [
    ["Submit the task", "سلّم المهمة"],
    ["Your application is complete as soon as the task is submitted", "يكتمل طلبك بمجرد تسليم المهمة"],
  ],
  [
    ["Follow every decision", "تابع كل قرار"],
    ["See each stage of your application, from review to the final decision", "تابع كل مرحلة في طلبك من المراجعة حتى القرار النهائي"],
  ],
];
const EMPLOYER_STEPS: [Pair, Pair][] = [
  [
    ["Publish a role", "انشر وظيفة"],
    ["Set the requirements and attach a practical task to the job", "حدّد المتطلبات وأرفق مهمة عملية بالوظيفة"],
  ],
  [
    ["Review the evidence", "راجِع الأدلة"],
    ["See the CV, the profile and the submitted task, scored against your rubric", "اطّلع على السيرة والملف والمهمة المسلّمة مقيّمة وفق معاييرك"],
  ],
  [
    ["Shortlist and interview", "اختصر القائمة وقابِل"],
    ["Interviews are scheduled for shortlisted candidates only", "تُجدول المقابلات للمرشحين في القائمة المختصرة فقط"],
  ],
  [
    ["Decide", "اتخذ القرار"],
    ["Your team makes every hiring decision; AI suggestions are always labelled", "يتخذ فريقك كل قرارات التوظيف، وتظهر اقتراحات الذكاء الاصطناعي موسومة دائمًا"],
  ],
];

export function HowItWorks() {
  const { P } = useL();
  const active = useCycle(4, 3200);
  return (
    <section id="product" className="section-lavender scroll-mt-20 py-20 sm:py-28" aria-labelledby="how-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          id="how-title"
          eyebrow={P(["How it works", "كيف تعمل جدارة"])}
          title={P(["One process, seen from both sides", "مسار واحد يراه الطرفان"])}
          body={P([
            "The same application moves through the same stages for the candidate and the employer, so both always know where it stands",
            "يمرّ الطلب بالمراحل نفسها لدى المرشح وصاحب العمل، فيعرف الطرفان موقعه في كل وقت",
          ])}
        />
        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          <Lane icon={<UserRound className="size-4" />} title={P(["For candidates", "للمرشحين"])} steps={CANDIDATE_STEPS} active={active} />
          <Lane
            icon={<Building2 className="size-4" />}
            title={P(["For employers", "لأصحاب العمل"])}
            steps={EMPLOYER_STEPS}
            active={active}
            ink
          />
        </div>
      </div>
    </section>
  );
}

function Lane({
  icon,
  title,
  steps,
  active,
  ink,
}: {
  icon: React.ReactNode;
  title: string;
  steps: [Pair, Pair][];
  active: number;
  ink?: boolean;
}) {
  const { P } = useL();
  return (
    <div className={cn("relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8", ink ? "panel-green" : "surface-card")}>
      <h3 className="text-muted flex items-center gap-2 text-sm font-bold">
        {icon}
        {title}
      </h3>
      <ol className="relative mt-6 flex flex-col">
        <span className="bg-border absolute start-[0.9rem] top-3 bottom-3 w-px" aria-hidden />
        {steps.map(([t, b], i) => {
          const on = active === -1 || i <= active;
          const current = i === active;
          return (
            <li key={t[0]} className="relative flex gap-4 py-3">
              <span
                className={cn(
                  "ltr-nums relative z-10 grid size-[1.85rem] shrink-0 place-items-center rounded-full text-xs font-bold transition-colors duration-500",
                  on ? "bg-primary text-primary-foreground" : "bg-surface-2 text-subtle",
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 pt-0.5">
                <span className={cn("block font-bold transition-colors duration-500", current && "text-violet-ink")}>
                  {P(t)}
                </span>
                <span className="text-muted mt-0.5 block text-sm leading-relaxed">{P(b)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ----------------------------------------------------------- EVIDENCE MODEL */
const SOURCES: [Pair, Pair][] = [
  [["Self-declared", "مُصرَّح بها"], ["Added by the candidate and shown as their claim", "يضيفها المرشح وتظهر كتصريح منه"]],
  [["From the CV", "من السيرة الذاتية"], ["Read from the CV and approved by the candidate", "مستخرجة من السيرة ومعتمدة من المرشح"]],
  [["Demonstrated", "مُثبتة عمليًا"], ["Shown in a practical task the candidate submitted", "ظهرت في مهمة عملية سلّمها المرشح"]],
  [["Verified", "موثّقة"], ["Confirmed by an accountable reviewer", "أكّدها مُراجِع مسؤول"]],
];
const RESULTS: { icon: React.ReactNode; label: Pair; body: Pair }[] = [
  {
    icon: <CheckCircle2 className="size-4 text-[var(--tone-teal-ink)]" aria-hidden />,
    label: ["Matched", "مطابق"],
    body: ["The evidence meets the requirement", "الأدلة تستوفي المتطلب"],
  },
  {
    icon: <CircleDashed className="size-4 text-[var(--tone-sand-ink)]" aria-hidden />,
    label: ["Partially matched", "مطابق جزئيًا"],
    body: ["Present, below the required level", "موجودة بمستوى أقل من المطلوب"],
  },
  {
    icon: <CircleHelp className="size-4 text-[var(--tone-blue-ink)]" aria-hidden />,
    label: ["Unverified", "غير مُثبت"],
    body: ["Claimed but not yet demonstrated", "مُصرَّح بها ولم تُثبت بعد"],
  },
  {
    icon: <CircleSlash className="size-4 text-[var(--tone-peach-ink)]" aria-hidden />,
    label: ["Missing", "غير موجود"],
    body: ["Not in the profile yet", "غير موجودة في الملف بعد"],
  },
];

export function EvidenceModel() {
  const { P } = useL();
  const active = useCycle(4, 2600);
  return (
    <section className="ink ink-aura relative isolate overflow-hidden py-20 sm:py-28" aria-labelledby="evidence-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          id="evidence-title"
          eyebrow={P(["Evidence and matching", "الأدلة والمطابقة"])}
          title={P(["Every skill shows where it comes from", "كل مهارة تُظهر مصدرها"])}
          body={P([
            "Matching is calculated from evidence, and each result explains itself requirement by requirement",
            "تُحسب المطابقة من الأدلة، وتوضّح كل نتيجة سببها متطلبًا بمتطلب",
          ])}
        />
        <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          {/* Evidence ladder: each level sits higher than the last */}
          <ol className="flex flex-col gap-2" aria-label={P(["Evidence levels, weakest to strongest", "مستويات الأدلة من الأضعف إلى الأقوى"])}>
            {SOURCES.map(([t, b], i) => {
              const current = active === i;
              return (
                <li
                  key={t[0]}
                  style={{ marginInlineStart: `${i * 1.5}rem` }}
                  className={cn(
                    "flex items-center gap-4 rounded-xl border p-4 transition-[background-color,border-color,transform] duration-500",
                    current ? "bg-surface-elevated border-[var(--violet-line)] -translate-y-0.5" : "bg-surface/60 border-white/10",
                  )}
                >
                  <span className="flex shrink-0 items-end gap-0.5" aria-hidden>
                    {[0, 1, 2, 3].map((k) => (
                      <span
                        key={k}
                        className={cn("w-1.5 rounded-sm", k <= i ? "bg-[var(--sky)]" : "bg-white/15")}
                        style={{ height: `${8 + k * 4}px` }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold">{P(t)}</span>
                    <span className="text-muted block text-sm">{P(b)}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <div>
            <h3 className="text-muted text-sm font-bold">{P(["What a match result means", "ماذا تعني نتيجة المطابقة"])}</h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {RESULTS.map((r) => (
                <li key={r.label[0]} className="bg-surface/60 rounded-xl border border-white/10 p-4">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    {r.icon}
                    {P(r.label)}
                  </span>
                  <span className="text-muted mt-1 block text-sm">{P(r.body)}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted mt-6 border-s-2 border-[var(--violet-line)] ps-4 text-sm leading-relaxed">
              {P([
                "AI helps read CVs and draft assessments. What it suggests is labelled, and a person reviews it before it is used",
                "يساعد الذكاء الاصطناعي في قراءة السير وصياغة التقييمات، ويُوسم ما يقترحه ويراجعه شخص قبل استخدامه",
              ])}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- CAREER PATH */
const CAREER: [Pair, Pair][] = [
  [["Choose a target role", "اختر دورًا مستهدفًا"], ["Decide where you want to go next", "حدّد وجهتك التالية"]],
  [["See your gaps", "اعرف فجواتك"], ["Calculated only from the evidence in your profile", "تُحسب من الأدلة في ملفك فقط"]],
  [["Follow a plan", "اتبع خطة"], ["Milestones linked to reviewed learning resources", "مراحل مرتبطة بمصادر تعلّم مُراجَعة"]],
  [["Prove it in practice", "أثبتها عمليًا"], ["Practice tasks turn what you learn into evidence", "تحوّل مهام التدريب ما تتعلمه إلى أدلة"]],
];

export function CareerPath() {
  const { P, ar } = useL();
  const reduce = useReducedMotion();
  return (
    <section className="py-20 sm:py-28" aria-labelledby="career-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          id="career-title"
          eyebrow={P(["Career development", "التطوير المهني"])}
          title={P(["Grow toward the role you want", "تقدّم نحو الدور الذي تطمح إليه"])}
        />
        <ol className="relative mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <span className="bg-border absolute inset-x-6 top-[1.45rem] hidden h-px lg:block" aria-hidden>
            <motion.span
              className="fill-signature bg-primary absolute inset-y-0 start-0 block w-full"
              style={{ transformOrigin: ar ? "right" : "left" }}
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 2.4, ease, delay: 0.6 }}
            />
          </span>
          {CAREER.map(([t, b], i) => (
            <li key={t[0]} className="relative flex flex-col gap-3">
              <span className="ltr-nums bg-background ring-border text-primary-ink relative grid size-[2.9rem] place-items-center rounded-full text-sm font-extrabold ring-1">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-bold">{P(t)}</span>
              <span className="text-muted text-sm leading-relaxed">{P(b)}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- CLOSING */
export function Closing() {
  const { P, ar } = useL();
  const Arrow = ar ? ArrowLeft : ArrowRight;
  return (
    <section className="pb-20 sm:pb-28" aria-label={P(["Get started", "ابدأ الآن"])}>
      <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 lg:grid-cols-2">
        <div className="section-lavender relative isolate flex min-h-72 flex-col justify-between gap-8 overflow-hidden rounded-[1.75rem] border p-7 sm:p-10">
          <div>
            <p className="eyebrow mb-3">{P(["Candidates", "المرشحون"])}</p>
            <h2 className="editorial text-[1.9rem] font-extrabold sm:text-[2.3rem]">{P(["Start with your CV", "ابدأ بسيرتك الذاتية"])}</h2>
            <p className="text-muted mt-3 max-w-md leading-relaxed">
              {P([
                "Upload your CV, confirm the skills read from it and apply. Your profile is ready in a few minutes",
                "ارفع سيرتك، وأكّد المهارات المستخرجة منها، وتقدّم. يصبح ملفك جاهزًا خلال دقائق",
              ])}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link href="/sign-up?type=candidate">
                {P(["Create a candidate profile", "أنشئ ملفك كمرشح"])}
                <Arrow aria-hidden />
              </Link>
            </Button>
            <Link href="/for-candidates" className="text-primary-ink text-sm font-semibold underline-offset-4 hover:underline">
              {P(["What candidates get", "ماذا يقدّم للمرشحين"])}
            </Link>
          </div>
        </div>
        <div className="panel-green relative isolate flex min-h-72 flex-col justify-between gap-8 overflow-hidden rounded-[1.75rem] p-7 sm:p-10">
          <div>
            <p className="mb-3 text-xs font-bold tracking-[0.14em] text-[var(--gold)] uppercase rtl:text-sm rtl:tracking-normal">
              {P(["Employers", "أصحاب العمل"])}
            </p>
            <h2 className="editorial text-[1.9rem] font-extrabold sm:text-[2.3rem]">{P(["Set up your hiring team", "جهّز فريق التوظيف لديك"])}</h2>
            <p className="text-muted mt-3 max-w-md leading-relaxed">
              {P([
                "Attach practical tasks to your roles, compare candidates requirement by requirement and run structured interviews",
                "أرفق مهام عملية بوظائفك، وقارن المرشحين متطلبًا بمتطلب، وأدر مقابلات منظّمة",
              ])}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link href="/employer/request-access" className="!bg-[var(--mint)] !bg-none !text-[#0b3d2e]">{P(["Request employer access", "اطلب وصول جهة توظيف"])}</Link>
            </Button>
            <Link href="/sign-in?next=/company" className="text-primary-ink text-sm font-semibold underline-offset-4 hover:underline">
              {P(["Employer sign-in", "دخول أصحاب العمل"])}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
