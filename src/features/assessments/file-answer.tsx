"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Loader2, RotateCcw, Trash2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";
import { getBrowserClient } from "@/lib/supabase/client";
import { UploadError, randomPrefix, uploadErrorMessage, uploadWithProgress } from "@/lib/upload/client";
import {
  ASSESSMENT_FILE_RULES as RULES,
  acceptAttribute,
  checkFile,
  formatBytes,
  problemMessage,
  resolveMime,
  safeObjectName,
} from "@/lib/upload/rules";
import { cn } from "@/lib/utils";
import { assessmentFileUrl, registerAssessmentFile, removeAssessmentFile, type AnswerFile } from "./file-actions";

type Pending = {
  key: string;
  file: File;
  progress: number;
  state: "uploading" | "saving" | "error";
  error?: string;
  abort?: AbortController;
};

/** Deliverable upload for a `file_upload` question (candidate side). */
export function FileAnswer({
  assignmentId,
  submissionId,
  questionId,
  files,
  disabled,
  onFilesChange,
}: {
  assignmentId: string;
  submissionId: string;
  questionId: string;
  files: AnswerFile[];
  disabled: boolean;
  /** Functional update so concurrent uploads never overwrite each other. */
  onFilesChange: (update: (prev: AnswerFile[]) => AnswerFile[]) => void;
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [drag, setDrag] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const patch = (key: string, p: Partial<Pending>) => setPending((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  async function upload(item: Pending) {
    const mime = resolveMime(item.file, RULES)!;
    const abort = new AbortController();
    patch(item.key, { state: "uploading", progress: 0, error: undefined, abort });
    try {
      const { data } = await getBrowserClient().auth.getUser();
      if (!data.user) throw new UploadError("session");
      const path = `${data.user.id}/${submissionId}/${questionId}/${randomPrefix()}-${safeObjectName(item.file.name)}`;
      await uploadWithProgress({
        bucket: "assessment-attachments",
        path,
        file: item.file,
        contentType: mime,
        signal: abort.signal,
        onProgress: (f) => patch(item.key, { progress: Math.round(f * 100) }),
      });
      patch(item.key, { state: "saving", progress: 100 });
      const res = await registerAssessmentFile({
        assignmentId,
        questionId,
        submissionId,
        path,
        name: item.file.name.slice(0, 200),
        mime,
        size: item.file.size,
      });
      if (!res.ok) throw new Error(res.error);
      setPending((xs) => xs.filter((x) => x.key !== item.key));
      const added = res.data;
      if (added) onFilesChange((prev) => [...prev, added]);
    } catch (e) {
      const msg = e instanceof UploadError ? uploadErrorMessage(e.code, locale) : e instanceof Error ? e.message : String(e);
      if (e instanceof UploadError && e.code === "aborted") setPending((xs) => xs.filter((x) => x.key !== item.key));
      else patch(item.key, { state: "error", error: msg });
    }
  }

  function add(list: FileList | null) {
    if (!list?.length || disabled) return;
    let count = files.length + pending.length;
    for (const file of Array.from(list)) {
      const problem = checkFile(file, RULES, count);
      if (problem) {
        toast.error(`${file.name}: ${problemMessage(problem, RULES, locale)}`);
        continue;
      }
      count++;
      const item: Pending = { key: `${Date.now()}-${Math.random()}`, file, progress: 0, state: "uploading" };
      setPending((xs) => [...xs, item]);
      void upload(item);
    }
    if (input.current) input.current.value = "";
  }

  async function remove(f: AnswerFile) {
    setBusyId(f.id);
    const res = await removeAssessmentFile(f.id);
    setBusyId(null);
    if (!res.ok) return toast.error(res.error);
    onFilesChange((prev) => prev.filter((x) => x.id !== f.id));
  }

  async function download(f: AnswerFile) {
    setBusyId(f.id);
    const res = await assessmentFileUrl(f.id);
    setBusyId(null);
    if (!res.ok || !res.data) return toast.error(res.ok ? L("Download failed.", "تعذّر التنزيل.") : res.error);
    window.location.assign(res.data.url);
  }

  const full = files.length + pending.length >= RULES.maxFiles;
  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition",
          drag ? "border-primary bg-accent-soft" : "border-border",
          (disabled || full) && "opacity-60",
        )}
      >
        <UploadCloud className="text-primary size-8" aria-hidden />
        <p className="font-semibold">{L("Drag files here or choose them", "اسحب الملفات هنا أو اخترها")}</p>
        <p className="text-subtle text-xs">
          {L(
            `Up to ${RULES.maxFiles} files · ${formatBytes(RULES.maxBytes)} each · PDF, Office, images, CSV, ZIP, text`,
            `حتى ${RULES.maxFiles} ملفات · ${formatBytes(RULES.maxBytes)} لكل ملف · PDF ومستندات Office والصور وCSV وZIP والنصوص`,
          )}
        </p>
        <input
          ref={input}
          type="file"
          multiple
          accept={acceptAttribute(RULES)}
          className="sr-only"
          id={`file-${questionId}`}
          disabled={disabled || full}
          onChange={(e) => add(e.target.files)}
        />
        <Button type="button" variant="outline" size="sm" disabled={disabled || full} onClick={() => input.current?.click()}>
          {L("Choose files", "اختر الملفات")}
        </Button>
      </div>

      {(files.length > 0 || pending.length > 0) && (
        <ul className="flex flex-col gap-2" aria-label={L("Attached files", "الملفات المرفقة")} aria-live="polite">
          {files.map((f) => (
            <li key={f.id} className="bg-surface-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm">
              <FileText className="text-primary size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate" dir="auto" title={f.file_name}>
                {f.file_name}
              </span>
              <span className="ltr-nums text-subtle text-xs">{formatBytes(f.size_bytes)}</span>
              <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => download(f)} disabled={busyId === f.id} aria-label={L(`Download ${f.file_name}`, `تنزيل ${f.file_name}`)}>
                {busyId === f.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              </Button>
              {!disabled && (
                <Button type="button" variant="ghost" size="icon" className="text-danger size-8" onClick={() => remove(f)} disabled={busyId === f.id} aria-label={L(`Remove ${f.file_name}`, `إزالة ${f.file_name}`)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className={cn("rounded-xl border px-3 py-2 text-sm", p.state === "error" && "border-danger/50 bg-danger-soft/40")}>
              <div className="flex items-center gap-3">
                {p.state === "error" ? <X className="text-danger size-4" aria-hidden /> : <Loader2 className="size-4 animate-spin" aria-hidden />}
                <span className="min-w-0 flex-1 truncate" dir="auto">
                  {p.file.name}
                </span>
                {p.state === "uploading" && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => p.abort?.abort()}>
                    {L("Cancel", "إلغاء")}
                  </Button>
                )}
                {p.state === "error" && (
                  <>
                    <Button type="button" variant="outline" size="sm" onClick={() => upload(p)}>
                      <RotateCcw className="size-3.5" /> {L("Retry", "إعادة المحاولة")}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setPending((xs) => xs.filter((x) => x.key !== p.key))} aria-label={L("Dismiss", "إخفاء")}>
                      <X className="size-4" />
                    </Button>
                  </>
                )}
              </div>
              {p.state !== "error" ? (
                <Progress value={p.progress} className="mt-2" label={p.state === "saving" ? L("Saving…", "جارٍ الحفظ…") : L("Uploading…", "جارٍ الرفع…")} />
              ) : (
                <p role="alert" className="text-danger mt-1 text-xs">
                  {p.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
