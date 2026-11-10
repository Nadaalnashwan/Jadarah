"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCandidate } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AIUnavailableError, parseCvRuleBased, parseCvWithAI, type ParsedCv } from "@/services/ai/cv";

export const CV_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];
const MAX = 10 * 1024 * 1024;

const registerSchema = z.object({
  path: z.string().min(10).max(400),
  file_name: z.string().min(1).max(200),
  mime_type: z.enum(CV_MIME as [string, ...string[]]),
  size_bytes: z.number().int().positive().max(MAX),
  label: z.string().max(80).optional(),
});

/** Called after the browser uploaded directly to the private bucket (storage RLS restricts the path to {uid}/...). */
export async function registerCvUpload(input: z.infer<typeof registerSchema>): Promise<ActionResult> {
  const session = await requireCandidate();
  const { locale } = await getI18n();
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success || !parsed.data.path.startsWith(`${session.userId}/`))
    return { ok: false, error: localizeError(null, locale) };
  const supabase = await createClient();
  const { count } = await supabase
    .from("candidate_documents")
    .select("id", { count: "exact", head: true })
    .eq("candidate_id", session.userId)
    .eq("kind", "cv");
  const { data: primary } = await supabase
    .from("candidate_documents")
    .select("id")
    .eq("candidate_id", session.userId)
    .eq("kind", "cv")
    .eq("is_primary", true)
    .is("deleted_at", null)
    .maybeSingle();
  const { error } = await supabase.from("candidate_documents").insert({
    candidate_id: session.userId,
    kind: "cv",
    bucket: "candidate-cvs",
    storage_path: parsed.data.path,
    file_name: parsed.data.file_name,
    mime_type: parsed.data.mime_type,
    size_bytes: parsed.data.size_bytes,
    label: parsed.data.label || null,
    version: (count ?? 0) + 1, // every upload is a new version; nothing is overwritten
    is_primary: !primary,
  });
  if (error) {
    await supabase.storage.from("candidate-cvs").remove([parsed.data.path]);
    return { ok: false, error: localizeError(error, locale) };
  }
  revalidatePath("/candidate", "layout");
  return { ok: true };
}

export async function getDocumentUrl(documentId: string): Promise<ActionResult<{ url: string }>> {
  await requireCandidate();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("candidate_documents")
    .select("bucket, storage_path, file_name")
    .eq("id", documentId)
    .is("deleted_at", null)
    .single();
  if (!doc) return { ok: false, error: localizeError({ code: "42501" }, locale) };
  const { data, error } = await supabase.storage
    .from(doc.bucket)
    .createSignedUrl(doc.storage_path, 60, { download: doc.file_name });
  if (error || !data) return { ok: false, error: localizeError(error, locale) };
  return { ok: true, data: { url: data.signedUrl } };
}

export async function setPrimaryCv(documentId: string) {
  const session = await requireCandidate();
  const supabase = await createClient();
  await supabase
    .from("candidate_documents")
    .update({ is_primary: false })
    .eq("candidate_id", session.userId)
    .eq("kind", "cv");
  await supabase
    .from("candidate_documents")
    .update({ is_primary: true })
    .eq("id", documentId)
    .eq("candidate_id", session.userId);
  revalidatePath("/candidate/cvs");
}

/** Soft-delete keeps the record for applications that referenced it; the private file is removed. */
export async function deleteCv(documentId: string): Promise<ActionResult> {
  const session = await requireCandidate();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("candidate_documents")
    .select("storage_path, bucket, is_primary")
    .eq("id", documentId)
    .eq("candidate_id", session.userId)
    .single();
  if (!doc) return { ok: false, error: localizeError({ code: "42501" }, locale) };
  const { data: used } = await supabase
    .from("applications")
    .select("id")
    .eq("cv_document_id", documentId)
    .limit(1);
  if (used && used.length) {
    // Referenced by a submitted application: hide from the candidate's list but keep for the company's record.
    await supabase
      .from("candidate_documents")
      .update({ is_primary: false, label: "[archived]" })
      .eq("id", documentId);
    revalidatePath("/candidate/cvs");
    return {
      ok: true,
      message:
        locale === "ar"
          ? "هذه النسخة مرتبطة بطلب مقدَّم، فأرشفناها ولم نحذفها."
          : "This version is attached to a submitted application, so it was archived instead of deleted.",
    };
  }
  await supabase.storage.from(doc.bucket).remove([doc.storage_path]);
  await supabase
    .from("candidate_documents")
    .update({ deleted_at: new Date().toISOString(), is_primary: false })
    .eq("id", documentId);
  revalidatePath("/candidate/cvs");
  return { ok: true };
}

