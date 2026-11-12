import { describe, expect, it } from "vitest";
import { ASSESSMENT_FILE_RULES, TASK_SOLUTION_RULES, checkFile, resolveMime, safeObjectName } from "@/lib/upload/rules";

const MB = 1024 * 1024;
const f = (name: string, type: string, size = 1000) => ({ name, type, size });

describe("Task Solution Files — validation (mirrors migration 0032)", () => {
  it("accepts PDF, DOC, DOCX, ZIP, JPG/JPEG and PNG", () => {
    for (const file of [
      f("report.pdf", "application/pdf"),
      f("old.doc", "application/msword"),
      f("notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      f("code.zip", "application/zip"),
      f("photo.jpg", "image/jpeg"),
      f("photo.jpeg", "image/jpeg"),
      f("diagram.png", "image/png"),
    ])
      expect(checkFile(file, TASK_SOLUTION_RULES)).toBeNull();
  });
  it("normalises the ZIP types Windows browsers report to application/zip", () => {
    expect(resolveMime(f("code.zip", "application/x-zip-compressed"), TASK_SOLUTION_RULES)).toBe("application/zip");
    expect(resolveMime(f("code.zip", "application/zip-compressed"), TASK_SOLUTION_RULES)).toBe("application/zip");
  });
  it("infers the type from the extension when the browser reports none", () => {
    expect(resolveMime(f("old.doc", ""), TASK_SOLUTION_RULES)).toBe("application/msword");
    expect(resolveMime(f("code.zip", "application/octet-stream"), TASK_SOLUTION_RULES)).toBe("application/zip");
  });
  it("rejects executables, mismatched extensions, empty and oversized files", () => {
    expect(checkFile(f("tool.exe", "application/x-msdownload"), TASK_SOLUTION_RULES)).toBe("type");
    expect(checkFile(f("report.exe", "application/pdf"), TASK_SOLUTION_RULES)).toBe("type");
    expect(checkFile(f("empty.pdf", "application/pdf", 0), TASK_SOLUTION_RULES)).toBe("empty");
    expect(checkFile(f("big.pdf", "application/pdf", 21 * MB), TASK_SOLUTION_RULES)).toBe("too_large");
  });
  it("allows up to 10 solution files (5 per question for question answers)", () => {
    expect(TASK_SOLUTION_RULES.maxFiles).toBe(10);
    expect(checkFile(f("a.pdf", "application/pdf"), TASK_SOLUTION_RULES, 9)).toBeNull();
    expect(checkFile(f("a.pdf", "application/pdf"), TASK_SOLUTION_RULES, 10)).toBe("too_many");
    expect(ASSESSMENT_FILE_RULES.maxFiles).toBe(5);
  });
  it("builds storage-safe object names that match the database path rule", () => {
    const name = safeObjectName("حل المهمة النهائي (v2).docx");
    expect(name).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/);
    expect(name.endsWith(".docx")).toBe(true);
  });
});
