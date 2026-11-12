import { inflateRawSync } from "node:zlib";

/**
 * Minimal, defensive ZIP reader for evaluating candidate submissions. Everything happens in memory — nothing is ever
 * written to disk, so archive paths cannot escape anywhere — and every entry is treated as untrusted:
 *  - unsafe names (absolute paths, `..` segments, drive letters, NUL) are refused, never "normalised" into place
 *  - symbolic links, encrypted entries, nested archives and unknown compression methods are listed but not read
 *  - per-entry and total uncompressed limits plus a compression-ratio check stop ZIP bombs (inflate is capped too)
 *  - ZIP64 archives are reported as unsupported rather than half-read
 */

export type ZipEntryStatus =
  | "read"
  | "directory"
  | "skipped_unsafe_name"
  | "skipped_symlink"
  | "skipped_encrypted"
  | "skipped_method"
  | "skipped_too_large"
  | "skipped_ratio"
  | "skipped_limit"
  | "skipped_type"
  | "failed";

export interface ZipEntry {
  name: string;
  size: number;
  compressedSize: number;
  status: ZipEntryStatus;
  /** Present only when status = "read". */
  data?: Buffer;
}

export interface ZipLimits {
  maxEntries: number;
  maxRead: number;
  maxEntryBytes: number;
  maxTotalBytes: number;
  maxRatio: number;
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxEntries: 500,
  maxRead: 60,
  maxEntryBytes: 2 * 1024 * 1024,
  maxTotalBytes: 12 * 1024 * 1024,
  maxRatio: 200,
};

export class ZipError extends Error {
  constructor(public code: "not_zip" | "zip64_unsupported" | "corrupt" | "too_many_entries") {
    super(code);
  }
}

const EOCD = 0x06054b50;
const CEN = 0x02014b50;
const LOC = 0x04034b50;

/** Archive names that would be unsafe to honour (they are refused, never rewritten). */
export function isUnsafeZipName(name: string): boolean {
  if (!name || name.includes("\0")) return true;
  const n = name.replace(/\\/g, "/");
  if (n.startsWith("/") || /^[A-Za-z]:/.test(n)) return true;
  return n.split("/").some((seg) => seg === "..");
}

/**
 * List an archive and read the entries `want(name)` accepts, within the limits.
 * Directory entries and refused entries are listed with their status so the reviewer sees the whole archive.
 */
export function readZip(buf: Buffer, want: (name: string) => boolean, limits: ZipLimits = DEFAULT_ZIP_LIMITS): ZipEntry[] {
  if (buf.length < 22) throw new ZipError("not_zip");
  // End of central directory: last 22 bytes + up to 64 KB of comment.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError("not_zip");
  const total = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new ZipError("zip64_unsupported");
  if (cdOffset + cdSize > buf.length) throw new ZipError("corrupt");
  if (total > limits.maxEntries) throw new ZipError("too_many_entries");

  const out: ZipEntry[] = [];
  let p = cdOffset;
  let readCount = 0;
  let readBytes = 0;
  for (let i = 0; i < total; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CEN) throw new ZipError("corrupt");
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const externalAttrs = buf.readUInt32LE(p + 38);
    const localOffset = buf.readUInt32LE(p + 42);
    const rawName = buf.subarray(p + 46, p + 46 + nameLen);
    const name = (flags & 0x800 ? rawName.toString("utf8") : rawName.toString("latin1")).slice(0, 300);
    p += 46 + nameLen + extraLen + commentLen;

    const entry: ZipEntry = { name, size, compressedSize, status: "read" };
    const unixMode = externalAttrs >>> 16;
    if (isUnsafeZipName(name)) entry.status = "skipped_unsafe_name";
    else if (name.endsWith("/") || name.endsWith("\\")) entry.status = "directory";
    else if ((unixMode & 0o170000) === 0o120000) entry.status = "skipped_symlink";
    else if (flags & 0x1) entry.status = "skipped_encrypted";
    else if (method !== 0 && method !== 8) entry.status = "skipped_method";
    else if (!want(name)) entry.status = "skipped_type";
    else if (size > limits.maxEntryBytes) entry.status = "skipped_too_large";
    else if (compressedSize > 0 && size / compressedSize > limits.maxRatio) entry.status = "skipped_ratio";
    else if (readCount >= limits.maxRead || readBytes + size > limits.maxTotalBytes) entry.status = "skipped_limit";

    if (entry.status === "read") {
      try {
        if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== LOC) throw new Error("bad local header");
        const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
        const comp = buf.subarray(start, start + compressedSize);
        if (comp.length !== compressedSize) throw new Error("truncated");
        // Never trust the declared size alone: inflate is capped at the per-entry limit.
        const data = method === 0 ? Buffer.from(comp) : inflateRawSync(comp, { maxOutputLength: limits.maxEntryBytes });
        if (data.length !== size) throw new Error("size mismatch");
        entry.data = data;
        readCount++;
        readBytes += data.length;
      } catch {
        entry.status = "failed";
      }
    }
    out.push(entry);
  }
  return out;
}
