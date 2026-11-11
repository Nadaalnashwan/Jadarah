"use server";
import { z } from "zod";
import { requireCandidate, requireSession } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { rateLimitUser } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { ASSESSMENT_FILE_RULES, resolveMime } from "@/lib/upload/rules";

const BUCKET = "assessment-attachments";

export interface AnswerFile {
  id: string;
  question_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

/** Files of the caller's own attempt (RLS: owner only). */
export async function listAttemptFiles(submissionId: string): Promise<AnswerFile[]> {
  const s = await requireCandidate();
  if (!z.string().uuid().safeParse(submissionId).success) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessment_answer_files")
    .select("id, question_id, file_name, mime_type, size_bytes, created_at")
    .eq("submission_id", submissionId)
    .eq("candidate_id", s.userId)
    .order("created_at");
  return data ?? [];
}

const registerSchema = z.object({
  assignmentId: z.string().uuid(),
  questionId: z.string().uuid(),
  submissionId: z.string().uuid(),
  path: z.string().min(10).max(300),
  name: z.string().trim().min(1).max(200),
  mime: z.string().max(120),
  size: z.number().int().positive().max(ASSESSMENT_FILE_RULES.maxBytes),
});

/**
 * Register an uploaded object as part of the answer. The database re-checks ownership, attempt
 * state, question type, path shape, size/type from storage metadata and the per-question limit.
 * On rejection the orphaned object is removed.
 */
export async function registerAssessmentFile(input: z.infer<typeof registerSchema>): Promise<ActionResult<AnswerFile>> {
  const s = await requireCandidate();
  const { locale } = await getI18n();
  const parsed = registerSchema.safeParse(input);
  const supabase = await createClient();
  const cleanup = () =>
    typeof input?.path === "string" && input.path.startsWith(`${s.userId}/`)
      ? supabase.storage.from(BUCKET).remove([input.path]).then(() => undefined, () => undefined)
      : Promise.resolve();
  if (!parsed.success || !parsed.data.path.startsWith(`${s.userId}/${parsed.data.submissionId}/${parsed.data.questionId}/`)) {
    await cleanup();
    return { ok: false, error: localizeError({ message: "invalid file path" }, locale) };
  }
  if (!resolveMime({ name: parsed.data.name, type: parsed.data.mime }, ASSESSMENT_FILE_RULES)) {
    await cleanup();
    return { ok: false, error: localizeError({ message: "file type is not allowed" }, locale) };
  }
  if (!(await rateLimitUser("assessment-upload", s.userId, 30, 10 * 60_000))) {
    await cleanup();
    return { ok: false, error: locale === "ar" ? "محاولات رفع كثيرة. انتظر قليلًا." : "Too many uploads. Please wait a moment." };
  }
  const { data: id, error } = await supabase.rpc("register_assessment_file", {
    p_assignment: parsed.data.assignmentId,
    p_question: parsed.data.questionId,
    p_path: parsed.data.path,
    p_name: parsed.data.name,
    p_mime: parsed.data.mime,
    p_size: parsed.data.size,
  });
  if (error) {
    await cleanup();
    return { ok: false, error: localizeError(error, locale) };
  }
  const { data: row } = await supabase
    .from("assessment_answer_files")
    .select("id, question_id, file_name, mime_type, size_bytes, created_at")
    .eq("id", id)
    .single();
  return { ok: true, data: row ?? undefined };
}

export async function removeAssessmentFile(fileId: string): Promise<ActionResult> {
  await requireCandidate();
  const { locale } = await getI18n();
  if (!z.string().uuid().safeParse(fileId).success) return { ok: false, error: localizeError(null, locale) };
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("remove_assessment_file", { p_file: fileId });
  if (error) return { ok: false, error: localizeError(error, locale) };
  if (path) await supabase.storage.from(BUCKET).remove([path]);
  return { ok: true };
}

/**
 * Short-lived download link (60 s). Works for the candidate, the assignment's company recruiters,
 * assigned interviewers and Super Admin — RLS on the row and on storage decides; nobody else gets a URL.
 */
export async function assessmentFileUrl(fileId: string): Promise<ActionResult<{ url: string }>> {
  await requireSession();
  const { locale } = await getI18n();
  if (!z.string().uuid().safeParse(fileId).success) return { ok: false, error: localizeError(null, locale) };
  const supabase = await createClient();
  const { data: f } = await supabase.from("assessment_answer_files").select("storage_path, file_name").eq("id", fileId).maybeSingle();
  if (!f) return { ok: false, error: localizeError({ message: "not authorized" }, locale) };
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 60, { download: f.file_name });
  if (error || !data) return { ok: false, error: localizeError({ message: "not authorized" }, locale) };
  return { ok: true, data: { url: data.signedUrl } };
}