async function extractText(bytes: ArrayBuffer, mime: string): Promise<string> {
  if (mime === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  if (mime.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return value;
  }
  return "";
}

export async function parseCv(documentId: string): Promise<ActionResult<{ parsed: ParsedCv }>> {
  const session = await requireCandidate();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("candidate_documents")
    .select("*")
    .eq("id", documentId)
    .eq("candidate_id", session.userId)
    .single();
  if (!doc) return { ok: false, error: localizeError({ code: "42501" }, locale) };
  await supabase.from("candidate_documents").update({ parse_status: "processing" }).eq("id", documentId);
  const { data: blob, error: dlErr } = await supabase.storage.from(doc.bucket).download(doc.storage_path);
  if (dlErr || !blob) {
    await supabase.from("candidate_documents").update({ parse_status: "failed" }).eq("id", documentId);
    return { ok: false, error: localizeError(dlErr, locale) };
  }
  const bytes = await blob.arrayBuffer();
  let text = "";
  try {
    text = await extractText(bytes, doc.mime_type);
  } catch {
    text = "";
  }
  let parsed: ParsedCv;
  try {
    parsed = await parseCvWithAI(
      session.userId,
      text,
      doc.mime_type === "application/pdf" && !text.trim()
        ? { mimeType: doc.mime_type, base64: Buffer.from(bytes).toString("base64") }
        : undefined,
    );
  } catch (e) {
    if (!(e instanceof AIUnavailableError)) throw e;
    const { data: taxonomy } = await supabase.from("skills").select("slug, name_en, aliases");
    parsed = parseCvRuleBased(text, taxonomy ?? []);
  }
  await supabase
    .from("candidate_documents")
    .update({ parse_status: "parsed", parsed_data: parsed as never, parsed_at: new Date().toISOString() })
    .eq("id", documentId);
  await supabase.from("ai_analysis_records").insert({
    user_id: session.userId,
    kind: "cv_parse",
    subject_type: "candidate_document",
    subject_id: documentId,
    provider: parsed.provider,
    is_demo: parsed.method === "rule_based",
    output: { skills: parsed.skills.length, method: parsed.method },
  });
  revalidatePath("/candidate/cvs");
  return { ok: true, data: { parsed } };
}

/** The candidate reviews extracted skills and confirms which to add — nothing is added silently. */
export async function confirmExtractedSkills(
  documentId: string,
  selections: { name: string; level: number; evidence: string | null }[],
): Promise<ActionResult> {
  const session = await requireCandidate();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const { data: taxonomy } = await supabase.from("skills").select("id, name_en, aliases");
  const byName = new Map<string, string>();
  (taxonomy ?? []).forEach((s) =>
    [s.name_en, ...s.aliases].forEach((n) => byName.set(n.toLowerCase(), s.id)),
  );
  const rows = selections
    .map((s) => ({ id: byName.get(s.name.toLowerCase()), ...s }))
    .filter((s) => s.id)
    .map((s) => ({
      candidate_id: session.userId,
      skill_id: s.id!,
      level: Math.min(5, Math.max(1, s.level)),
      source: "cv",
      evidence: s.evidence?.slice(0, 500) ?? "Extracted from CV",
    }));
  if (rows.length) {
    const { error } = await supabase
      .from("candidate_skills")
      .upsert(rows, { onConflict: "candidate_id,skill_id" });
    if (error) return { ok: false, error: localizeError(error, locale) };
  }
  await supabase.from("candidate_documents").update({ parse_status: "reviewed" }).eq("id", documentId);
  revalidatePath("/candidate", "layout");
  return {
    ok: true,
    message:
      locale === "ar"
        ? `أُضيفت ${rows.length} مهارة كأدلة من السيرة الذاتية.`
        : `${rows.length} skills added with CV evidence.`,
  };
}
