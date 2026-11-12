import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasRecoverySession } from "@/lib/auth/recovery";

const now = () => Math.floor(Date.now() / 1000);
const client = (claims: Record<string, unknown> | null) =>
  ({
    auth: { getClaims: async () => ({ data: claims ? { claims } : null, error: null }) },
  }) as unknown as SupabaseClient;

describe("hasRecoverySession", () => {
  it("allows a session opened from a reset link within the hour", async () => {
    expect(
      await hasRecoverySession(client({ sub: "u1", amr: [{ method: "recovery", timestamp: now() - 120 }] })),
    ).toBe(true);
  });
  it("refuses a normal password or OTP sign-in", async () => {
    expect(
      await hasRecoverySession(client({ sub: "u1", amr: [{ method: "password", timestamp: now() }] })),
    ).toBe(false);
    expect(await hasRecoverySession(client({ sub: "u1", amr: [{ method: "otp", timestamp: now() }] }))).toBe(
      false,
    );
  });
  it("refuses a recovery older than one hour", async () => {
    expect(
      await hasRecoverySession(client({ sub: "u1", amr: [{ method: "recovery", timestamp: now() - 3700 }] })),
    ).toBe(false);
  });
  it("refuses when signed out or claims are malformed", async () => {
    expect(await hasRecoverySession(client(null))).toBe(false);
    expect(await hasRecoverySession(client({ sub: "u1" }))).toBe(false);
    expect(await hasRecoverySession(client({ sub: "u1", amr: "recovery" }))).toBe(false);
  });
});
