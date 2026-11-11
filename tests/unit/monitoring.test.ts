import { describe, expect, it } from "vitest";
import {
  correlate,
  errorCategory,
  fallbackSummary,
  percentile,
  summarize,
  timeSeries,
  type AiLogRow,
} from "@/lib/monitoring/ai-metrics";
import { evaluateAlerts } from "@/lib/monitoring/alerts";
import { dayKeyOf, dayKeys, monitoringHref, parsePeriod, tabOf } from "@/lib/monitoring/period";

const T0 = Date.parse("2026-11-10T12:00:00Z");
const row = (o: Partial<AiLogRow> & { at?: number }): AiLogRow => ({
  provider: "gemini",
  model: "flash",
  operation: "cv_parse",
  user_id: "u1",
  latency_ms: 100,
  input_tokens: null,
  output_tokens: null,
  success: true,
  error_code: null,
  created_at: new Date(o.at ?? T0).toISOString(),
  ...o,
});

describe("percentile (nearest rank)", () => {
  it("handles empty, single and known samples", () => {
    expect(percentile([], 50)).toBeNull();
    expect(percentile([7], 95)).toBe(7);
    const xs = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(xs, 50)).toBe(50);
    expect(percentile(xs, 95)).toBe(95);
    expect(percentile(xs, 99)).toBe(99);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
  });
});

describe("summarize", () => {
  it("counts attempts, rates, tokens only where reported, and p99 only with ≥100 samples", () => {
    const rows = [
      row({ latency_ms: 100, input_tokens: 10, output_tokens: 5 }),
      row({ latency_ms: 300, success: false, error_code: "gemini_quota_exhausted" }),
      row({
        latency_ms: null,
        provider: "groq",
        model: "llama",
        success: false,
        error_code: "groq_rate_limited",
      }),
      row({ latency_ms: 200, input_tokens: 0, output_tokens: 7 }),
    ];
    const s = summarize(rows);
    expect(s.attempts).toBe(4);
    expect(s.success).toBe(2);
    expect(s.successRate).toBe(0.5);
    expect(s.latency.samples).toBe(3);
    expect(s.latency.avg).toBe(200);
    expect(s.latency.p50).toBe(200);
    expect(s.latency.p99).toBeNull();
    expect(s.tokens).toEqual({ input: 10, output: 12, total: 22, samples: 2 });
    expect(s.byProvider.map((p) => [p.key, p.attempts])).toEqual([
      ["gemini", 3],
      ["groq", 1],
    ]);
    expect(Object.fromEntries(s.errors.map((e) => [e.key, e.count]))).toEqual({ quota: 1, rate_limit: 1 });
    expect(summarize([]).successRate).toBeNull();
    expect(summarize(Array.from({ length: 100 }, (_, i) => row({ latency_ms: i }))).latency.p99).toBe(98);
  });
});

describe("errorCategory", () => {
  it("maps the provider codes seen in production", () => {
    expect(errorCategory("gemini_quota_exhausted")).toBe("quota");
    expect(errorCategory("openai_quota_exhausted")).toBe("quota");
    expect(errorCategory("groq_rate_limited")).toBe("rate_limit");
    expect(errorCategory("gemini_timeout")).toBe("timeout");
    expect(errorCategory("gemini_overloaded")).toBe("availability");
    expect(errorCategory("schema_mismatch")).toBe("schema");
    expect(errorCategory("gemini_http_400")).toBe("request");
    expect(errorCategory(null)).toBe("other");
  });
});

describe("timeSeries", () => {
  it("keeps empty buckets as zeros and buckets by hour", () => {
    const from = new Date(T0 - 3 * 3_600_000);
    const s = timeSeries(
      [row({ at: T0 - 3_600_000 + 60_000 }), row({ at: T0 - 3_600_000 + 120_000, success: false })],
      from,
      new Date(T0),
      "hour",
    );
    expect(s).toHaveLength(3);
    expect(s.map((p) => p.attempts)).toEqual([0, 0, 2]);
    expect(s[2].failed).toBe(1);
    expect(s[0].p50).toBeNull();
  });
});

