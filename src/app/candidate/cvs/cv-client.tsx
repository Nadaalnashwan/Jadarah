"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  Download,
  FileText,
  Loader2,
  ScanSearch,
  Star,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { Input } from "@/components/ui/form";
import { getBrowserClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/client";
import { formatDate, tx } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import {
  deleteCv,
  getDocumentUrl,
  parseCv,
  registerCvUpload,
  setPrimaryCv,
} from "@/features/candidate/cv-actions";
import type { ParsedCv } from "@/services/ai/cv";
import { CvReview } from "@/features/candidate/cv-review";

const ACCEPT = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

export function CvUploader({ userId, onUploaded }: { userId: string; onUploaded?: (documentId: string) => void }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!ACCEPT.includes(file.type))
      return setError(L("Only PDF or Word files are accepted.", "يُقبل ملف PDF أو Word فقط."));
    if (file.size > 10 * 1024 * 1024)
      return setError(L("The file is larger than 10 MB.", "حجم الملف أكبر من 10 ميجابايت."));
    setBusy(true);
    const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${userId}/${crypto.randomUUID()}-${safe}`;
    const { error: upErr } = await getBrowserClient()
      .storage.from("candidate-cvs")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setBusy(false);
      return setError(L("Upload failed. Please try again.", "فشل الرفع. حاول مرة أخرى."));
    }
    const res = await registerCvUpload({
      path,
      file_name: file.name.slice(0, 200),
      mime_type: file.type,
      size_bytes: file.size,
      label: label || undefined,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast.success(L("CV uploaded", "تم رفع السيرة الذاتية"));
    setLabel("");
    if (onUploaded && res.data) onUploaded(res.data.id);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder={L("Label (optional), e.g. Data roles", "تسمية (اختياري)، مثل: وظائف البيانات")}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={80}
        aria-label={L("Version label", "تسمية النسخة")}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        disabled={busy}
        className={cn(
          "flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition",
          drag
            ? "border-primary bg-accent-soft"
            : "border-border-strong hover:border-primary/60 hover:bg-surface-2",
        )}
      >
        {busy ? (
          <Loader2 className="text-primary size-8 animate-spin" />
        ) : (
          <UploadCloud className="text-primary dark:text-lavender size-8" />
        )}
        <span className="text-sm font-semibold">
          {busy
            ? L("Uploading securely…", "جارٍ الرفع بأمان…")
            : L("Drop your CV here or click to choose", "أفلت سيرتك هنا أو انقر للاختيار")}
        </span>
        <span className="text-subtle text-xs">PDF · DOCX · ≤ 10 MB</span>
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT.join(",")}
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {error && (
        <p role="alert" className="text-danger text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

type Doc = {
  id: string;
  file_name: string;
  label: string | null;
  version: number;
  is_primary: boolean;
  size_bytes: number;
  parse_status: string;
  parsed_data: unknown;
  created_at: string;
};

export function CvList({ docs }: { docs: Doc[] }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [parsingId, setParsingId] = useState<string | null>(null);
  const [review, setReview] = useState<{ id: string; parsed: ParsedCv } | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {docs.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-2xl border p-3 sm:flex-nowrap">
            <span className="bg-accent-soft text-primary dark:text-lavender flex size-10 shrink-0 items-center justify-center rounded-xl">
              <FileText className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{d.label || d.file_name}</p>
              <p className="ltr-nums text-subtle truncate text-xs">
                v{d.version} · {(d.size_bytes / 1024).toFixed(0)} KB · {formatDate(d.created_at, locale)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {d.is_primary ? (
                <Badge tone="accent">{L("Primary", "أساسية")}</Badge>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await setPrimaryCv(d.id);
                      router.refresh();
                    })
                  }
                  aria-label={L("Set as primary", "تعيين كأساسية")}
                >
                  <Star />
                </Button>
              )}
              {d.parse_status === "reviewed" && (
                <Badge tone="positive">{L("Reviewed", "تمت المراجعة")}</Badge>
              )}
              <Button
                size="sm"
                variant="soft"
                loading={parsingId === d.id}
                onClick={async () => {
                  setParsingId(d.id);
                  const res = await parseCv(d.id);
                  setParsingId(null);
                  if (!res.ok) return toast.error(res.error);
                  setReview({ id: d.id, parsed: res.data!.parsed });
                }}
              >
                <ScanSearch /> {L("Extract", "استخراج")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={L("Download", "تنزيل")}
                onClick={async () => {
                  const res = await getDocumentUrl(d.id);
                  if (res.ok) window.open(res.data!.url, "_blank", "noopener");
                  else toast.error(res.error);
                }}
              >
                <Download />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={L("Delete", "حذف")}
                onClick={() => {
                  if (
                    !confirm(
                      L("Delete this CV version? This cannot be undone.", "حذف هذه النسخة؟ لا يمكن التراجع."),
                    )
                  )
                    return;
                  start(async () => {
                    const res = await deleteCv(d.id);
                    if (res.ok) toast.success(res.message ?? L("Deleted", "تم الحذف"));
                    else toast.error(res.error);
                    router.refresh();
                  });
                }}
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <AnimatePresence>
        {review && (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 rounded-2xl border p-5"
          >
            <h3 className="mb-4 font-bold">{L("Review extracted information", "راجِع المعلومات المستخرجة")}</h3>
            <CvReview
              documentId={review.id}
              parsed={review.parsed}
              onDone={() => {
                setReview(null);
                router.refresh();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
