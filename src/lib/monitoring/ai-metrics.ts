/**
 * AI monitoring metrics — pure functions over ai_provider_logs rows (one row = one provider ATTEMPT).
 * Definitions (shown in the dashboard):
 *  - success rate      = successful attempts / all attempts in the period.
 *  - latency p50/p95/p99 = nearest-rank percentiles of latency_ms over attempts that recorded a latency
 *                        (p99 only when there are ≥ 100 samples).
 *  - tokens            = sums over attempts that reported tokens (providers do not always report them).
 *  - logical operation = all attempts of one AI request: retries, repair pass and fallback models.
 *                        Exact when rows carry request_id; otherwise a time-window heuristic (same user + operation,
 *                        each attempt within WINDOW_MS of the previous failed one) — flagged as approximate.
 */
export type AiLogRow = {
  provider: string;
  model: string | null;
  operation: string;
  user_id: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  success: boolean;
  error_code: string | null;
  created_at: string;
  request_id?: string | null;
  attempt?: number | null;
  is_fallback?: boolean | null;
};

export const WINDOW_MS = 120_000;
export const P99_MIN_SAMPLES = 100;

/** Nearest-rank percentile of an ascending-sorted array; null for an empty sample. */
export function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
  return sorted[rank - 1];
}

export type ErrorCategory =
  "quota" | "rate_limit" | "timeout" | "availability" | "schema" | "auth" | "request" | "other";

export function errorCategory(code: string | null): ErrorCategory {
  const c = (code ?? "").toLowerCase();
  if (c.includes("quota") || c.includes("credit")) return "quota";
  if (c.includes("rate_limit") || c.includes("429")) return "rate_limit";
  if (c.includes("timeout") || c.includes("aborted")) return "timeout";
  if (
    c.includes("overload") ||
    c.includes("unavailable") ||
    /_5\d\d\b/.test(c) ||
    c.includes("http_5") ||
    c.includes("network") ||
    c.includes("stream_interrupted")
  )
    return "availability";
  if (c.includes("schema") || c.includes("json") || c.includes("empty_stream")) return "schema";
  if (c.includes("auth") || c.includes("401") || c.includes("403") || c.includes("key")) return "auth";
  if (c.includes("http_4") || c.includes("400") || c.includes("invalid")) return "request";
  return "other";
}

export type Summary = {
  attempts: number;
  success: number;
  failed: number;
  successRate: number | null;
  latency: {
    samples: number;
    avg: number | null;
    p50: number | null;
    p95: number | null;
    p99: number | null;
  };
  tokens: { input: number; output: number; total: number; samples: number };
  byProvider: { key: string; attempts: number; success: number }[];
  byModel: { key: string; attempts: number; success: number; p50: number | null }[];
  byOperation: { key: string; attempts: number; success: number }[];
  errors: { key: ErrorCategory; count: number }[];
};

