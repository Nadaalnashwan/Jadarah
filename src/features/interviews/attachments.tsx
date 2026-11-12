"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Paperclip, RotateCcw, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Progress } from "@/components/ui/primitives";
import { SignedFileLink } from "@/features/assessments/file-download";
import { useI18n } from "@/lib/i18n/client";
import { formatDateTime, tx } from "@/lib/i18n/config";
import { UploadError, randomPrefix, uploadErrorMessage, uploadWithProgress } from "@/lib/upload/client";
import {
  INTERVIEW_FILE_RULES as RULES,
  acceptAttribute,
  checkFile,
  formatBytes,
  problemMessage,
  resolveMime,
  safeObjectName,
} from "@/lib/upload/rules";
import {
  interviewAttachmentUrl,
  listInterviewAttachments,
  registerInterviewAttachment,
  removeInterviewAttachment,
  setAttachmentShared,
  type InterviewAttachment,
} from "./attachment-actions";

/**
 * Interview documents. Staff (recruiters, assigned interviewers) upload internal or shared files;
 * the candidate sees shared files and can add their own while the interview is scheduled.
 */
export function InterviewAttachments({
  interviewId,
  companyId,
  viewer,
  canUpload,
  currentUserId,
  canManageAll,
}: {
  interviewId: string;
  companyId: string;
  viewer: "staff" | "candidate";
  canUpload: boolean;
  currentUserId: string;
  /** Company recruiters can remove any document. */
  canManageAll?: boolean;
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [items, setItems] = useState<InterviewAttachment[] | null>(null);
  const [share, setShare] = useState(false);
  const [upload, setUpload] = useState<{ name: string; progress: number; error?: string; file: File } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => setItems(await listInterviewAttachments(interviewId)), [interviewId]);
  useEffect(() => {
    let alive = true;
    void listInterviewAttachments(interviewId).then((rows) => {
      if (alive) setItems(rows);
    });
    return () => {
      alive = false;
    };
  }, [interviewId]);

  async function send(file: File) {
    const problem = checkFile(file, RULES, items?.length ?? 0);
    if (problem) return toast.error(problemMessage(problem, RULES, locale));
    const mime = resolveMime(file, RULES)!;
    const path = `${companyId}/${interviewId}/${randomPrefix()}-${safeObjectName(file.name)}`;
    abort.current = new AbortController();
    setUpload({ name: file.name, progress: 0, file });
    try {
      await uploadWithProgress({
        bucket: "interview-attachments",
        path,
        file,
        contentType: mime,
        signal: abort.current.signal,
        onProgress: (f) => setUpload((u) => (u ? { ...u, progress: Math.round(f * 100) } : u)),
      });
      const res = await registerInterviewAttachment({
        interviewId,
        companyId,
        path,
        name: file.name.slice(0, 200),
        mime,
        size: file.size,
        share: viewer === "candidate" ? true : share,
      });
      if (!res.ok) throw new Error(res.error);
      setUpload(null);
      toast.success(L("Document added", "أُضيف المستند"));
      await refresh();
    } catch (e) {
      if (e instanceof UploadError && e.code === "aborted") return setUpload(null);
      const msg = e instanceof UploadError ? uploadErrorMessage(e.code, locale) : e instanceof Error ? e.message : String(e);
      setUpload((u) => (u ? { ...u, error: msg } : u));
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function toggle(a: InterviewAttachment) {
    setBusy(a.id);
    const res = await setAttachmentShared(a.id, !a.shared_with_candidate);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    await refresh();
  }

  async function remove(a: InterviewAttachment) {
    if (!confirm(L(`Remove ${a.file_name}?`, `إزالة ${a.file_name}؟`))) return;
    setBusy(a.id);
    const res = await removeInterviewAttachment(a.id);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    await refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {items === null ? (
        <p className="text-subtle flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> {L("Loading documents…", "جارٍ تحميل المستندات…")}
        </p>
      ) : items.length === 0 ? (
        <p className="text-subtle text-sm">
          {viewer === "staff"
            ? L("No documents yet. Add a brief, task or agenda", "لا توجد مستندات بعد. أضف موجزًا أو مهمة أو جدول أعمال")
            : L("No documents shared for this interview yet", "لم تُشارك مستندات لهذه المقابلة بعد")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((a) => (
            <li key={a.id} className="flex flex-col gap-1">
              <SignedFileLink name={a.file_name} size={a.size_bytes} getUrl={interviewAttachmentUrl.bind(null, a.id)} />
              <div className="text-subtle flex flex-wrap items-center gap-2 px-1 text-xs">
                <span>
                  {a.uploader_role === "candidate" ? L("From the candidate", "من المرشح") : a.uploader_name ?? L("Team", "الفريق")} ·{" "}
                  <span className="ltr-nums">{formatDateTime(a.created_at, locale)}</span>
                </span>
                {viewer === "staff" && (
                  <Badge tone={a.shared_with_candidate ? "info" : "muted"}>
                    {a.shared_with_candidate ? L("Visible to candidate", "ظاهر للمرشح") : L("Internal", "داخلي")}
                  </Badge>
                )}
                {viewer === "staff" && a.uploader_role === "staff" && (
                  <button type="button" onClick={() => toggle(a)} disabled={busy === a.id} className="text-primary inline-flex items-center gap-1 font-semibold">
                    {a.shared_with_candidate ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    {a.shared_with_candidate ? L("Make internal", "اجعله داخليًا") : L("Share with candidate", "شاركه مع المرشح")}
                  </button>
                )}
                {(a.uploaded_by === currentUserId || canManageAll) && (
                  <button type="button" onClick={() => remove(a)} disabled={busy === a.id} className="text-danger inline-flex items-center gap-1 font-semibold">
                    <Trash2 className="size-3.5" /> {L("Remove", "إزالة")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {upload && (
        <div className="rounded-xl border p-3 text-sm" aria-live="polite">
          <div className="flex items-center gap-2">
            <Paperclip className="size-4" />
            <span className="min-w-0 flex-1 truncate" dir="auto">
              {upload.name}
            </span>
            {upload.error ? (
              <>
                <Button type="button" size="sm" variant="outline" onClick={() => send(upload.file)}>
                  <RotateCcw className="size-3.5" /> {L("Retry", "إعادة المحاولة")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setUpload(null)}>
                  {L("Dismiss", "إخفاء")}
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" variant="ghost" onClick={() => abort.current?.abort()}>
                {L("Cancel", "إلغاء")}
              </Button>
            )}
          </div>
          {upload.error ? (
            <p role="alert" className="text-danger mt-1 text-xs">
              {upload.error}
            </p>
          ) : (
            <Progress value={upload.progress} className="mt-2" label={L("Uploading…", "جارٍ الرفع…")} />
          )}
        </div>
      )}

      {canUpload && (
        <div className="flex flex-wrap items-center gap-3">
          <input ref={input} type="file" accept={acceptAttribute(RULES)} className="sr-only" id={`att-${interviewId}`} onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
          <Button type="button" size="sm" variant="outline" disabled={Boolean(upload && !upload.error)} onClick={() => input.current?.click()}>
            <UploadCloud /> {L("Add document", "إضافة مستند")}
          </Button>
          {viewer === "staff" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="accent-primary size-4" />
              {L("Visible to the candidate", "ظاهر للمرشح")}
            </label>
          )}
          <span className="text-subtle text-xs">
            {L(`PDF, Word, PowerPoint, images, text · up to ${formatBytes(RULES.maxBytes)}`, `PDF وWord وPowerPoint والصور والنصوص · حتى ${formatBytes(RULES.maxBytes)}`)}
          </span>
        </div>
      )}
    </div>
  );
}