describe("correlate / fallbackSummary", () => {
  it("groups exactly by request id, separates retry from fallback and complete failure", () => {
    const rows = [
      // request A: primary fails, fallback model succeeds
      row({ request_id: "a", attempt: 1, success: false, error_code: "gemini_quota_exhausted" }),
      row({ request_id: "a", attempt: 2, provider: "groq", model: "llama", is_fallback: true }),
      // request B: first try ok
      row({ request_id: "b", attempt: 1 }),
      // request C: everything fails
      row({ request_id: "c", attempt: 1, success: false }),
      row({ request_id: "c", attempt: 2, success: false, is_fallback: true }),
    ];
    const f = fallbackSummary(correlate(rows));
    expect(f).toMatchObject({
      operations: 3,
      firstTry: 1,
      primaryFailures: 2,
      recoveredFallback: 1,
      recoveredRetry: 0,
      failed: 1,
      exactShare: 1,
    });
  });

  it("uses a time window for legacy rows and never treats unrelated failures as fallbacks", () => {
    const rows = [
      row({ success: false, at: T0 }),
      row({ at: T0 + 30_000 }), // same user+operation within 2 min → retry recovery (same model)
      row({ success: false, at: T0 + 600_000 }), // later, isolated failure
      row({ user_id: "u2", at: T0 + 10_000 }), // another user, separate operation
    ];
    const f = fallbackSummary(correlate(rows));
    expect(f).toMatchObject({ operations: 3, firstTry: 1, recoveredRetry: 1, failed: 1, exactShare: 0 });
  });
});

describe("alerts", () => {
  const now = new Date(T0);
  it("requires minimum samples before raising", () => {
    const few = Array.from({ length: 5 }, () => row({ success: false, error_code: "x" }));
    expect(
      evaluateAlerts({
        now,
        aiRows: few,
        builder: { generated: 1, failed: 1 },
        telemetry: { failures: 0, lastFailureAt: null },
      }),
    ).toEqual([]);
  });

  it("raises quota, error-rate, builder and telemetry alerts above thresholds", () => {
    const rows = [
      ...Array.from({ length: 3 }, () => row({ success: false, error_code: "gemini_quota_exhausted" })),
      ...Array.from({ length: 17 }, (_, i) => row({ success: i > 8 })),
    ];
    const keys = evaluateAlerts({
      now,
      aiRows: rows,
      builder: { generated: 1, failed: 2 },
      telemetry: { failures: 2, lastFailureAt: T0 },
    }).map((a) => a.key);
    expect(keys).toEqual([
      "ai.quota.gemini",
      "ai.error_rate",
      "builder.failures",
      "monitoring.telemetry_write",
    ]);
  });

  it("detects sustained p95 latency degradation against the 7-day baseline", () => {
    const base = Array.from({ length: 40 }, (_, i) =>
      row({ latency_ms: 100, at: T0 - 2 * 86_400_000 - i * 1000 }),
    );
    const slow = Array.from({ length: 20 }, () => row({ latency_ms: 500, at: T0 - 60_000 }));
    expect(
      evaluateAlerts({
        now,
        aiRows: [...base, ...slow],
        builder: { generated: 0, failed: 0 },
        telemetry: { failures: 0, lastFailureAt: null },
      }).map((a) => a.key),
    ).toEqual(["ai.latency_p95"]);
  });
});

describe("period", () => {
  const now = new Date("2026-11-11T09:00:00Z");
  it("parses ranges, custom dates in Riyadh time, and falls back safely", () => {
    expect(parsePeriod({ range: "24h" }, now)).toMatchObject({ range: "24h", bucket: "hour" });
    expect(parsePeriod({}, now).range).toBe("7d");
    expect(parsePeriod({ range: "bogus" }, now).range).toBe("7d");
    const c = parsePeriod({ range: "custom", from: "2026-11-01", to: "2026-11-03" }, now);
    expect(c.from.toISOString()).toBe("2026-10-31T21:00:00.000Z");
    expect(c.to.toISOString()).toBe("2026-11-03T21:00:00.000Z");
    expect(c.bucket).toBe("day");
    expect(parsePeriod({ range: "custom", from: "nope" }, now).range).toBe("7d");
  });

  it("buckets by Riyadh day and builds URLs without empty params", () => {
    expect(dayKeyOf("2026-11-10T22:30:00Z")).toBe("2026-11-10T21:00:00.000Z");
    expect(dayKeys(new Date("2026-11-08T21:00:00Z"), new Date("2026-11-10T21:00:00Z"))).toHaveLength(2);
    expect(tabOf({ tab: "ai" })).toBe("ai");
    expect(tabOf({ tab: "../etc" })).toBe("overview");
    expect(monitoringHref({ tab: "ai", provider: "" }, { range: "24h" })).toBe(
      "/admin/monitoring?tab=ai&range=24h",
    );
  });
});
