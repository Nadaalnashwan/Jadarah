"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { rateLimitUser } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { kickEmailDispatch } from "@/services/email/dispatch";
import { INTERVIEW_FILE_RULES, resolveMime } from "@/lib/upload/rules";

const BUCKET = "interview-attachments";

export interface InterviewAttachment {
  id: string;
  file_name: string;
  size_bytes: number;
  mime_type: string;
  uploader_role: "staff" | "candidate";
  shared_with_candidate: boolean;
  created_at: string;
  uploaded_by: string | null;
  uploader_name: string | null;
}

/** Attachments visible to the caller (RLS: staff see all; the candidate sees shared + own). */
export async function listInterviewAttachments(interviewId: string): Promise<InterviewAttachment[]> {
  await requireSession();
  if (!z.string().uuid().safeParse(interviewId).success) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("interview_attachments")
    .select("id, file_name, size_bytes, mime_type, uploader_role, shared_with_candidate, created_at, uploaded_by, uploader:profiles!interview_attachments_uploaded_by_fkey(full_name)")
    .eq("interview_id", interviewId)
    .order("created_at");
  return (data ?? []).map((r) => ({
    ...r,
    uploader_role: r.uploader_role as "staff" | "candidate",
    uploader_name: (r.uploader as { full_name?: string } | null)?.full_name ?? null,
  }));
}

const registerSchema = z.object({
  interviewId: z.string().uuid(),
  companyId: z.string().uuid(),
  path: z.string().min(10).max(300),
  name: z.string().trim().min(1).max(200),
  mime: z.string().max(120),
  size: z.number().int().positive().max(INTERVIEW_FILE_RULES.maxBytes),
  share: z.boolean(),
});

export async function registerInterviewAttachment(input: z.infer<typeof registerSchema>): Promise<ActionResult> {
  const s = await requireSession();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const parsed = registerSchema.safeParse(input);
  const cleanup = () =>
    typeof input?.path === "string"
      ? supabase.storage.from(BUCKET).remove([input.path]).then(() => undefined, () => undefined)
      : Promise.resolve();
  if (!parsed.success || !parsed.data.path.startsWith(`${parsed.data.companyId}/${parsed.data.interviewId}/`)) {
    await cleanup();
    return { ok: false, error: localizeError({ message: "invalid file path" }, locale) };
  }
  if (!resolveMime({ name: parsed.data.name, type: parsed.data.mime }, INTERVIEW_FILE_RULES)) {
    await cleanup();
    return { ok: false, error: localizeError({ message: "file type is not allowed" }, locale) };
  }
  if (!(await rateLimitUser("interview-upload", s.userId, 30, 10 * 60_000))) {
    await cleanup();
    return { ok: false, error: locale === "ar" ? "محاولات رفع كثيرة. انتظر قليلًا" : "Too many uploads. Please wait a moment" };
  }
  const { error } = await supabase.rpc("register_interview_attachment", {
    p_interview: parsed.data.interviewId,
    p_path: parsed.data.path,
    p_name: parsed.data.name,
    p_mime: parsed.data.mime,
    p_size: parsed.data.size,
    p_share: parsed.data.share,
  });
  if (error) {
    await cleanup();
    return { ok: false, error: localizeError(error, locale) };
  }
  if (parsed.data.share) kickEmailDispatch();
  revalidatePath(`/company/interviews/${parsed.data.interviewId}`);
  return { ok: true };
}

export async function setAttachmentShared(attachmentId: string, share: boolean): Promise<ActionResult> {
  await requireSession();
  const { locale } = await getI18n();
  if (!z.string().uuid().safeParse(attachmentId).success) return { ok: false, error: localizeError(null, locale) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_interview_attachment_shared", { p_attachment: attachmentId, p_share: share });
  if (error) return { ok: false, error: localizeError(error, locale) };
  if (share) kickEmailDispatch();
  return { ok: true };
}

export async function removeInterviewAttachment(attachmentId: string): Promise<ActionResult> {
  await requireSession();
  const { locale } = await getI18n();
  if (!z.string().uuid().safeParse(attachmentId).success) return { ok: false, error: localizeError(null, locale) };
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("remove_interview_attachment", { p_attachment: attachmentId });
  if (error) return { ok: false, error: localizeError(error, locale) };
  if (path) await supabase.storage.from(BUCKET).remove([path]);
  return { ok: true };
}

/** 60-second signed URL; RLS on the row and on storage decides who gets one. */
export async function interviewAttachmentUrl(attachmentId: string): Promise<ActionResult<{ url: string }>> {
  await requireSession();
  const { locale } = await getI18n();
  if (!z.string().uuid().safeParse(attachmentId).success) return { ok: false, error: localizeError(null, locale) };
  const supabase = await createClient();
  const { data: a } = await supabase.from("interview_attachments").select("storage_path, file_name").eq("id", attachmentId).maybeSingle();
  if (!a) return { ok: false, error: localizeError({ message: "not authorized" }, locale) };
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.storage_path, 60, { download: a.file_name });
  if (error || !data) return { ok: false, error: localizeError({ message: "not authorized" }, locale) };
  return { ok: true, data: { url: data.signedUrl } };
}
