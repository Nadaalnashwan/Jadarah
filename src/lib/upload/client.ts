"use client";
import { publicEnv } from "@/lib/env";
import { getBrowserClient } from "@/lib/supabase/client";

export type UploadErrorCode = "denied" | "too_large" | "type" | "exists" | "network" | "aborted" | "session";

export class UploadError extends Error {
  constructor(public code: UploadErrorCode) {
    super(code);
  }
}

/**
 * Direct-to-storage upload with real progress events (XMLHttpRequest; fetch has no upload progress).
 * Runs under the signed-in user's token, so Storage RLS (migration 0029) decides whether the path
 * is allowed. Nothing is overwritten (x-upsert: false).
 */
export async function uploadWithProgress(opts: {
  bucket: string;
  path: string;
  file: File;
  contentType: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { data } = await getBrowserClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new UploadError("session");
  const url = `${publicEnv.supabaseUrl}/storage/v1/object/${opts.bucket}/${opts.path.split("/").map(encodeURIComponent).join("/")}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", publicEnv.supabaseKey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", opts.contentType);
    xhr.setRequestHeader("cache-control", "max-age=60");
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      const body = xhr.responseText || "";
      if (xhr.status === 413 || /maximum allowed size|too large/i.test(body)) return reject(new UploadError("too_large"));
      if (xhr.status === 415 || /mime type|invalid_mime/i.test(body)) return reject(new UploadError("type"));
      if (xhr.status === 409 || /already exists|Duplicate/i.test(body)) return reject(new UploadError("exists"));
      if (/mime type/i.test(body)) return reject(new UploadError("type"));
      return reject(new UploadError("denied"));
    };
    xhr.onerror = () => reject(new UploadError("network"));
    xhr.onabort = () => reject(new UploadError("aborted"));
    opts.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(opts.file);
  });
}

export function uploadErrorMessage(code: UploadErrorCode, locale: "ar" | "en"): string {
  const m: Record<UploadErrorCode, [string, string]> = {
    denied: ["This upload isn't allowed here", "لا يُسمح بهذا الرفع هنا"],
    too_large: ["The file is too large", "الملف كبير جدًا"],
    type: ["This file type isn't accepted", "نوع الملف غير مقبول"],
    exists: ["A file with this name is already uploaded", "رُفع ملف بهذا الاسم مسبقًا"],
    network: ["Upload interrupted. Check your connection and retry", "انقطع الرفع. تحقّق من اتصالك وأعد المحاولة"],
    aborted: ["Upload cancelled", "أُلغي الرفع"],
    session: ["Your session expired. Sign in again", "انتهت الجلسة. سجّل الدخول من جديد"],
  };
  return m[code][locale === "ar" ? 1 : 0];
}

export function randomPrefix(): string {
  const a = new Uint8Array(4);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
