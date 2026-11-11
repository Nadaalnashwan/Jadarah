"use client";
import { useActionState, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { generateFromJob } from "@/features/assessments/builder-actions";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

type JobOption = { id: string; title: string; seniority: string; description: string; responsibilities: string; required: string[]; preferred: string[] };

export function BuilderForm({
  jobs,
  initialJob,
  attach = false,
  creationKey,
}: {
  jobs: JobOption[];
  initialJob?: string;
  attach?: boolean;
  creationKey?: string;
}) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const [jobId, setJobId] = useState(initialJob && jobs.some((j) => j.id === initialJob) ? initialJob : (jobs[0]?.id ?? ""));
  const job = jobs.find((j) => j.id === jobId);
  const [state, action, pending] = useActionState(generateFromJob, null);
  return (
    <form action={action} key={jobId} className="surface-card flex max-w-3xl flex-col gap-4 p-6">
      {attach && jobId === initialJob && (
        <>
          <input type="hidden" name="attach" value="1" />
          {creationKey && <input type="hidden" name="creation_key" value={creationKey} />}
          <p className="bg-sky-soft text-navy rounded-xl px-3 py-2 text-sm dark:text-sky">
            {L(
              "The generated draft will be attached to this job as its practical task. Nothing is published automatically.",
              "ستُربط المسودة المولّدة بهذه الوظيفة كمهمتها العملية. لا يُنشر شيء تلقائيًا.",
            )}
          </p>
        </>
      )}
      <Field label={L("Job", "الوظيفة")} htmlFor="b-job" required>
        <Select id="b-job" name="job_id" value={jobId} onChange={(e) => setJobId(e.target.value)} required>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </Select>
      </Field>
      {job && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={L("Title", "المسمى")} htmlFor="b-title" className="sm:col-span-2">
              <Input id="b-title" name="title" defaultValue={job.title} required />
            </Field>
            <Field label={L("Seniority", "المستوى")} htmlFor="b-level">
              <Select id="b-level" name="seniority" defaultValue={job.seniority}>
                {(["entry", "junior", "mid", "senior", "lead"] as const).map((l) => (
                  <option key={l} value={l}>{t.level[l]}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={L("Description", "الوصف")} htmlFor="b-desc">
            <Textarea id="b-desc" name="description" rows={3} defaultValue={job.description} />
          </Field>
          <Field label={L("Responsibilities", "المسؤوليات")} htmlFor="b-resp">
            <Textarea id="b-resp" name="responsibilities" rows={3} defaultValue={job.responsibilities} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={L("Required skills", "المهارات المطلوبة")} htmlFor="b-req" required>
              <Textarea id="b-req" name="required_skills" rows={2} defaultValue={job.required.join(", ")} required />
            </Field>
            <Field label={L("Preferred skills", "المهارات المفضّلة")} htmlFor="b-pref">
              <Textarea id="b-pref" name="preferred_skills" rows={2} defaultValue={job.preferred.join(", ")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={L("Constraints", "القيود")} htmlFor="b-con" className="sm:col-span-2">
              <Textarea id="b-con" name="constraints" rows={2} />
            </Field>
            <Field label={L("Duration (min)", "المدة (دقيقة)")} htmlFor="b-dur">
              <Input id="b-dur" name="duration_minutes" type="number" min={30} max={480} defaultValue={120} className="ltr-nums" />
            </Field>
          </div>
          <Field label={L("Expected outcomes", "النتائج المتوقعة")} htmlFor="b-out">
            <Textarea id="b-out" name="expected_outcomes" rows={2} />
          </Field>
        </>
      )}
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" size="lg" loading={pending} disabled={!job}>
        <Sparkles /> {pending ? L("Generating…", "جارٍ التوليد…") : L("Generate draft", "توليد مسودة")}
      </Button>
    </form>
  );
}
