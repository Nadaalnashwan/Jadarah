"use client";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { FileCheck2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { submitVerification } from "@/features/company/actions";
import type { ActionResult } from "@/lib/errors";
import { getBrowserClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

const OK = ["application/pdf", "image/png", "image/jpeg"];

export function VerificationForm({ companyId }: { companyId: string }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [paths, setPaths] = useState<{ path: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(submitVerification, null);
  useEffect(() => {
    if (state?.ok) toast.success(state.message);
  }, [state]);

  async function onFile(f: File) {
    setErr(null);
    if (!OK.includes(f.type) || f.size > 10 * 1024 * 1024) return setErr(L("PDF/PNG/JPEG up to 10 MB.", "PDF/PNG/JPEG حتى 10 ميجابايت."));
    setUploading(true);
    const path = `${companyId}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]+/g, "_").slice(-60)}`;
    const { error } = await getBrowserClient().storage.from("company-documents").upload(path, f, { contentType: f.type });
    setUploading(false);
    if (error) return setErr(L("Upload failed.", "فشل الرفع."));
    setPaths((p) => [...p, { path, name: f.name }]);
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={L("Commercial registration number", "رقم السجل التجاري")} htmlFor="cr" required><Input id="cr" name="commercial_registration" required dir="ltr" maxLength={40} /></Field>
      <div>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-sm font-semibold hover:border-primary/60">
          <Upload className="size-4" /> {uploading ? L("Uploading…", "جارٍ الرفع…") : L("Attach document", "إرفاق مستند")}
          <input type="file" accept={OK.join(",")} className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        <ul className="mt-2 space-y-1 text-sm">{paths.map((p) => <li key={p.path} className="flex items-center gap-2"><FileCheck2 className="size-4 text-success" /> {p.name}<input type="hidden" name="document_paths" value={p.path} /></li>)}</ul>
        {err && <p className="mt-1 text-xs text-danger">{err}</p>}
      </div>
      <Field label={L("Notes for the reviewer", "ملاحظات للمراجِع")} htmlFor="notes"><Textarea id="notes" name="notes" rows={3} maxLength={1000} /></Field>
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" loading={pending} disabled={uploading}>{L("Submit for review", "إرسال للمراجعة")}</Button>
    </form>
  );
}
