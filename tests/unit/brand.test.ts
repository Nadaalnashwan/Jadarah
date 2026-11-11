import { describe, expect, it } from "vitest";
import { brandVars, contrastRatio, identityImageUrl, readableOn, sanitizeHex, tint } from "@/lib/brand";

describe("company identity colours", () => {
  it("accepts only #RRGGBB and normalises case", () => {
    expect(sanitizeHex("#3b6cff")).toBe("#3B6CFF");
    expect(sanitizeHex(" #0D1B3F ")).toBe("#0D1B3F");
    for (const bad of ["red", "#fff", "#12345G", "url(x)", "#3B6CFF;color:red", null, 42]) expect(sanitizeHex(bad)).toBeNull();
  });
  it("computes WCAG contrast", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 0);
    expect(contrastRatio("#0D1B3F", "#FFFFFF")).toBeGreaterThan(15);
  });
  it("picks a readable foreground", () => {
    expect(readableOn("#0D1B3F")).toBe("#FFFFFF");
    expect(readableOn("#F8F6F0")).toBe("#0C1927");
    expect(readableOn("#FFD400")).toBe("#0C1927");
    for (const c of ["#0D1B3F", "#A9B8FF", "#CDE7F6", "#FFD400", "#00A651"])
      expect(contrastRatio(c, readableOn(c))).toBeGreaterThanOrEqual(4.5);
    // The approved Professional Blue #3B66F6 with white text is 4.75:1 — AA for bold/large UI text (buttons use semibold ≥ 14px).
    expect(contrastRatio("#3B66F6", readableOn("#3B66F6"))).toBeGreaterThanOrEqual(4.5);
  });
  it("falls back to the JADARAH palette and never emits unsanitised values", () => {
    const v = brandVars(null);
    expect(v["--brand"]).toBe("#172F49");
    expect(v["--brand-2"]).toBe("#3B66F6");
    const w = brandVars({ primary_hex: "javascript:alert(1)", secondary_hex: "#00a651", accent_hex: null });
    expect(w["--brand"]).toBe("#172F49");
    expect(w["--brand-2"]).toBe("#00A651");
    expect(tint("#000000", 0.5)).toBe("#808080");
  });
  it("builds identity image URLs only for safe company-scoped paths", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(identityImageUrl("0b8c2f6e-1111-2222-3333-444455556666/logo-ab12cd34.png")).toBe(
      "https://example.supabase.co/storage/v1/object/public/company-identity/0b8c2f6e-1111-2222-3333-444455556666/logo-ab12cd34.png",
    );
    expect(identityImageUrl("../secret.png")).toBeNull();
    expect(identityImageUrl("abc/logo.png")).toBeNull();
    expect(identityImageUrl(null)).toBeNull();
  });
});
