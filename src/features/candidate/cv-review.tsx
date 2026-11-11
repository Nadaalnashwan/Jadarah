"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { applyCvReview } from "@/features/candidate/cv-actions";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";
import type { ParsedCv } from "@/services/ai/cv";
import { toYearMonth } from "@/lib/domain/cv-dates";

const isPresent = (s: string | null | undefined) => !!s && /present|current|now|حتى الآن|حاليا|حاليًا/i.test(s);

type Exp = { on: boolean; found: boolean; title: string; company: string; start: string; end: string; description: string; raw: string };
type Edu = { on: boolean; found: boolean; institution: string; degree: string; field: string; end_year: string };
type Proj = { on: boolean; found: boolean; title: string; description: string };
type Item = { on: boolean; found: boolean; value: string };
type Skill = { on: boolean; found: boolean; name: string; evidence: string | null; kind: "explicit" | "inferred" };

/**
 * Editable review of everything extracted from a CV. The candidate edits, removes or approves each item;
 * only approved items are saved. Extracted vs inferred is shown explicitly — an inferred skill is never "verified".
 */
export function CvReview({ documentId, parsed, onDone }: { documentId: string; parsed: ParsedCv; onDone: () => void }) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Grounding: items whose key fact is not in the CV text start unticked and are flagged (never presented as stated).
  const g = parsed.grounding;
  const found = (list: boolean[] | undefined, i: number) => !g?.checked || !!list?.[i];
  const [basics, setBasics] = useState({
    full_name: parsed.full_name ?? "",
    headline: parsed.headline ?? "",
    summary: parsed.summary ?? "",
  });
  const [exp, setExp] = useState<Exp[]>(
    parsed.experience.map((e, i) => ({
      on: found(g?.experience, i),
      found: found(g?.experience, i),
      title: e.title,
      company: e.company,
      start: toYearMonth(e.start),
      end: isPresent(e.end) ? "" : toYearMonth(e.end),
      description: e.description ?? "",
      raw: [e.start, e.end].filter(Boolean).join(" – "),
    })),
  );
  const [edu, setEdu] = useState<Edu[]>(
    parsed.education.map((e, i) => ({ on: found(g?.education, i), found: found(g?.education, i), institution: e.institution, degree: e.degree, field: e.field ?? "", end_year: e.end_year?.match(/\d{4}/)?.[0] ?? "" })),
  );
  const [proj, setProj] = useState<Proj[]>(parsed.projects.map((p, i) => ({ on: found(g?.projects, i), found: found(g?.projects, i), title: p.title, description: p.description ?? "" })));
  const [certs, setCerts] = useState<Item[]>(parsed.certifications.map((c, i) => ({ on: found(g?.certifications, i), found: found(g?.certifications, i), value: c })));
  const [langs, setLangs] = useState<Item[]>(parsed.languages.map((c, i) => ({ on: found(g?.languages, i), found: found(g?.languages, i), value: c })));
  const [skills, setSkills] = useState<Skill[]>(parsed.skills.map((s, i) => ({ on: s.kind === "explicit" && found(g?.skills, i), found: found(g?.skills, i), name: s.name, evidence: s.evidence ?? null, kind: s.kind })));
  const upd = <T,>(set: React.Dispatch<React.SetStateAction<T[]>>, i: number, patch: Partial<T>) =>
    set((arr) => arr.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  const missingDates = exp.filter((e) => e.on && !e.start).length;
  function save() {
    setError(null);
    if (missingDates)
      return setError(L("Add a start month (YYYY-MM) for each selected role, or untick it.", "أضف شهر البداية (سنة-شهر) لكل دور مختار، أو ألغِ اختياره."));
    start(async () => {
      const r = await applyCvReview(documentId, {
        ...basics,
        experience: exp.filter((e) => e.on).map(({ title, company, start: s, end, description }) => ({ title, company, start: s, end, description })),
        education: edu.filter((e) => e.on).map(({ institution, degree, field, end_year }) => ({ institution, degree, field, end_year })),
        projects: proj.filter((p) => p.on).map(({ title, description }) => ({ title, description })),
        certifications: certs.filter((c) => c.on && c.value.trim()).map((c) => c.value),
        languages: langs.filter((c) => c.on && c.value.trim()).map((c) => c.value),
        skills: skills.filter((s) => s.on).map(({ name, evidence, kind }) => ({ name, evidence, kind })),
      });
      if (!r.ok) return setError(r.error);
      toast.success(r.message);
      onDone();
    });
  }

  const section = (title: string, count: number, children: React.ReactNode) => (
    <section className="flex flex-col gap-3">
      <h4 className="flex items-center gap-2 text-sm font-bold">
        {title} <span className="text-subtle ltr-nums text-xs font-normal">({count})</span>
      </h4>
      {count === 0 ? <p className="text-subtle text-xs">{L("Nothing found in the CV.", "لم يُعثر على شيء في السيرة.")}</p> : children}
    </section>
  );
  const row = "flex flex-col gap-2 rounded-xl border p-3";
  const notFound = (
    <Badge tone="muted">{L("Not found word-for-word in your CV — check before keeping", "غير موجود حرفيًا في سيرتك — تحقّق قبل الاعتماد")}</Badge>
  );
  const keep = (on: boolean, toggle: (v: boolean) => void, isFound = true) => (
    <span className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-xs font-semibold">
        <Checkbox checked={on} onChange={(e) => toggle(e.target.checked)} /> {L("Keep", "اعتماد")}
      </label>
      {!isFound && notFound}
    </span>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={parsed.method === "ai" ? "progress" : "neutral"}>{parsed.method === "ai" ? t.common.aiGenerated : t.common.ruleBased}</Badge>
        <p className="text-muted text-xs">
          {L(
            "Only what your CV states was extracted. Edit or remove anything, then approve. Nothing is added until you save.",
            "استُخرج فقط ما تذكره سيرتك. عدّل أو احذف ما تشاء ثم اعتمد. لا يُضاف شيء قبل الحفظ.",
          )}
        </p>
        {g && !g.checked && (
          <p className="bg-warning-soft text-warning w-full rounded-xl px-3 py-2 text-xs font-semibold">
            {L(
              "This file has no readable text layer (e.g. a scanned image), so items could not be checked against it. Review each one carefully.",
              "لا يحتوي هذا الملف على نص قابل للقراءة (مثل صورة ممسوحة)، فلم نتمكن من مطابقة العناصر معه. راجع كل عنصر بعناية.",
            )}
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={L("Full name", "الاسم الكامل")} htmlFor="cvr-name">
          <Input id="cvr-name" value={basics.full_name} onChange={(e) => setBasics({ ...basics, full_name: e.target.value })} />
        </Field>
        <Field label={L("Professional headline", "العنوان المهني")} htmlFor="cvr-head">
          <Input id="cvr-head" value={basics.headline} onChange={(e) => setBasics({ ...basics, headline: e.target.value })} />
        </Field>
        <Field label={L("Summary", "النبذة")} htmlFor="cvr-sum" className="sm:col-span-2">
          <Textarea id="cvr-sum" rows={3} value={basics.summary} onChange={(e) => setBasics({ ...basics, summary: e.target.value })} />
        </Field>
        {(parsed.email || parsed.phone) && (
          <p className="text-subtle text-xs sm:col-span-2" dir="auto">
            {L("Contact details found (kept private, not added to your public profile)", "بيانات تواصل وُجدت (تبقى خاصة ولا تُضاف لملفك)")}:{" "}
            <span dir="ltr">{[parsed.email, parsed.phone].filter(Boolean).join(" · ")}</span>
          </p>
        )}
      </div>

      {section(L("Experience", "الخبرات"), exp.length,
        exp.map((e, i) => (
          <div key={i} className={row}>
            <div className="flex items-center justify-between gap-2">
              {keep(e.on, (v) => upd(setExp, i, { on: v }), e.found)}
              {e.raw && <span className="text-subtle text-[11px]" dir="auto">{L("CV dates", "التواريخ في السيرة")}: {e.raw}</span>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input aria-label={L("Title", "المسمى")} value={e.title} onChange={(x) => upd(setExp, i, { title: x.target.value })} />
              <Input aria-label={L("Organization", "الجهة")} value={e.company} onChange={(x) => upd(setExp, i, { company: x.target.value })} />
              <Input aria-label={L("Start (YYYY-MM)", "البداية (سنة-شهر)")} placeholder={L("Start YYYY-MM", "البداية سنة-شهر")} value={e.start} dir="ltr" onChange={(x) => upd(setExp, i, { start: x.target.value })} aria-invalid={e.on && !e.start} />
              <Input aria-label={L("End (YYYY-MM, empty = current)", "النهاية (فارغ = حالي)")} placeholder={L("End YYYY-MM or empty if current", "النهاية أو فارغ إن كان حاليًا")} value={e.end} dir="ltr" onChange={(x) => upd(setExp, i, { end: x.target.value })} />
            </div>
            <Textarea aria-label={L("Description", "الوصف")} rows={2} value={e.description} onChange={(x) => upd(setExp, i, { description: x.target.value })} />
          </div>
        )),
      )}

      {section(L("Education", "التعليم"), edu.length,
        edu.map((e, i) => (
          <div key={i} className={row}>
            {keep(e.on, (v) => upd(setEdu, i, { on: v }), e.found)}
            <div className="grid gap-2 sm:grid-cols-2">
              <Input aria-label={L("Institution", "المؤسسة")} value={e.institution} onChange={(x) => upd(setEdu, i, { institution: x.target.value })} />
              <Input aria-label={L("Degree", "الدرجة")} value={e.degree} onChange={(x) => upd(setEdu, i, { degree: x.target.value })} />
              <Input aria-label={L("Field", "التخصص")} value={e.field} onChange={(x) => upd(setEdu, i, { field: x.target.value })} />
              <Input aria-label={L("Graduation year", "سنة التخرج")} value={e.end_year} dir="ltr" onChange={(x) => upd(setEdu, i, { end_year: x.target.value })} />
            </div>
          </div>
        )),
      )}

      {section(L("Projects", "المشاريع"), proj.length,
        proj.map((p, i) => (
          <div key={i} className={row}>
            {keep(p.on, (v) => upd(setProj, i, { on: v }), p.found)}
            <Input aria-label={L("Project", "المشروع")} value={p.title} onChange={(x) => upd(setProj, i, { title: x.target.value })} />
            <Textarea aria-label={L("Description", "الوصف")} rows={2} value={p.description} onChange={(x) => upd(setProj, i, { description: x.target.value })} />
          </div>
        )),
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {([
          [L("Certifications", "الشهادات"), certs, setCerts],
          [L("Languages", "اللغات"), langs, setLangs],
        ] as const).map(([title, list, set]) => (
          <section key={title} className="flex flex-col gap-2">
            <h4 className="text-sm font-bold">{title}</h4>
            {list.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Checkbox aria-label={L("Keep", "اعتماد")} checked={c.on} onChange={(e) => upd(set, i, { on: e.target.checked })} />
                <Input value={c.value} onChange={(e) => upd(set, i, { value: e.target.value })} title={c.found ? undefined : L("Not found word-for-word in your CV", "غير موجود حرفيًا في سيرتك")} aria-invalid={!c.found || undefined} />
                <Button type="button" size="icon" variant="ghost" aria-label={L("Remove", "حذف")} onClick={() => set((a) => a.filter((_, k) => k !== i))}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => set((a) => [...a, { on: true, found: true, value: "" }])}>
              <Plus /> {L("Add", "إضافة")}
            </Button>
          </section>
        ))}
      </div>

      {section(L("Skills", "المهارات"), skills.length,
        <ul className="grid gap-2 sm:grid-cols-2">
          {skills.map((s, i) => (
            <li key={i} className="flex items-start gap-2 rounded-xl border p-3">
              <Checkbox aria-label={s.name} checked={s.on} onChange={(e) => upd(setSkills, i, { on: e.target.checked })} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                  {s.name}
                  <Badge tone={s.kind === "explicit" ? "info" : "muted"}>
                    {s.kind === "explicit" ? L("Stated in CV", "مذكورة في السيرة") : L("Inferred — not verified", "مستنتجة — غير موثّقة")}
                  </Badge>
                  {!s.found && s.kind === "explicit" && notFound}
                </p>
                {s.evidence && <p className="text-subtle mt-0.5 line-clamp-2 text-xs" dir="auto">“{s.evidence}”</p>}
              </div>
            </li>
          ))}
        </ul>,
      )}
      <p className="text-subtle text-xs">
        {L(
          "Skills stated in your CV are saved as CV evidence; inferred skills you approve are saved as self-reported. Neither counts as verified — practical tasks and assessments add verified evidence.",
          "تُحفظ المهارات المذكورة في سيرتك كأدلة من السيرة، والمستنتجة التي تعتمدها كمهارات مُصرَّح بها ذاتيًا. ولا يُعدّ أيّ منهما موثّقًا؛ المهام العملية والتقييمات هي ما يضيف أدلة موثّقة.",
        )}
      </p>
      {error && <FormMessage>{error}</FormMessage>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={save} loading={pending}>
          {L("Approve and save to my profile", "اعتماد وحفظ في ملفي")}
        </Button>
      </div>
    </div>
  );
}
