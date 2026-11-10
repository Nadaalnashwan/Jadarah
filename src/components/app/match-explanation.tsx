import { CheckCircle2, CircleDashed, CircleHelp, CircleSlash, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import type { MatchResult, MatchStatus } from "@/lib/domain/matching";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

const ICON: Record<MatchStatus, React.ReactNode> = {
  matched: <CheckCircle2 className="text-success size-4" aria-hidden />,
  partial: <CircleDashed className="text-warning size-4" aria-hidden />,
  unverified: <CircleHelp className="text-primary dark:text-lavender size-4" aria-hidden />,
  missing: <CircleSlash className="text-danger size-4" aria-hidden />,
};

/**
 * Calibrated on demo data (gemini-embedding-2 @768d, 33 candidates × 30 jobs, 2026-11-11):
 * unrelated pairs ≈0.66–0.73 (median 0.725), same-role pairs ≈0.85–0.87.
 */
function semanticGauge(fit: number) {
  return Math.max(0, Math.min(1, (fit - 0.65) / 0.23));
}
function semanticLabel(fit: number, locale: "ar" | "en") {
  if (fit >= 0.82) return locale === "ar" ? "قوي" : "Strong";
  if (fit >= 0.76) return locale === "ar" ? "متوسط" : "Moderate";
  return locale === "ar" ? "ضعيف" : "Weak";
}

/** Explainable match: every requirement with its classification, levels and evidence source. */
export function MatchExplanation({
  match,
  t,
  locale,
  compact,
}: {
  match: MatchResult;
  t: Messages;
  locale: "ar" | "en";
  compact?: boolean;
}) {
  return (
    <div>
      <div className="flex items-end gap-3">
        <span className="ltr-nums text-5xl font-extrabold tracking-tight">{match.score}</span>
        <span className="text-subtle pb-2 text-xs font-semibold">/100 · {t.match.score}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["matched", "partial", "unverified", "missing"] as const).map((s) => (
          <Badge
            key={s}
            tone={
              s === "matched"
                ? "positive"
                : s === "missing"
                  ? "negative"
                  : s === "partial"
                    ? "neutral"
                    : "progress"
            }
          >
            <span className="ltr-nums">{match.counts[s]}</span> {t.match[s]}
          </Badge>
        ))}
      </div>
      {match.semantic && match.semantic.fit !== null && (
        <div className="bg-accent-soft/60 mt-4 rounded-2xl border p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs font-bold">
              <Sparkles className="text-primary dark:text-lavender size-3.5" aria-hidden />
              {locale === "ar" ? "التقارب الدلالي بين الملف والوظيفة" : "Semantic profile ↔ job similarity"}
            </p>
            <span className="text-sm font-extrabold">
              {semanticLabel(match.semantic.fit, locale)}{" "}
              <span className="ltr-nums text-subtle text-xs font-semibold">{match.semantic.fit.toFixed(2)}</span>
            </span>
          </div>
          <div className="bg-surface mt-2 h-1.5 overflow-hidden rounded-full" aria-hidden>
            <div
              className="bg-primary h-full rounded-full transition-[width] duration-700"
              style={{ width: `${semanticGauge(match.semantic.fit) * 100}%` }}
            />
          </div>
          <p className="text-subtle mt-1.5 text-[11px] leading-snug">
            {locale === "ar"
              ? `استنتاج ذكاء اصطناعي (${match.semantic.model}) — للاستئناس فقط ولا يدخل في الدرجة.`
              : `AI inference (${match.semantic.model}) — context only, not part of the score.`}
          </p>
        </div>
      )}
      <ul className={cn("mt-4 divide-y rounded-2xl border", compact && "text-sm")}>
        {match.requirements.map((r) => (
          <li key={r.skill_id} className="flex items-start gap-3 p-3">
            <span className="mt-0.5">{ICON[r.status]}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {r.name}{" "}
                <span className="text-subtle text-xs font-normal">
                  ·{" "}
                  {r.importance === "required"
                    ? locale === "ar"
                      ? "مطلوبة"
                      : "required"
                    : locale === "ar"
                      ? "مفضّلة"
                      : "preferred"}
                </span>
              </p>
              <p className="text-muted text-xs">
                {t.match[r.status]}
                {r.candidate_level !== null && (
                  <span className="ltr-nums">
                    {" "}
                    · {locale === "ar" ? "المستوى" : "level"} {r.candidate_level}/{r.required_level}
                  </span>
                )}
                {r.source && ` · ${t.match.source[r.source]}`}
              </p>
              {r.evidence && !compact && <p className="text-subtle mt-1 truncate text-xs">“{r.evidence}”</p>}
              {r.related && (
                <p className="text-primary dark:text-lavender mt-1 flex items-center gap-1 text-xs">
                  <Sparkles className="size-3 shrink-0" aria-hidden />
                  <span>
                    {locale === "ar" ? "مهارة قريبة لدى المرشح: " : "Related skill the candidate has: "}
                    <strong>{r.related.name}</strong>{" "}
                    <span className="ltr-nums text-subtle">({r.related.similarity.toFixed(2)})</span>
                    {locale === "ar" ? " · استنتاج آلي، يحتاج تحققًا" : " · AI inference, verify"}
                  </span>
                </p>
              )}
            </div>
          </li>
        ))}
        {match.experience.required > 0 && (
          <li className="flex items-start gap-3 p-3">
            <span className="mt-0.5">{match.experience.meets ? ICON.matched : ICON.partial}</span>
            <p className="text-sm">
              {locale === "ar" ? "الخبرة" : "Experience"}:{" "}
              <span className="ltr-nums">
                {match.experience.candidate ?? "—"} / {match.experience.required}
              </span>{" "}
              {locale === "ar" ? "سنوات" : "years"}
            </p>
          </li>
        )}
      </ul>
      <details className="text-muted mt-3 text-xs">
        <summary className="cursor-pointer font-semibold">{t.match.explain}</summary>
        <p className="mt-2 leading-relaxed">{t.match.explainBody}</p>
      </details>
    </div>
  );
}
