"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCandidate } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AIUnavailableError, parseCvRuleBased, parseCvWithAI, type ParsedCv } from "@/services/ai/cv";

const CV_MIME = [
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
export async function registerCvUpload(input: z.infer<typeof registerSchema>): Promise<ActionResult<{ id: string }>> {
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
  const { data: inserted, error } = await supabase.from("candidate_documents").insert({
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
  }).select("id").single();
  if (error) {
    await supabase.storage.from("candidate-cvs").remove([parsed.data.path]);
    return { ok: false, error: localizeError(error, locale) };
  }
  revalidatePath("/candidate", "layout");
  return { ok: true, data: { id: inserted.id } };
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

// ------------------------------------------------------------------ full CV review (CV-first onboarding)
const str = (max: number) => z.string().trim().max(max);
const reviewSchema = z.object({
  full_name: str(120).optional().default(""),
  headline: str(160).optional().default(""),
  summary: str(2000).optional().default(""),
  experience: z
    .array(
      z.object({
        title: str(160).min(2),
        company: str(160).min(2),
        start: z.string().regex(/^\d{4}-\d{2}$/),
        end: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}$/)]).default(""),
        description: str(2000).optional().default(""),
      }),
    )
    .max(20)
    .default([]),
  education: z
    .array(z.object({ institution: str(160).min(2), degree: str(160).min(2), field: str(160).optional().default(""), end_year: z.union([z.literal(""), z.string().regex(/^\d{4}$/)]).default("") }))
    .max(10)
    .default([]),
  projects: z.array(z.object({ title: str(160).min(2), description: str(2000).optional().default("") })).max(15).default([]),
  certifications: z.array(str(200).min(2)).max(20).default([]),
  languages: z.array(str(60).min(2)).max(10).default([]),
  achievements: z.array(str(300).min(3)).max(15).default([]),
  skills: z
    .array(z.object({ name: str(80).min(1), evidence: str(500).nullable().optional(), kind: z.enum(["explicit", "inferred"]) }))
    .max(60)
    .default([]),
});
export type CvReviewInput = z.input<typeof reviewSchema>;

/**
 * Persist ONLY what the candidate approved in the review. Nothing is invented: every item comes from the CV
 * extraction and was kept/edited by the candidate. Existing entries are matched case-insensitively and skipped,
 * so applying the same CV twice never duplicates the profile. The original CV file and its versions are untouched.
 */
