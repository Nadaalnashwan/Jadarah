"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  CheckCircle2,
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
import { Checkbox, Input } from "@/components/ui/form";
import { getBrowserClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/client";
import { formatDate, tx } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import {
  confirmExtractedSkills,
  deleteCv,
  getDocumentUrl,
  parseCv,
  registerCvUpload,
  setPrimaryCv,
} from "@/features/candidate/cv-actions";
import type { ParsedCv } from "@/services/ai/cv";

const ACCEPT = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

export function CvUploader({ userId }: { userId: string }) {
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
    router.refresh();
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
          <ReviewPanel
            key={review.id}
            docId={review.id}
            parsed={review.parsed}
            onDone={() => {
              setReview(null);
              router.refresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ReviewPanel({ docId, parsed, onDone }: { docId: string; parsed: ParsedCv; onDone: () => void }) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const [selected, setSelected] = useState<Record<string, { on: boolean; level: number }>>(
    Object.fromEntries(parsed.skills.map((s) => [s.name, { on: s.kind === "explicit", level: 3 }])),
  );
  const [saving, setSaving] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="border-primary/30 bg-accent-soft/40 rounded-2xl border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">{L("Review extracted information", "راجِع المعلومات المستخرجة")}</h3>
        <Badge tone={parsed.method === "ai" ? "progress" : "neutral"}>
          {parsed.method === "ai" ? t.common.aiGenerated : t.common.ruleBased}
        </Badge>
      </div>
      <p className="text-muted mt-1 text-xs">
        {L(
          "Nothing is added to your profile until you confirm. Inferred skills are unticked by default.",
          "لا يُضاف شيء إلى ملفك حتى تؤكد. المهارات المستنتجة غير محددة افتراضيًا.",
        )}
      </p>
      {parsed.skills.length === 0 ? (
        <p className="text-subtle mt-4 text-sm">
          {L(
            "No skills from our taxonomy were found in this document.",
            "لم يُعثر على مهارات من تصنيفنا في هذه الوثيقة.",
          )}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {parsed.skills.map((s) => (
            <li key={s.name} className="bg-surface flex flex-wrap items-center gap-3 rounded-xl p-3">
              <Checkbox
                checked={selected[s.name]?.on ?? false}
                onChange={(e) =>
                  setSelected((p) => ({ ...p, [s.name]: { ...p[s.name], on: e.target.checked } }))
                }
                aria-label={s.name}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {s.name}{" "}
                  {s.kind === "inferred" && <Badge tone="progress">{L("AI inference", "استنتاج")}</Badge>}
                </p>
                {s.evidence && <p className="text-subtle truncate text-xs">“{s.evidence}”</p>}
              </div>
              <label className="flex items-center gap-2 text-xs">
                {L("Level", "المستوى")}
                <select
                  className="bg-surface rounded-lg border px-2 py-1"
                  value={selected[s.name]?.level ?? 3}
                  onChange={(e) =>
                    setSelected((p) => ({ ...p, [s.name]: { ...p[s.name], level: Number(e.target.value) } }))
                  }
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {t.common.cancel}
        </Button>
        <Button
          loading={saving}
          onClick={async () => {
            setSaving(true);
            const res = await confirmExtractedSkills(
              docId,
              parsed.skills
                .filter((s) => selected[s.name]?.on)
                .map((s) => ({ name: s.name, level: selected[s.name].level, evidence: s.evidence ?? null })),
            );
            setSaving(false);
            if (res.ok) {
              toast.success(res.message);
              onDone();
            } else toast.error(res.error);
          }}
        >
          <CheckCircle2 /> {L("Confirm selected skills", "تأكيد المهارات المحددة")}
        </Button>
      </div>
    </motion.div>
  );
}
