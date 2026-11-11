/**
 * CV file rules shared by the browser uploader and the server actions.
 * Browsers (notably on Windows and some mobile pickers) often report an empty or generic MIME type for
 * .docx/.pdf files, so the type is resolved from the extension AND the declared type, and the server
 * re-checks the real bytes after upload.
 */
export const MAX_CV_BYTES = 10 * 1024 * 1024;

export const CV_TYPES = {
  pdf: { mime: "application/pdf", ext: ".pdf" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: ".docx" },
  /** Legacy Word: stored and downloadable, but text extraction is not supported (manual completion). */
  doc: { mime: "application/msword", ext: ".doc" },
} as const;

export type CvKind = keyof typeof CV_TYPES;
export const CV_MIME_TYPES = Object.values(CV_TYPES).map((t) => t.mime);
/** Value for <input accept>: extensions first so every OS file picker offers the right files. */
export const CV_ACCEPT = [".pdf", ".docx", ".doc", ...CV_MIME_TYPES].join(",");

const GENERIC_MIME = new Set(["", "application/octet-stream", "binary/octet-stream", "application/zip", "application/x-zip-compressed"]);

/**
 * Resolve the CV type from a file name and the type the browser declared. Returns null when the file is not a
 * PDF/Word document. A specific, conflicting declared type (e.g. image/png named cv.pdf) is rejected.
 */
export function resolveCvType(fileName: string, declaredMime: string | null | undefined): { kind: CvKind; mime: string } | null {
  const name = fileName.trim().toLowerCase();
  const mime = (declaredMime ?? "").trim().toLowerCase();
  const byExt = (Object.keys(CV_TYPES) as CvKind[]).find((k) => name.endsWith(CV_TYPES[k].ext));
  const byMime = (Object.keys(CV_TYPES) as CvKind[]).find((k) => CV_TYPES[k].mime === mime);
  if (byMime && (!byExt || byExt === byMime)) return { kind: byMime, mime: CV_TYPES[byMime].mime };
  if (byExt && GENERIC_MIME.has(mime)) return { kind: byExt, mime: CV_TYPES[byExt].mime };
  return null;
}

/** File signature check: PDF starts with %PDF-, DOCX is a ZIP container (PK\x03\x04), DOC is an OLE container. */
export function sniffCvBytes(head: Uint8Array): CvKind | null {
  const b = (i: number) => head[i] ?? -1;
  // "%PDF-" may be preceded by a few bytes of junk in some generators; scan the first 1 KB.
  const limit = Math.min(head.length - 4, 1024);
  for (let i = 0; i < limit; i++) {
    if (b(i) === 0x25 && b(i + 1) === 0x50 && b(i + 2) === 0x44 && b(i + 3) === 0x46 && b(i + 4) === 0x2d) return "pdf";
  }
  if (b(0) === 0x50 && b(1) === 0x4b && b(2) === 0x03 && b(3) === 0x04) return "docx";
  if (b(0) === 0xd0 && b(1) === 0xcf && b(2) === 0x11 && b(3) === 0xe0) return "doc";
  return null;
}

/** Storage-safe object name: keeps the extension, drops anything outside [A-Za-z0-9._-]. */
export function safeCvObjectName(fileName: string, kind: CvKind): string {
  const base = fileName.replace(/\.[^.]*$/, "").replace(/[^\w.-]+/g, "_").replace(/^[._]+/, "").slice(-60) || "cv";
  return `${base}${CV_TYPES[kind].ext}`;
}
