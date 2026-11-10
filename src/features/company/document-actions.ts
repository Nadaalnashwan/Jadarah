"use server";
import { requireCompanyMember } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/** Short-lived signed URL for an applicant's CV. Storage RLS re-checks that this company may read it. */
export async function getApplicationCvUrl(applicationId: string): Promise<ActionResult<{ url: string }>> {
  await requireCompanyMember();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const { data: app } = await supabase
    .from("applications")
    .select("cv:candidate_documents(bucket, storage_path, file_name)")
    .eq("id", applicationId)
    .single();
  const cv = app?.cv;
  if (!cv) return { ok: false, error: localizeError({ code: "42501" }, locale) };
  const { data, error } = await supabase.storage.from(cv.bucket).createSignedUrl(cv.storage_path, 60);
  if (error || !data) return { ok: false, error: localizeError(error, locale) };
  return { ok: true, data: { url: data.signedUrl } };
}
