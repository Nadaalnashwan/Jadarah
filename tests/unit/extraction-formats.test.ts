import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractSubmittedFile, sniff } from "@/services/evaluation/extract";
import { buildZip } from "./helpers/zip-writer";

// Real files (generated with LibreOffice / Chromium). No AI is configured in unit tests, so AI transcription paths must
// report the file as unread — never as evaluated.
const fx = (n: string) => readFileSync(path.join(__dirname, "../fixtures/evaluation", n));
const meta = (name: string, mime: string, b: Buffer) => ({ id: name, file_name: name, mime_type: mime, size_bytes: b.length });

describe("extraction by format", () => {
  it("reads legacy Word 97–2003 (.doc) text", async () => {
    const b = fx("report.doc");
    const r = await extractSubmittedFile(meta("report.doc", "application/msword", b), b, "u");
    expect(r).toMatchObject({ method: "doc", status: "read" });
    expect(r.text).toContain("reorder point for SKU-118 is 340 units");
  });
  it("reports a password-protected PDF explicitly", async () => {
    const b = fx("protected.pdf");
    const r = await extractSubmittedFile(meta("protected.pdf", "application/pdf", b), b, "u");
    expect(r.status).toBe("failed");
    expect(r.note).toMatch(/password-protected/);
    expect(r.text).toBe("");
  });
  it("sends a scanned PDF (no text layer) to OCR and reports it unread when OCR is unavailable", async () => {
    const b = fx("scanned.pdf");
    const r = await extractSubmittedFile(meta("scanned.pdf", "application/pdf", b), b, "u");
    if (r.status === "read") expect(r.method).toBe("pdf_ocr_ai"); // only when an AI key is configured
    else expect(r.note).toMatch(/scanned PDF without a text layer/);
  });
  it("recognises a real JPEG and never evaluates it without transcription", async () => {
    const b = fx("photo.jpg");
    expect(sniff(b)).toBe("jpeg");
    const r = await extractSubmittedFile(meta("photo.jpg", "image/jpeg", b), b, "u");
    if (r.status === "read") expect(r.method).toBe("image_ai");
    else expect(r.text).toBe("");
  });
  it("reports empty, damaged and mislabelled files explicitly", async () => {
    const empty = Buffer.alloc(0);
    expect((await extractSubmittedFile(meta("e.pdf", "application/pdf", empty), empty, "u")).note).toBe("the file is empty");
    const broken = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(200, 0x20)]);
    expect((await extractSubmittedFile(meta("b.pdf", "application/pdf", broken), broken, "u")).note).toMatch(/damaged|could not be read|scanned/);
    const ole = fx("report.doc"); // an encrypted DOCX is an OLE container, not a ZIP package
    expect((await extractSubmittedFile(meta("x.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ole), ole, "u")).note).toMatch(/password-protected/);
    const notZip = Buffer.from("PK but not really a zip archive");
    expect((await extractSubmittedFile(meta("z.zip", "application/zip", notZip), notZip, "u")).status).toBe("failed");
  });
  it("reports password-protected entries inside a ZIP", async () => {
    const z = buildZip([{ name: "secret.ts", data: "x", encrypted: true }, { name: "ok.ts", data: "export const a = 1;" }]);
    const r = await extractSubmittedFile(meta("a.zip", "application/zip", z), z, "u");
    expect(r.status).toBe("partial");
    expect(r.note).toMatch(/password-protected/);
    expect(r.text).toContain("export const a = 1;");
  });
});
