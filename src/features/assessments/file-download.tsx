"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";
import { formatBytes } from "@/lib/upload/rules";

/** A file row with a short-lived signed download link fetched on click (authorization in the DB). */
export function SignedFileLink({
  name,
  size,
  getUrl,
}: {
  name: string;
  size: number;
  getUrl: () => Promise<{ ok: true; data?: { url: string } } | { ok: false; error: string }>;
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await getUrl();
        setBusy(false);
        if (!res.ok || !res.data) return toast.error(res.ok ? L("Download failed", "تعذّر التنزيل") : res.error);
        window.location.assign(res.data.url);
      }}
      className="bg-surface-2 hover:bg-accent-soft flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-sm transition"
      aria-label={L(`Download ${name}`, `تنزيل ${name}`)}
    >
      <FileText className="text-primary size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate" dir="auto">
        {name}
      </span>
      <span className="ltr-nums text-subtle text-xs">{formatBytes(size)}</span>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
    </button>
  );
}
