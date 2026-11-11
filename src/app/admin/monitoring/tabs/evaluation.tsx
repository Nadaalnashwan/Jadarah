import { Badge, Card, KpiCard } from "@/components/ui/primitives";
import results from "@/data/evaluation/results.json";
import { formatDate, formatNumber, tx } from "@/lib/i18n/config";
import { aiVsHuman, builderMonitoring, demoIds } from "@/services/monitoring";
import { NotEvaluated, Panel, pct } from "@/features/monitoring/ui";
import type { TabProps } from "./types";

/**
 * Evaluation & quality. Offline evaluations (labelled benchmarks, run with `npm run eval:offline`) are kept apart
 * from live operational evidence. Anything without enough evidence is shown as "Not evaluated" — never as 0% or 100%.
 */
export async function EvaluationTab({ supabase, period, demo, locale }: Omit<TabProps, "params">) {
  const L = tx(locale);
  const n = (v: number) => formatNumber(v, locale);
  const excl = demo ? null : await demoIds(supabase);
  const [b, h] = await Promise.all([
    builderMonitoring(supabase, period, excl?.companies ?? null),
    aiVsHuman(supabase),
  ]);
  const cv = results.evaluations[0];
  const lc = b.lifecycle;
  const decided = lc.approved + lc.rejected;
  const MIN_COMPARE = 20;
  return (
    <div className="flex flex-col gap-8">
      {b.generationsAccess === "rls_only" && (
        <p className="bg-warning-soft text-warning rounded-xl px-4 py-2 text-sm">
          {L(
            "Draft records are readable only by each company's recruiters. Apply proposal 0031 (metadata-only monitoring function) to include them; figures below that depend on drafts are incomplete.",
            "سجلات المسودات متاحة فقط لمسؤولي التوظيف في كل شركة. طبّق المقترح 0031 (دالة مراقبة للبيانات الوصفية فقط) لتضمينها؛ الأرقام المعتمدة على المسودات أدناه غير مكتملة.",
          )}
        </p>
      )}
      <section aria-labelledby="ev-offline">
        <h2 id="ev-offline" className="mb-1 text-lg font-bold">
          {L("Offline evaluation (labelled benchmarks)", "التقييم المسبق (معايير مُعلَّمة)")}
        </h2>
        <p className="text-subtle mb-4 text-sm">
          {L(
            "Separate from live monitoring: fixed datasets, re-run with",
            "منفصل عن المراقبة الحية: بيانات ثابتة، يُعاد تشغيله بالأمر",
          )}{" "}
          <code className="ltr-nums">npm run eval:offline</code>
        </p>
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel
            tone="mist"
            title={L(cv.title_en, cv.title_ar)}
            sample={`${L("Evaluated", "تاريخ التقييم")} ${formatDate(results.generated_at, locale)} · ${cv.model} · ${n(cv.dataset.cases)} ${L("CVs", "سيرة")}, ${n(cv.dataset.labelled_skills)} ${L("labelled skills", "مهارة مُعلَّمة")}`}
            definition={
              <>
                <span className="block">{cv.methodology_en}</span>
                <span className="mt-1 block">{cv.definitions_en.join(" ")}</span>
              </>
            }
          >
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                [L("Precision", "الدقة"), pct(cv.metrics.precision, locale, 1)],
                [L("Recall", "الاستدعاء"), pct(cv.metrics.recall, locale, 1)],
                [
                  L("Evidence quotes valid", "صحة الاقتباسات"),
                  pct(cv.metrics.evidence_quote_validity, locale),
                ],
                [L("Schema valid", "مطابقة المخطط"), pct(cv.metrics.schema_validity, locale)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="tone-ink text-xs font-semibold">{k}</dt>
                  <dd className="ltr-nums text-2xl font-extrabold">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm">
              <Badge tone="negative" className="me-2">
                {n(cv.metrics.unsupported_claims)} {L("unsupported claims", "ادعاءات غير مدعومة")}
              </Badge>
              {L(
                `${cv.metrics.negation_cases_with_false_positive} of ${cv.metrics.negation_cases} CVs with negations ("no experience with…") produced a false skill.`,
                `${cv.metrics.negation_cases_with_false_positive} من ${cv.metrics.negation_cases} سير تحتوي نفيًا («لا خبرة لدي في…») أنتجت مهارة خاطئة.`,
              )}
            </p>
            <ul className="text-subtle mt-3 list-disc space-y-0.5 ps-5 text-xs">
              {cv.limitations_en.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </Panel>
          <div className="flex flex-col gap-4">
            <Card className="p-5">
              <h3 className="mb-2 text-sm font-bold">
                {L("CV extraction — AI providers", "استخراج السيرة — مزوّدو الذكاء الاصطناعي")}
              </h3>
              <NotEvaluated
                locale={locale}
                reason={L(
                  "Needs live provider calls on a labelled benchmark; not run, to avoid spending AI credits. Live CV parsing counts are in AI monitoring.",
                  "يتطلب استدعاءات حية للمزوّد على معيار مُعلَّم؛ لم يُشغَّل تجنبًا لاستهلاك أرصدة الذكاء الاصطناعي. أعداد التحليل الحية في مراقبة الذكاء الاصطناعي.",
                )}
              />
            </Card>
            <Card className="p-5">
              <h3 className="mb-2 text-sm font-bold">
                {L("Semantic job matching", "المطابقة الدلالية للوظائف")}
              </h3>
              <NotEvaluated
                locale={locale}
                reason={L(
                  "No labelled relevance benchmark exists yet (relevant jobs, ranking, negation, skill equivalence). Similarity scores are not proof of competence.",
                  "لا يوجد بعد معيار مُعلَّم للملاءمة (الوظائف الملائمة، الترتيب، النفي، تكافؤ المهارات). درجات التشابه ليست دليلًا على الكفاءة.",
                )}
              />
            </Card>
          </div>
        </div>
      </section>

      <section aria-labelledby="ev-assess">
        <h2 id="ev-assess" className="mb-1 text-lg font-bold">
          {L("Assessment quality — live evidence", "جودة التقييمات — أدلة حية")}
        </h2>
        <p className="text-subtle mb-4 text-sm">
          {L(period.label_en, period.label_ar)} · {n(lc.generated)} {L("generated drafts", "مسودة مولّدة")}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            tone="sage"
            label={L("Passed every automatic check", "اجتازت كل الفحوص الآلية")}
            value={lc.generated ? pct(lc.validated / lc.generated, locale) : "—"}
            hint={`${n(lc.validated)}/${n(lc.generated)}`}
          />
          <KpiCard
            tone="sand"
            label={L("Human correction frequency", "تكرار التصحيح البشري")}
            value={
              lc.generated && b.instrumentedSamples ? pct(b.editedAssessments / lc.generated, locale) : "—"
            }
            hint={
              b.instrumentedSamples
                ? `${n(b.editedAssessments)} ${L("drafts edited by a person", "مسودة عدّلها شخص")}`
                : L(
                    "Edits are recorded for drafts generated from this release on",
                    "تُسجَّل التعديلات للمسودات المولّدة من هذا الإصدار",
                  )
            }
          />
          <KpiCard
            tone="blue"
            label={L("Eventual approval rate", "نسبة الاعتماد النهائي")}
            value={decided ? pct(lc.approved / decided, locale) : "—"}
            hint={
              decided
                ? `${n(lc.approved)}/${n(decided)} ${L("decided drafts", "مسودة محسومة")}`
                : L("No drafts decided yet", "لم تُحسم أي مسودة بعد")
            }
          />
          <KpiCard
            label={L("Sections regenerated", "أقسام أعيد توليدها")}
            value={b.instrumentedSamples || b.regenerated ? n(b.regenerated) : "—"}
            hint={
              b.instrumentedSamples || b.regenerated
                ? undefined
                : L("Recorded from this release on", "تُسجَّل من هذا الإصدار")
            }
          />
        </div>
        <Card className="mt-4 p-5">
          <h3 className="mb-3 text-sm font-bold">{L("Quality dimensions", "أبعاد الجودة")}</h3>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {[
              ["skill_coverage", L("Required skill coverage", "تغطية المهارات المطلوبة")],
              ["deliverable_clarity", L("Deliverable clarity", "وضوح المخرجات")],
              ["rubric_alignment", L("Rubric consistency", "اتساق المعايير")],
              ["input_availability", L("Input validity", "صحة المدخلات")],
              ["time_feasibility", L("Task feasibility (time)", "واقعية المهمة (الوقت)")],
              ["dataset_validity", L("Valid datasets", "صحة البيانات")],
            ].map(([key, label]) => {
              const c = b.checks.find((x) => x.check === key);
              return (
                <li
                  key={key}
                  className="bg-surface-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2"
                >
                  <span>{label}</span>
                  <span className="ltr-nums font-semibold">
                    {c
                      ? `${pct(c.passed / c.total, locale)} · n=${n(c.total)}`
                      : L("Not evaluated", "لم يُقيَّم")}
                  </span>
                </li>
              );
            })}
            <li className="bg-surface-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2">
              <span>
                {L("Job relevance / difficulty appropriateness", "ملاءمة الوظيفة / مناسبة الصعوبة")}
              </span>
              <span className="font-semibold">{L("Not evaluated", "لم يُقيَّم")}</span>
            </li>
          </ul>
          <p className="text-subtle mt-3 text-xs">
            {L(
              "Pass rates come from the rule-based checks stored with each draft. Relevance and difficulty need human-labelled judgements, which are not collected yet; no AI quality score is invented.",
              "نسب الاجتياز من الفحوص الآلية المحفوظة مع كل مسودة. الملاءمة والصعوبة تتطلب أحكامًا بشرية مُعلَّمة لم تُجمع بعد؛ ولا تُختلق أي درجة جودة.",
            )}
          </p>
        </Card>
      </section>

      <section aria-labelledby="ev-human">
        <h2 id="ev-human" className="mb-1 text-lg font-bold">
          {L("AI suggestions vs human review", "اقتراحات الذكاء الاصطناعي مقابل المراجعة البشرية")}
        </h2>
        <p className="text-subtle mb-4 text-sm">
          {n(h.suggestions)} {L("AI scoring suggestions", "اقتراح تقييم آلي")} · {n(h.comparedCriteria)}{" "}
          {L("criteria with both an AI and a human score", "معيارًا له درجة آلية وبشرية")}
          {h.models.length ? ` · ${h.models.join(", ")}` : ""}
        </p>
        {h.comparedCriteria < MIN_COMPARE ? (
          <NotEvaluated
            locale={locale}
            reason={L(
              `At least ${MIN_COMPARE} criteria scored by both the AI assistant and a reviewer are needed; ${h.comparedCriteria} exist.`,
              `يلزم ${MIN_COMPARE} معيارًا على الأقل قيّمها المساعد الآلي والمراجع معًا؛ الموجود ${h.comparedCriteria}.`,
            )}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label={L("Mean absolute score difference", "متوسط الفرق المطلق في الدرجة")}
              value={formatNumber(Number(h.meanAbsDiff!.toFixed(2)), locale)}
              hint={L("points per criterion", "نقطة لكل معيار")}
            />
            <KpiCard
              label={L("Reviewer override frequency", "تكرار تعديل المراجع")}
              value={pct(h.overrideRate, locale)}
            />
            <KpiCard
              label={L("AI suggestions without evidence", "اقتراحات بلا دليل")}
              value={pct(h.missingEvidenceRate, locale)}
            />
          </div>
        )}
        <p className="text-subtle mt-3 text-xs">
          {L(
            "Agreement between AI and reviewers is not proof of fairness or correctness; reviewers always decide.",
            "اتفاق الذكاء الاصطناعي مع المراجعين ليس دليلًا على العدالة أو الصحة؛ القرار دائمًا للمراجع.",
          )}
        </p>
      </section>
    </div>
  );
}