export async function applyCvReview(documentId: string, input: CvReviewInput): Promise<ActionResult<{ added: number }>> {
  const session = await requireCandidate();
  const { locale } = await getI18n();
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: locale === "ar" ? "راجع الحقول: التواريخ بصيغة سنة-شهر والأسماء مطلوبة." : "Check the fields: dates as YYYY-MM and names are required.",
    };
  const v = parsed.data;
  const uid = session.userId;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("candidate_documents").select("id").eq("id", documentId).eq("candidate_id", uid).maybeSingle();
  if (!doc) return { ok: false, error: localizeError({ code: "42501" }, locale) };
  const key = (...p: (string | null | undefined)[]) => p.map((x) => (x ?? "").trim().toLowerCase()).join("|");
  let added = 0;

  // profile basics — only fill what the candidate kept; never overwrite with empty values
  if (v.full_name) await supabase.from("profiles").update({ full_name: v.full_name }).eq("id", uid);
  const { data: cp } = await supabase.from("candidate_profiles").select("languages, achievements").eq("user_id", uid).maybeSingle();
  const langs = (Array.isArray(cp?.languages) ? cp!.languages : []) as { name: string; level?: string }[];
  const haveLang = new Set(langs.map((l) => key(l.name)));
  const newLangs = v.languages.filter((l) => !haveLang.has(key(l))).map((name) => ({ name, level: "unspecified" }));
  const haveAch = new Set((cp?.achievements ?? []).map((a) => key(a)));
  const newAch = v.achievements.filter((a) => !haveAch.has(key(a)));
  const profilePatch: Record<string, unknown> = { user_id: uid };
  if (v.headline) profilePatch.headline = v.headline;
  if (v.summary) profilePatch.summary = v.summary;
  if (newLangs.length) profilePatch.languages = [...langs, ...newLangs];
  if (newAch.length) profilePatch.achievements = [...(cp?.achievements ?? []), ...newAch];
  if (Object.keys(profilePatch).length > 1) {
    const { error } = await supabase.from("candidate_profiles").upsert(profilePatch as never, { onConflict: "user_id" });
    if (error) return { ok: false, error: localizeError(error, locale) };
  }

  const [{ data: ex }, { data: ed }, { data: pr }, { data: ce }] = await Promise.all([
    supabase.from("candidate_experience").select("title, company, start_date").eq("candidate_id", uid),
    supabase.from("candidate_education").select("institution, degree").eq("candidate_id", uid),
    supabase.from("candidate_projects").select("title").eq("candidate_id", uid),
    supabase.from("candidate_certifications").select("name").eq("candidate_id", uid),
  ]);
  const exKeys = new Set((ex ?? []).map((r) => key(r.title, r.company, r.start_date?.slice(0, 7))));
  const exRows = v.experience
    .filter((r) => !exKeys.has(key(r.title, r.company, r.start)))
    .map((r) => ({
      candidate_id: uid,
      title: r.title,
      company: r.company,
      start_date: `${r.start}-01`,
      end_date: r.end ? `${r.end}-01` : null,
      is_current: !r.end,
      description: r.description || null,
    }));
  const edKeys = new Set((ed ?? []).map((r) => key(r.institution, r.degree)));
  const edRows = v.education
    .filter((r) => !edKeys.has(key(r.institution, r.degree)))
    .map((r) => ({ candidate_id: uid, institution: r.institution, degree: r.degree, field: r.field || null, end_date: r.end_year ? `${r.end_year}-06-30` : null }));
  const prKeys = new Set((pr ?? []).map((r) => key(r.title)));
  const prRows = v.projects.filter((r) => !prKeys.has(key(r.title))).map((r) => ({ candidate_id: uid, title: r.title, description: r.description || null }));
  const ceKeys = new Set((ce ?? []).map((r) => key(r.name)));
  const ceRows = v.certifications.filter((n) => !ceKeys.has(key(n))).map((name) => ({ candidate_id: uid, name }));
  for (const [table, rows] of [
    ["candidate_experience", exRows],
    ["candidate_education", edRows],
    ["candidate_projects", prRows],
    ["candidate_certifications", ceRows],
  ] as const) {
    if (!rows.length) continue;
    const { error } = await supabase.from(table).insert(rows as never);
    if (error) return { ok: false, error: localizeError(error, locale) };
    added += rows.length;
  }

  // skills: explicit → source "cv" (extracted); inferred and approved → source "self" (candidate-confirmed, not verified)
  const { data: taxonomy } = await supabase.from("skills").select("id, name_en, aliases");
  const byName = new Map<string, string>();
  (taxonomy ?? []).forEach((s) => [s.name_en, ...s.aliases].forEach((n) => byName.set(n.toLowerCase(), s.id)));
  const { data: haveSkills } = await supabase.from("candidate_skills").select("skill_id").eq("candidate_id", uid);
  const have = new Set((haveSkills ?? []).map((r) => r.skill_id));
  const skillRows = v.skills
    .map((s) => ({ id: byName.get(s.name.toLowerCase()), ...s }))
    .filter((s): s is typeof s & { id: string } => !!s.id && !have.has(s.id))
    .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i)
    .map((s) => ({
      candidate_id: uid,
      skill_id: s.id,
      level: 3,
      source: s.kind === "explicit" ? "cv" : "self",
      evidence: (s.kind === "explicit" ? s.evidence || "Extracted from CV" : "Inferred from CV and confirmed by the candidate").slice(0, 500),
    }));
  if (skillRows.length) {
    const { error } = await supabase.from("candidate_skills").insert(skillRows);
    if (error) return { ok: false, error: localizeError(error, locale) };
    added += skillRows.length;
  }
  await supabase.from("candidate_documents").update({ parse_status: "reviewed" }).eq("id", documentId);
  revalidatePath("/candidate", "layout");
  return {
    ok: true,
    data: { added },
    message: locale === "ar" ? `حُفظت المعلومات المعتمدة (${added} عنصرًا جديدًا).` : `Approved information saved (${added} new items).`,
  };
}