function groupCount(rows: AiLogRow[], key: (r: AiLogRow) => string) {
  const m = new Map<string, AiLogRow[]>();
  for (const r of rows) {
    const k = key(r);
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  return m;
}

export function summarize(rows: AiLogRow[]): Summary {
  const success = rows.filter((r) => r.success).length;
  const lat = rows
    .map((r) => r.latency_ms)
    .filter((x): x is number => typeof x === "number" && x >= 0)
    .sort((a, b) => a - b);
  const tokenRows = rows.filter((r) => r.input_tokens !== null || r.output_tokens !== null);
  const input = tokenRows.reduce((a, r) => a + (r.input_tokens ?? 0), 0);
  const output = tokenRows.reduce((a, r) => a + (r.output_tokens ?? 0), 0);
  const errs = new Map<ErrorCategory, number>();
  for (const r of rows)
    if (!r.success) errs.set(errorCategory(r.error_code), (errs.get(errorCategory(r.error_code)) ?? 0) + 1);
  const byModel = [...groupCount(rows, (r) => `${r.provider} · ${r.model ?? "—"}`)].map(([key, rs]) => ({
    key,
    attempts: rs.length,
    success: rs.filter((r) => r.success).length,
    p50: percentile(
      rs
        .map((r) => r.latency_ms)
        .filter((x): x is number => typeof x === "number")
        .sort((a, b) => a - b),
      50,
    ),
  }));
  return {
    attempts: rows.length,
    success,
    failed: rows.length - success,
    successRate: rows.length ? success / rows.length : null,
    latency: {
      samples: lat.length,
      avg: lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : null,
      p50: percentile(lat, 50),
      p95: percentile(lat, 95),
      p99: lat.length >= P99_MIN_SAMPLES ? percentile(lat, 99) : null,
    },
    tokens: { input, output, total: input + output, samples: tokenRows.length },
    byProvider: [...groupCount(rows, (r) => r.provider)]
      .map(([key, rs]) => ({ key, attempts: rs.length, success: rs.filter((r) => r.success).length }))
      .sort((a, b) => b.attempts - a.attempts),
    byModel: byModel.sort((a, b) => b.attempts - a.attempts),
    byOperation: [...groupCount(rows, (r) => r.operation)]
      .map(([key, rs]) => ({ key, attempts: rs.length, success: rs.filter((r) => r.success).length }))
      .sort((a, b) => b.attempts - a.attempts),
    errors: [...errs].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
  };
}

export type Bucket = "hour" | "day";
export type SeriesPoint = {
  start: string;
  attempts: number;
  success: number;
  failed: number;
  p50: number | null;
  p95: number | null;
  inputTokens: number;
  outputTokens: number;
};

/** Hourly (≤ 2 days) or daily buckets covering [from, to); empty buckets are kept as zeros (never interpolated). */
export function timeSeries(rows: AiLogRow[], from: Date, to: Date, bucket: Bucket): SeriesPoint[] {
  const step = bucket === "hour" ? 3_600_000 : 86_400_000;
  const start = Math.floor(from.getTime() / step) * step;
  const out: SeriesPoint[] = [];
  const idx = new Map<number, AiLogRow[]>();
  for (const r of rows) {
    const k = Math.floor(new Date(r.created_at).getTime() / step) * step;
    idx.set(k, [...(idx.get(k) ?? []), r]);
  }
  for (let t = start; t < to.getTime(); t += step) {
    const rs = idx.get(t) ?? [];
    const lat = rs
      .map((r) => r.latency_ms)
      .filter((x): x is number => typeof x === "number")
      .sort((a, b) => a - b);
    out.push({
      start: new Date(t).toISOString(),
      attempts: rs.length,
      success: rs.filter((r) => r.success).length,
      failed: rs.filter((r) => !r.success).length,
      p50: percentile(lat, 50),
      p95: percentile(lat, 95),
      inputTokens: rs.reduce((a, r) => a + (r.input_tokens ?? 0), 0),
      outputTokens: rs.reduce((a, r) => a + (r.output_tokens ?? 0), 0),
    });
  }
  return out;
}

export type Operation = {
  attempts: AiLogRow[];
  exact: boolean;
  outcome: "first_try" | "recovered_retry" | "recovered_fallback" | "failed";
};

/** Groups attempts into logical operations (see file header). Rows must belong to the selected period. */
export function correlate(rows: AiLogRow[], windowMs = WINDOW_MS): Operation[] {
  const ops: Operation[] = [];
  const exact = groupCount(
    rows.filter((r) => r.request_id),
    (r) => r.request_id!,
  );
  for (const rs of exact.values()) ops.push(finish(rs.sort(byAttempt), true));
  const legacy = rows.filter((r) => !r.request_id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const open = new Map<string, AiLogRow[]>();
  for (const r of legacy) {
    const key = `${r.user_id ?? "∅"}|${r.operation}`;
    const cur = open.get(key);
    const last = cur?.[cur.length - 1];
    if (
      cur &&
      last &&
      !last.success &&
      new Date(r.created_at).getTime() - new Date(last.created_at).getTime() <= windowMs
    ) {
      cur.push(r);
    } else {
      if (cur) ops.push(finish(cur, false));
      open.set(key, [r]);
    }
  }
  for (const cur of open.values()) ops.push(finish(cur, false));
  return ops;
}

function byAttempt(a: AiLogRow, b: AiLogRow) {
  return (a.attempt ?? 0) - (b.attempt ?? 0) || a.created_at.localeCompare(b.created_at);
}

function finish(attempts: AiLogRow[], exact: boolean): Operation {
  const first = attempts[0];
  const ok = attempts.find((r) => r.success);
  let outcome: Operation["outcome"] = "failed";
  if (first.success) outcome = "first_try";
  else if (ok)
    outcome =
      ok.is_fallback || ok.model !== first.model || ok.provider !== first.provider
        ? "recovered_fallback"
        : "recovered_retry";
  return { attempts, exact, outcome };
}

export type FallbackSummary = {
  operations: number;
  firstTry: number;
  primaryFailures: number;
  recoveredRetry: number;
  recoveredFallback: number;
  failed: number;
  exactShare: number | null;
};

export function fallbackSummary(ops: Operation[]): FallbackSummary {
  const n = ops.length;
  const c = (o: Operation["outcome"]) => ops.filter((x) => x.outcome === o).length;
  return {
    operations: n,
    firstTry: c("first_try"),
    primaryFailures: n - c("first_try"),
    recoveredRetry: c("recovered_retry"),
    recoveredFallback: c("recovered_fallback"),
    failed: c("failed"),
    exactShare: n ? ops.filter((o) => o.exact).length / n : null,
  };
}
