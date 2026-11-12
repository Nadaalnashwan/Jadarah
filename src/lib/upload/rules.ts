/**
 * File rules shared by the browser (instant feedback) and the server (authoritative, with the
 * database re-checking against storage metadata). Keep in sync with migration 0029.
 */
export interface FileRules {
  maxBytes: number;
  maxFiles: number;
  mimes: Record<string, string[]>; // mime → allowed extensions
}

export const ASSESSMENT_FILE_RULES: FileRules = {
  maxBytes: 20 * 1024 * 1024,
  maxFiles: 5,
  mimes: {
    "application/pdf": ["pdf"],
    "image/png": ["png"],
    "image/jpeg": ["jpg", "jpeg"],
    "image/webp": ["webp"],
    "application/zip": ["zip"],
    "text/plain": ["txt", "md"],
    "text/csv": ["csv"],
    "application/vnd.ms-excel": ["csv", "xls"],
    "application/json": ["json"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
    "application/msword": ["doc"],
  },
};

/** Task Solution Files (migration 0032): same types and size as answers, up to 10 files per submission. */
export const TASK_SOLUTION_RULES: FileRules = { ...ASSESSMENT_FILE_RULES, maxFiles: 10 };

/** Windows browsers report ZIP archives under legacy types; storage only accepts application/zip. */
const MIME_ALIASES: Record<string, string> = {
  "application/x-zip-compressed": "application/zip",
  "application/zip-compressed": "application/zip",
  "application/x-zip": "application/zip",
};

export const INTERVIEW_FILE_RULES: FileRules = {
  maxBytes: 10 * 1024 * 1024,
  maxFiles: 20,
  mimes: {
    "application/pdf": ["pdf"],
    "image/png": ["png"],
    "image/jpeg": ["jpg", "jpeg"],
    "image/webp": ["webp"],
    "text/plain": ["txt"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
  },
};

/** Browsers sometimes report an empty type (e.g. .md, .csv on Windows): infer from the extension. */
export function resolveMime(file: { name: string; type: string }, rules: FileRules): string | null {
  const ext = extensionOf(file.name);
  const type = MIME_ALIASES[file.type] ?? file.type;
  if (type && rules.mimes[type]?.includes(ext)) return type;
  if (!file.type || file.type === "application/octet-stream")
    for (const [mime, exts] of Object.entries(rules.mimes)) if (exts.includes(ext)) return mime;
  return null;
}

export function extensionOf(name: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name);
  return m ? m[1].toLowerCase() : "";
}

export type FileProblem = "too_large" | "empty" | "type" | "too_many";

export function checkFile(file: { name: string; type: string; size: number }, rules: FileRules, existing = 0): FileProblem | null {
  if (existing >= rules.maxFiles) return "too_many";
  if (file.size <= 0) return "empty";
  if (file.size > rules.maxBytes) return "too_large";
  if (!resolveMime(file, rules)) return "type";
  return null;
}

/** Object-key-safe name: ASCII letters/digits/._- only, keeps the extension, ≤ 100 chars. */
export function safeObjectName(name: string): string {
  const ext = extensionOf(name);
  const base = name
    .replace(/\.[A-Za-z0-9]{1,8}$/, "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 80);
  return `${base || "file"}${ext ? "." + ext : ""}`;
}

export function acceptAttribute(rules: FileRules): string {
  return [...new Set(Object.values(rules.mimes).flat())].map((e) => "." + e).join(",");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function problemMessage(p: FileProblem, rules: FileRules, locale: "ar" | "en"): string {
  const mb = Math.round(rules.maxBytes / 1024 / 1024);
  const types = [...new Set(Object.values(rules.mimes).flat())].map((e) => e.toUpperCase()).join(", ");
  const m: Record<FileProblem, [string, string]> = {
    too_large: [`The file is larger than ${mb} MB.`, `حجم الملف أكبر من ${mb} ميغابايت`],
    empty: ["The file is empty", "الملف فارغ"],
    type: [`This file type isn't accepted. Allowed: ${types}`, `نوع الملف غير مقبول. الأنواع المسموح بها: ${types}`],
    too_many: [`You can attach up to ${rules.maxFiles} files.`, `يمكنك إرفاق ${rules.maxFiles} ملفات كحد أقصى`],
  };
  return m[p][locale === "ar" ? 1 : 0];
}
