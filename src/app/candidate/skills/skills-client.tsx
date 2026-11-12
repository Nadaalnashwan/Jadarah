"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { deleteProfileItem, upsertSkill } from "@/features/candidate/actions";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

type Source = "self" | "cv" | "assessment" | "verified";
type Skill = {
  id: string;
  skill_id: string;
  slug: string;
  name: string;
  category: string;
  level: number;
  source: Source;
  evidence: string | null;
};

/**
 * One list, grouped by how strong the evidence is: demonstrated (assessment / reviewer-verified) → CV → self-declared.
 * Editing keeps the existing record (same upsert action); nothing is removed unless the candidate deletes it.
 */
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
  const [adding, setAdding] = useState(skills.length === 0);
  const groups: {
    key: string;
    title: string;
    hint: string;
    tone: "positive" | "info" | "neutral";
    items: Skill[];
  }[] = [
    {
      key: "demonstrated",
      title: L("Demonstrated", "مُثبتة"),
      hint: L("Shown in an assessment or verified by a reviewer", "ظهرت في تقييم أو تحقق منها مراجع"),
      tone: "positive",
      items: skills.filter((s) => s.source === "assessment" || s.source === "verified"),
    },
    {
      key: "cv",
      title: L("From your CV", "من سيرتك الذاتية"),
      hint: L(
        "Extracted from your CV and confirmed by you — a claim until demonstrated",
        "مستخرجة من سيرتك وأكدتها — ادعاء حتى تُثبت",
      ),
      tone: "info",
      items: skills.filter((s) => s.source === "cv"),
    },
    {
      key: "self",
      title: L("Self-declared", "مصرّح بها ذاتيًا"),
      hint: L(
        "Added by you. Add evidence or take an assessment to strengthen them",
        "أضفتها بنفسك. أضف دليلًا أو أكمل تقييمًا لتقويتها",
      ),
      tone: "neutral",
      items: skills.filter((s) => s.source === "self"),
    },
  ];
  const target = new Set(targetSlugs);
  const missingTarget = targetSlugs.filter((slug) => !skills.some((s) => s.slug === slug));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted text-sm">
          {skills.length} {L("skills", "مهارة")}
          {targetSlugs.length > 0 &&
            ` · ${targetSlugs.length - missingTarget.length}/${targetSlugs.length} ${L("of your target role's skills", "من مهارات دورك المستهدف")}`}
        </p>
        <Button variant={adding ? "ghost" : "primary"} size="sm" onClick={() => setAdding((v) => !v)}>
          {adding ? <X /> : <Plus />}
          {adding ? t.common.cancel : L("Add a skill", "أضف مهارة")}
        </Button>
      </div>
      {adding && <SkillForm taxonomy={taxonomy} onDone={() => setAdding(false)} />}
      {skills.length === 0 && !adding && (
        <p className="text-subtle py-8 text-center text-sm">
          {L(
            "No skills yet. Upload your CV or add skills manually",
            "لا توجد مهارات بعد. ارفع سيرتك أو أضف المهارات يدويًا",
          )}
        </p>
      )}
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.key} aria-labelledby={`sg-${g.key}`}>
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <h3 id={`sg-${g.key}`} className="text-sm font-bold">
                {g.title}
              </h3>
              <Badge tone={g.tone}>{g.items.length}</Badge>
              <span className="text-subtle text-xs">{g.hint}</span>
            </div>
            <ul className="divide-border bg-surface-2/40 divide-y rounded-2xl border">
              {g.items.map((s) => (
                <SkillRow key={s.id} s={s} taxonomy={taxonomy} inTarget={target.has(s.slug)} />
              ))}
            </ul>
          </section>
        ))}
      {missingTarget.length > 0 && (
        <p className="text-muted text-sm">
          {L("Missing for your target role:", "ينقصك لدورك المستهدف:")}{" "}
          {missingTarget
            .map((slug) => taxonomy.find((x) => x.slug === slug)?.name ?? slug)
            .join(locale === "ar" ? "، " : ", ")}
        </p>
      )}
    </div>
  );
}

function Level({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-1.5" aria-label={`${value}/5`}>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={cn("h-2.5 w-1.5 rounded-full", n <= value ? "bg-primary" : "bg-border-strong")}
          />
        ))}
      </span>
      <span className="ltr-nums text-subtle text-xs">{value}/5</span>
    </span>
  );
}

function SkillRow({
  s,
  taxonomy,
  inTarget,
}: {
  s: Skill;
  taxonomy: { id: string; slug: string; name: string; category: string }[];
  inTarget: boolean;
}) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {s.name}
            {inTarget && (
              <Badge tone="progress" className="ms-2">
                {L("Target role", "الدور المستهدف")}
              </Badge>
            )}
          </p>
          <p className="text-subtle truncate text-xs">
            {s.category}
            {s.evidence ? ` · ${s.evidence}` : ""}
          </p>
        </div>
        <Level value={s.level} />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
            aria-label={`${L("Edit", "تعديل")} ${s.name}`}
            className="text-subtle hover:bg-surface-2 flex size-9 items-center justify-center rounded-full"
          >
            <Pencil className="size-4" />
          </button>
          <form
            action={async () => {
              if (!window.confirm(L(`Remove ${s.name} from your skills?`, `إزالة ${s.name} من مهاراتك؟`)))
                return;
              await deleteProfileItem("candidate_skills", s.id);
              router.refresh();
            }}
          >
            <button
              aria-label={`${t.common.delete} ${s.name}`}
              className="text-subtle hover:bg-danger-soft hover:text-danger flex size-9 items-center justify-center rounded-full"
            >
              <Trash2 className="size-4" />
            </button>
          </form>
        </div>
      </div>
      {editing && (
        <div className="mt-3">
          <SkillForm taxonomy={taxonomy} existing={s} onDone={() => setEditing(false)} />
        </div>
      )}
    </li>
  );
}

function SkillForm({
  taxonomy,
  existing,
  onDone,
}: {
  taxonomy: { id: string; slug: string; name: string; category: string }[];
  existing?: Skill;
  onDone: () => void;
}) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(upsertSkill, null);
  const handled = useRef<ActionResult | null>(null);
  useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state;
      toast.success(t.common.saved);
      router.refresh();
      onDone();
    }
  }, [state, router, t.common.saved, onDone]);
  const id = existing ? existing.id : "new";
  return (
    <form action={action} className="bg-surface grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_7rem]">
      {existing ? (
        <input type="hidden" name="skill_id" value={existing.skill_id} />
      ) : (
        <Field label={L("Skill", "المهارة")} htmlFor={`skill_id-${id}`}>
          <Select id={`skill_id-${id}`} name="skill_id" required defaultValue="">
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
      )}
      <Field
        label={L("Level", "المستوى")}
        htmlFor={`level-${id}`}
        className={existing ? "sm:col-span-2 sm:max-w-[7rem]" : undefined}
      >
        <Select id={`level-${id}`} name="level" defaultValue={String(existing?.level ?? 3)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </Select>
      </Field>
      <Field
        label={L("Evidence (optional)", "الدليل (اختياري)")}
        htmlFor={`evidence-${id}`}
        className="sm:col-span-2"
        hint={L("e.g. a project, a link, or where you used it", "مثل مشروع أو رابط أو أين استخدمتها")}
      >
        <Input
          id={`evidence-${id}`}
          name="evidence"
          maxLength={500}
          defaultValue={existing?.evidence ?? ""}
        />
      </Field>
      {state && !state.ok && (
        <div className="sm:col-span-2">
          <FormMessage>{state.error}</FormMessage>
        </div>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={pending}>
          {t.common.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
