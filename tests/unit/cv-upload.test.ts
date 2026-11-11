import { describe, expect, it } from "vitest";
import { CV_ACCEPT, MAX_CV_BYTES, resolveCvType, safeCvObjectName, sniffCvBytes } from "@/lib/domain/cv-file";
import { groundCv, isEmptyExtraction, normalizeForMatch } from "@/lib/domain/cv-grounding";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const bytes = (...b: number[]) => new Uint8Array(b);

describe("CV file type resolution", () => {
  it("accepts PDF and DOCX by declared type", () => {
    expect(resolveCvType("cv.pdf", "application/pdf")).toEqual({ kind: "pdf", mime: "application/pdf" });
    expect(resolveCvType("CV.DOCX", DOCX)).toEqual({ kind: "docx", mime: DOCX });
  });
  it("falls back to the extension when the browser reports an empty or generic type", () => {
    expect(resolveCvType("Nada CV.docx", "")).toEqual({ kind: "docx", mime: DOCX });
    expect(resolveCvType("cv.pdf", "application/octet-stream")).toEqual({ kind: "pdf", mime: "application/pdf" });
    expect(resolveCvType("cv.docx", "application/zip")).toEqual({ kind: "docx", mime: DOCX });
  });
  it("rejects other files and conflicting types", () => {
    expect(resolveCvType("photo.png", "image/png")).toBeNull();
    expect(resolveCvType("cv.pdf", "image/png")).toBeNull();
    expect(resolveCvType("cv.txt", "")).toBeNull();
    expect(resolveCvType("cv.docx", "application/pdf")).toBeNull();
  });
  it("offers the right files in every picker and caps size at 10 MB", () => {
    expect(CV_ACCEPT).toContain(".pdf");
    expect(CV_ACCEPT).toContain(".docx");
    expect(MAX_CV_BYTES).toBe(10 * 1024 * 1024);
  });
  it("checks the real bytes", () => {
    expect(sniffCvBytes(new TextEncoder().encode("%PDF-1.7\n..."))).toBe("pdf");
    expect(sniffCvBytes(bytes(0x50, 0x4b, 0x03, 0x04, 0x14))).toBe("docx");
    expect(sniffCvBytes(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1))).toBe("doc");
    expect(sniffCvBytes(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull(); // PNG renamed to .pdf
    expect(sniffCvBytes(new Uint8Array())).toBeNull();
  });
  it("builds storage-safe object names that keep the extension", () => {
    expect(safeCvObjectName("سيرتي الذاتية (2026).PDF", "pdf")).toMatch(/^[\w.-]+\.pdf$/);
    expect(safeCvObjectName("../../etc/passwd.docx", "docx")).not.toContain("/");
  });
});

describe("CV grounding — never present information the CV does not contain", () => {
  const text = `Nada Al-Nashwan
  Data Analyst at Elm Company (2021-03 – present). Built dashboards with Power BI and SQL.
  B.Sc. Information Systems, King Saud University, 2020. Languages: العربية، English.
  Certified: Google Data Analytics Professional Certificate.`;
  const parsed = {
    full_name: "Nada Al-Nashwan",
    headline: "Data Analyst",
    summary: null,
    experience: [
      { title: "Data Analyst", company: "Elm Company" },
      { title: "Senior Engineer", company: "Aramco" }, // not in the CV
    ],
    education: [{ institution: "King Saud University", degree: "B.Sc." }],
    projects: [],
    certifications: ["Google Data Analytics Professional Certificate", "PMP"],
    languages: ["Arabic", "English", "French"],
    skills: [
      { name: "SQL", evidence: "Built dashboards with Power BI and SQL", kind: "explicit" as const },
      { name: "Python", evidence: "Automated reports in Python", kind: "explicit" as const }, // fabricated quote
      { name: "Data visualization", evidence: null, kind: "inferred" as const },
    ],
  };

  it("flags items that are not in the CV and keeps the ones that are", () => {
    const { grounding } = groundCv(parsed, text);
    expect(grounding.checked).toBe(true);
    expect(grounding.full_name).toBe(true);
    expect(grounding.experience).toEqual([true, false]);
    expect(grounding.education).toEqual([true]);
    expect(grounding.certifications).toEqual([true, false]);
    expect(grounding.languages).toEqual([true, true, false]); // «العربية» counts for Arabic
  });
  it("drops quotes that do not occur in the CV and downgrades unsupported stated skills", () => {
    const { parsed: out, grounding } = groundCv(parsed, text);
    expect(out.skills[0]).toMatchObject({ name: "SQL", kind: "explicit", evidence: "Built dashboards with Power BI and SQL" });
    expect(out.skills[1]).toMatchObject({ name: "Python", kind: "inferred", evidence: null });
    expect(grounding.skills).toEqual([true, false, false]);
  });
  it("accepts fixed-width snippets that start or end mid-word, but not invented quotes", () => {
    const out = groundCv(
      { ...parsed, skills: [
        { name: "SQL", evidence: "ashboards with Power BI and SQL", kind: "explicit" as const },
        { name: "SQL", evidence: "dashboards with Tableau and SQL", kind: "explicit" as const },
      ] },
      text,
    ).parsed.skills;
    expect(out[0].evidence).toBe("ashboards with Power BI and SQL");
    expect(out[1].evidence).toBeNull();
  });
  it("marks everything unchecked when the file has no text layer (scanned PDF)", () => {
    const { grounding } = groundCv(parsed, "");
    expect(grounding.checked).toBe(false);
    expect(grounding.experience).toEqual([false, false]);
  });
  it("normalises Arabic spelling variants for matching", () => {
    expect(normalizeForMatch("جامعة الملك سعود")).toBe(normalizeForMatch("جامعه الملك سعود"));
    expect(normalizeForMatch("إدارة")).toBe(normalizeForMatch("ادارة"));
  });
  it("detects an empty extraction so the candidate can continue manually", () => {
    expect(isEmptyExtraction({ ...parsed, full_name: null, headline: null, experience: [], education: [], certifications: [], languages: [], skills: [] })).toBe(true);
    expect(isEmptyExtraction(parsed)).toBe(false);
  });
});
