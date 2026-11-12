import Link from "next/link";
import { ClipboardCheck, Lock, Pencil, Replace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { pick, tx, type Locale } from "@/lib/i18n/config";
import type { ServerSupabase } from "@/lib/supabase/server";
import { jobTaskLocked } from "@/features/company/job-task";
import { DetachTaskButton } from "./task-client";

/** Job page card: the practical task attached to this job, its status and what the employer can do next. */
export async function JobTaskPanel({
  supabase,
  jobId,
  jobStatus,
  assessmentId,
  locale,
}: {
  supabase: ServerSupabase;
  jobId: string;
  jobStatus: string;
  assessmentId: string | null;
  locale: Locale;
}) {
  const L = tx(locale);
  if (!assessmentId)
    return (
      <Card className="mb-6 border-dashed">
        <CardHeader
          title={L("Practical task", "المهمة العملية")}
          description={L(
            "Applicants complete the job's practical task right after applying — no manual assignment needed",
            "يكمل المتقدمون المهمة العملية مباشرة بعد التقديم، دون الحاجة إلى إسنادها يدويًا",
          )}
          action={
            <Button asChild size="sm">
              <Link href={`/company/jobs/${jobId}/task`}>
                <ClipboardCheck /> {L("Create practical task", "إنشاء مهمة عملية")}
              </Link>
            </Button>
          }
        />
        <CardBody className="text-subtle pt-3 text-xs">
          {L("Optional. Jobs without a task receive applications directly", "اختياري. الوظائف دون مهمة تستقبل الطلبات مباشرة")}
        </CardBody>
      </Card>
    );
  const [{ data: a }, locked, { count: completed }] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, title_en, title_ar, status, duration_minutes, company_id, assessment_questions(count)")
      .eq("id", assessmentId)
      .maybeSingle(),
    jobTaskLocked(supabase, jobId),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("requires_task", true)
      .not("completed_at", "is", null),
  ]);
  if (!a) return null;
  const qc = (a.assessment_questions as unknown as { count: number }[])[0]?.count ?? 0;
  const published = a.status === "published";
  return (
    <Card className="mb-6">
      <CardHeader
        title={L("Practical task", "المهمة العملية")}
        description={pick(a, "title", locale)}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={published ? "positive" : a.status === "archived" ? "muted" : "progress"} dot>
              {published ? L("Published", "منشورة") : a.status === "archived" ? L("Archived", "مؤرشفة") : L("Draft", "مسودة")}
            </Badge>
            {locked && (
              <Badge tone="info">
                <Lock className="size-3" /> {L("Locked for fairness", "مثبّتة للعدالة")}
              </Badge>
            )}
          </div>
        }
      />
      <CardBody className="flex flex-col gap-4 pt-3">
        <p className="text-muted ltr-nums text-sm">
          {qc} {L("items", "بنود")} · {a.duration_minutes} {L("min", "دقيقة")}
          {locked && (
            <>
              {" "}
              · {completed ?? 0} {L("submitted applications", "طلبات مكتملة")}
            </>
          )}
        </p>
        {!published && (
          <p className="bg-sky-soft text-navy rounded-xl px-3 py-2 text-sm dark:text-sky">
            {jobStatus === "published"
              ? L("Publish this task so new applicants receive it", "انشر هذه المهمة ليستلمها المتقدمون الجدد")
              : L(
                  "Review and publish the task, then publish the job. Both stay private until then",
                  "راجع المهمة وانشرها، ثم انشر الوظيفة. يبقى الاثنان غير منشورين حتى ذلك الحين",
                )}
          </p>
        )}
        {locked && (
          <p className="text-subtle text-xs">
            {L(
              "Candidates have received this exact version. It can no longer be edited or replaced, so every applicant is assessed on the same task",
              "استلم المرشحون هذه النسخة تحديدًا، فلا يمكن تعديلها أو استبدالها بعد الآن، ليُقيَّم جميع المتقدمين على المهمة نفسها",
            )}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {a.company_id && (
            <Button asChild size="sm" variant={published ? "outline" : "primary"}>
              <Link href={`/company/assessments/${a.id}?job=${jobId}`}>
                <Pencil /> {published || locked ? L("Open task", "فتح المهمة") : L("Edit & publish task", "تعديل المهمة ونشرها")}
              </Link>
            </Button>
          )}
          {!locked && (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/company/jobs/${jobId}/task?replace=1`}>
                  <Replace /> {L("Replace", "استبدال")}
                </Link>
              </Button>
              <DetachTaskButton jobId={jobId} />
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
