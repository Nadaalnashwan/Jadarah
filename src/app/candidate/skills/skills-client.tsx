"use client";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { SkillRadar } from "@/components/app/charts";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { deleteProfileItem, upsertSkill } from "@/features/candidate/actions";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

type Skill = {
  id: string;
  skill_id: string;
  slug: string;
  name: string;
  category: string;
  level: number;
  source: "self" | "cv" | "assessment" | "verified";
  evidence: string | null;
};

export function SkillsExplorer({
  skills,
  taxonomy,
  targetSlugs,
}: {
  skills: Skill[];
  taxonomy: { id: string; slug: string; name: string; category: string }[];
  targetSlugs: string[];
}) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const categories = useMemo(() => [...new Set(skills.map((s) => s.category))], [skills]);
  const [cat, setCat] = useState<string | null>(null);
  const [selected, setSelected] = useState<Skill | null>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(upsertSkill, null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(t.common.saved);
      router.refresh();
    }
  }, [state, router, t.common.saved]);

  const visible = cat ? skills.filter((s) => s.category === cat) : skills;
  const radarData = targetSlugs.length
    ? targetSlugs.map((slug) => ({
        label: taxonomy.find((x) => x.slug === slug)?.name ?? slug,
        value: skills.find((s) => s.slug === slug)?.level ?? 0,
        target: 3,
      }))
    : visible.slice(0, 8).map((s) => ({ label: s.name, value: s.level }));
  const sourceTone = { self: "neutral", cv: "info", assessment: "progress", verified: "positive" } as const;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <div>
        {radarData.length >= 3 ? (
          <SkillRadar data={radarData} />
        ) : (
          <p className="text-subtle py-12 text-center text-sm">
            {L("Add at least three skills to see your map.", "أضف ثلاث مهارات على الأقل لرؤية خريطتك.")}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-1.5">
          <button
            onClick={() => setCat(null)}
            aria-pressed={!cat}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              !cat ? "bg-navy text-ivory dark:bg-royal" : "bg-surface-2",
            )}
          >
            {t.common.all}
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(cat === c ? null : c)}
              aria-pressed={cat === c}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                cat === c ? "bg-navy text-ivory dark:bg-royal" : "bg-surface-2",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <ul className="flex flex-wrap gap-2">
          {visible.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setSelected(selected?.id === s.id ? null : s)}
                aria-pressed={selected?.id === s.id}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                  selected?.id === s.id ? "border-primary bg-primary text-white" : "hover:border-primary/50",
                )}
              >
                {s.name}
                <span className="flex gap-0.5" aria-label={`${s.level}/5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={cn(
                        "h-2 w-1 rounded-full",
                        n <= s.level
                          ? selected?.id === s.id
                            ? "bg-white"
                            : "bg-primary"
                          : "bg-border-strong",
                      )}
                    />
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-surface-2/50 rounded-2xl border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{selected.name}</p>
                  <Badge tone={sourceTone[selected.source]}>{t.match.source[selected.source]}</Badge>
                  <p className="text-muted mt-2 text-sm">
                    {selected.evidence ??
                      L(
                        "No evidence attached yet. Upload a CV or complete an assessment to strengthen this skill.",
                        "لا يوجد دليل بعد. ارفع سيرتك أو أكمل تقييمًا لتقوية هذه المهارة.",
                      )}
                  </p>
                </div>
                <form
                  action={async () => {
                    await deleteProfileItem("candidate_skills", selected.id);
                    setSelected(null);
                    router.refresh();
                  }}
                >
                  <button
                    className="text-subtle hover:bg-danger-soft hover:text-danger flex size-8 items-center justify-center rounded-full"
                    aria-label={t.common.delete}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <form action={action} className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_7rem]">
          <Field label={L("Add or update a skill", "أضف مهارة أو حدّثها")} htmlFor="skill_id">
            <Select id="skill_id" name="skill_id" required defaultValue="">
              <option value="" disabled>
                {L("Choose…", "اختر…")}
              </option>
              {taxonomy.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.category}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={L("Level", "المستوى")} htmlFor="level">
            <Select id="level" name="level" defaultValue="3">
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          </Field>
          <Field
            label={L("Evidence (optional)", "الدليل (اختياري)")}
            htmlFor="evidence"
            className="sm:col-span-2"
            hint={L("e.g. a project, a link, or where you used it", "مثل مشروع أو رابط أو أين استخدمتها")}
          >
            <Input id="evidence" name="evidence" maxLength={500} />
          </Field>
          {state && !state.ok && (
            <div className="sm:col-span-2">
              <FormMessage>{state.error}</FormMessage>
            </div>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" loading={pending}>
              {t.common.save}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
