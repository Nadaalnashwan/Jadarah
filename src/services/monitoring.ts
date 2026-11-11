import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { AiLogRow } from "@/lib/monitoring/ai-metrics";
import { dayKeyOf, dayKeys, type Period } from "@/lib/monitoring/period";

/**
 * Server-side monitoring loaders. Every loader reads only the columns it needs for the selected period, pages through
 * results (no silent truncation below PAGE_LIMIT rows) and aggregates on the server — nothing is computed from a
 * "recent N rows" sample, and no raw event table is sent to the browser.
 * Super Admin only (RLS on every source); company analytics call the recruitment loader under the employer's session,
 * where RLS limits every row to that company.
 */
const PAGE = 1000;
const PAGE_LIMIT = 50_000;

type Q<T> = {
  range(
    from: number,
    to: number,
  ): PromiseLike<{ data: T[] | null; error: { code?: string; message: string } | null }>;
};

async function readAll<T>(
  make: () => Q<T>,
): Promise<{ rows: T[]; truncated: boolean; error: string | null }> {
  const rows: T[] = [];
  for (let from = 0; from < PAGE_LIMIT; from += PAGE) {
    const { data, error } = await make().range(from, from + PAGE - 1);
    if (error) return { rows, truncated: false, error: error.code ?? error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return { rows, truncated: false, error: null };
  }
  return { rows, truncated: true, error: null };
}

/** Ids of demo identities and fictional companies (excluded from platform figures unless scope=all). */
export async function demoIds(supabase: ServerSupabase) {
  const [{ rows: users }, { rows: companies }] = await Promise.all([
    readAll<{ id: string }>(() => supabase.from("profiles").select("id").eq("is_demo", true).order("id")),
    readAll<{ id: string }>(() =>
      supabase.from("company_profiles").select("id").eq("is_demo", true).order("id"),
    ),
  ]);
  return { users: new Set(users.map((u) => u.id)), companies: new Set(companies.map((c) => c.id)) };
}

// ------------------------------------------------------------------ AI
const AI_COLS =
  "provider, model, operation, user_id, latency_ms, input_tokens, output_tokens, success, error_code, created_at";

export async function loadAiRows(
  supabase: ServerSupabase,
  from: Date,
  to: Date,
  f: { provider?: string; model?: string; operation?: string } = {},
): Promise<{ rows: AiLogRow[]; truncated: boolean; traced: boolean; error: string | null }> {
  const build = (cols: string) => () => {
    let q = supabase
      .from("ai_provider_logs")
      .select(cols)
      .gte("created_at", from.toISOString())
      .lt("created_at", to.toISOString());
    if (f.provider) q = q.eq("provider", f.provider);
    if (f.model) q = q.eq("model", f.model);
    if (f.operation) q = q.eq("operation", f.operation);
    return q.order("created_at") as unknown as Q<AiLogRow>;
  };
  // Correlation columns exist only after proposal 0031; fall back to the base columns otherwise.
  const traced = await readAll<AiLogRow>(build(`${AI_COLS}, request_id, attempt, is_fallback`));
  if (!traced.error) return { ...traced, traced: true };
  const base = await readAll<AiLogRow>(build(AI_COLS));
  return { ...base, traced: false };
}

export async function aiFilterOptions(supabase: ServerSupabase, since: Date) {
  const { rows } = await readAll<{ provider: string; model: string | null; operation: string }>(
    () =>
      supabase
        .from("ai_provider_logs")
        .select("provider, model, operation")
        .gte("created_at", since.toISOString())
        .order("created_at") as unknown as Q<{ provider: string; model: string | null; operation: string }>,
  );
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
  return {
    providers: uniq(rows.map((r) => r.provider)),
    models: uniq(rows.map((r) => r.model)),
    operations: uniq(rows.map((r) => r.operation)),
  };
}

// ------------------------------------------------------------------ platform overview
async function count(q: PromiseLike<{ count: number | null }>) {
  return (await q).count ?? 0;
}

export async function platformOverview(
  supabase: ServerSupabase,
  period: Period,
  excl: { users: Set<string>; companies: Set<string> } | null,
) {
  const notIn = (ids: Set<string>) => `(${[...ids].join(",") || "00000000-0000-0000-0000-000000000000"})`;
  const u = excl ? notIn(excl.users) : null;
  const c = excl ? notIn(excl.companies) : null;
  const p = (q: ReturnType<typeof supabase.from>) => q; // readability
  void p;
  const users = () => {
    const q = supabase.from("profiles").select("id", { count: "exact", head: true });
    return u ? q.not("id", "in", u) : q;
  };
  const byCompany = <T extends { not: (c: string, o: string, v: string) => T }>(q: T) =>
    c ? q.not("company_id", "in", c) : q;
  const [
    registered,
    candidates,
    employers,
    companies,
    pendingAccess,
    activeSubs,
    demoSubs,
    published,
    drafts,
    applications,
    assessmentDrafts,
    assessmentsPublished,
    submissions,
    pendingReviews,
    interviews,
  ] = await Promise.all([
    count(users()),
    count(users().eq("account_type", "candidate")),
    count(users().eq("account_type", "company")),
    count(
      c
        ? supabase.from("company_profiles").select("id", { count: "exact", head: true }).not("id", "in", c)
        : supabase.from("company_profiles").select("id", { count: "exact", head: true }),
    ),
    count(
      supabase
        .from("company_access_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ),
    count(
      byCompany(
        supabase
          .from("company_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .eq("is_demo", false),
      ),
    ),
    count(
      byCompany(
        supabase
          .from("company_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .eq("is_demo", true),
      ),
    ),
    count(
      byCompany(supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "published")),
    ),
    count(
      byCompany(supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "draft")),
    ),
    count(byCompany(supabase.from("applications").select("id", { count: "exact", head: true }))),
    count(
      byCompany(
        supabase.from("assessments").select("id", { count: "exact", head: true }).eq("status", "draft"),
      ),
    ),
    count(
      byCompany(
        supabase.from("assessments").select("id", { count: "exact", head: true }).eq("status", "published"),
      ),
    ),
    count(
      (u
        ? supabase
            .from("assessment_submissions")
            .select("id", { count: "exact", head: true })
            .not("candidate_id", "in", u)
        : supabase.from("assessment_submissions").select("id", { count: "exact", head: true })
      ).neq("status", "in_progress"),
    ),
    count(
      (u
        ? supabase
            .from("assessment_submissions")
            .select("id", { count: "exact", head: true })
            .not("candidate_id", "in", u)
        : supabase.from("assessment_submissions").select("id", { count: "exact", head: true })
      )
        .eq("needs_review", true)
        .eq("status", "submitted"),
    ),
    count(byCompany(supabase.from("interviews").select("id", { count: "exact", head: true }))),
  ]);
  // Activity trends in the period (sign-ups and applications per day).
  const [{ rows: signups }, { rows: apps }] = await Promise.all([
    readAll<{ id: string; created_at: string }>(() => {
      const q = supabase
        .from("profiles")
        .select("id, created_at")
        .gte("created_at", period.from.toISOString())
        .lt("created_at", period.to.toISOString());
      return (u ? q.not("id", "in", u) : q).order("created_at") as unknown as Q<{
        id: string;
        created_at: string;
      }>;
    }),
    readAll<{ submitted_at: string }>(() => {
      const q = supabase
        .from("applications")
        .select("submitted_at, company_id")
        .gte("submitted_at", period.from.toISOString())
        .lt("submitted_at", period.to.toISOString());
      return (c ? q.not("company_id", "in", c) : q).order("submitted_at") as unknown as Q<{
        submitted_at: string;
      }>;
    }),
  ]);
  const days = dayKeys(period.from, period.to);
  const trend = days.map((d) => ({
    day: d,
    signups: signups.filter((r) => dayKeyOf(r.created_at) === d).length,
    applications: apps.filter((r) => dayKeyOf(r.submitted_at) === d).length,
  }));
  return {
    registered,
    candidates,
    employers,
    companies,
    pendingAccess,
    activeSubs,
    demoSubs,
    published,
    drafts,
    applications,
    assessmentDrafts,
    assessmentsPublished,
    submissions,
    pendingReviews,
    interviews,
    trend,
  };
}

type GenerationMeta = {
  assessment_id: string;
  company_id: string;
  status: string;
  model: string | null;
  checks: { check: string; passed: boolean }[];
  refs: number;
  created_at: string;
  assessment_status: string | null;
};

/**
 * Assessment Builder generation METADATA. Uses the Super Admin function from proposal 0031 (no draft content);
 * without it, falls back to rows the caller may read under RLS (recruiters of their own company only).
 */
async function loadGenerations(
  supabase: ServerSupabase,
  period: Period,
): Promise<{ rows: GenerationMeta[]; access: "metadata_function" | "rls_only" }> {
  const { data, error } = await supabase.rpc(
    "monitoring_assessment_generations" as never,
    { p_from: period.from.toISOString(), p_to: period.to.toISOString() } as never,
  );
  if (!error) return { rows: (data ?? []) as GenerationMeta[], access: "metadata_function" };
  type Row = {
    assessment_id: string;
    company_id: string;
    status: string;
    model: string | null;
    validation: { check: string; passed: boolean }[] | null;
    references_used: unknown[] | null;
    created_at: string;
    assessment: { status: string } | null;
  };
  const { rows } = await readAll<Row>(
    () =>
      supabase
        .from("assessment_generations")
        .select(
          "assessment_id, company_id, status, model, validation, references_used, created_at, assessment:assessments(status)",
        )
        .gte("created_at", period.from.toISOString())
        .lt("created_at", period.to.toISOString())
        .order("created_at") as unknown as Q<Row>,
  );
  return {
    access: "rls_only",
    rows: rows.map((r) => ({
      assessment_id: r.assessment_id,
      company_id: r.company_id,
      status: r.status,
      model: r.model,
      created_at: r.created_at,
      checks: (r.validation ?? []).map((c) => ({ check: c.check, passed: c.passed })),
      refs: r.references_used?.length ?? 0,
      assessment_status: r.assessment?.status ?? null,
    })),
  };
}

// ------------------------------------------------------------------ Assessment Builder
type BuilderEvent = {
  created_at: string;
  company_id: string | null;
  model: string | null;
  output: {
    event?: string;
    assessment_id?: string;
    duration_ms?: number;
    retrieval?: string;
    references?: number;
    repair_attempted?: boolean;
    repair_accepted?: boolean;
    checks_total?: number;
    checks_failed?: number;
    failed_checks?: string[];
    error?: string;
  } | null;
};

export async function builderMonitoring(
  supabase: ServerSupabase,
  period: Period,
  excludeCompanies: Set<string> | null,
  companyId?: string | null,
) {
  const [
    { rows: events },
    { rows: generations, access: generationsAccess },
    { rows: builderCalls },
    { rows: refs },
    { count: refEmb },
    { data: companies },
  ] = await Promise.all([
    readAll<BuilderEvent>(
      () =>
        supabase
          .from("ai_generation_records")
          .select("created_at, company_id, model, output")
          .eq("kind", "assessment")
          .gte("created_at", period.from.toISOString())
          .lt("created_at", period.to.toISOString())
          .order("created_at") as unknown as Q<BuilderEvent>,
    ),
    loadGenerations(supabase, period),
    readAll<{ model: string | null; latency_ms: number | null; success: boolean; created_at: string }>(
      () =>
        supabase
          .from("ai_provider_logs")
          .select("model, latency_ms, success, created_at")
          .eq("operation", "assessment_builder")
          .gte("created_at", period.from.toISOString())
          .lt("created_at", period.to.toISOString())
          .order("created_at") as unknown as Q<never>,
    ),
    readAll<{ validation_status: string; completeness: string | null }>(
      () =>
        supabase
          .from("reference_assessments")
          .select("validation_status, completeness")
          .order("id") as unknown as Q<never>,
    ),
    supabase.from("reference_embeddings").select("reference_id", { count: "exact", head: true }),
    supabase.from("company_profiles").select("id, name_en, name_ar"),
  ]);
  const keep = <T extends { company_id: string | null }>(xs: T[]) =>
    xs.filter(
      (x) =>
        (!companyId || x.company_id === companyId) &&
        (!excludeCompanies || !x.company_id || !excludeCompanies.has(x.company_id)),
    );
  const ev = keep(events);
  const gens = keep(generations);
  // A "generated" event is either the new instrumented event or a legacy record that references an assessment.
  const generated = ev.filter(
    (e) => e.output?.event === "generated" || (!e.output?.event && e.output?.assessment_id),
  );
  const failed = ev.filter((e) => e.output?.event === "failed");
  const regenerated = ev.filter((e) => e.output?.event === "section_regenerated").length;
  const edits = ev.filter((e) => e.output?.event === "human_edit");
  const instrumented = generated.filter((e) => typeof e.output?.duration_ms === "number");
  const checkTotals = new Map<string, { passed: number; total: number }>();
  for (const g of gens)
    for (const c of g.checks) {
      const t = checkTotals.get(c.check) ?? { passed: 0, total: 0 };
      t.total += 1;
      if (c.passed) t.passed += 1;
      checkTotals.set(c.check, t);
    }
  const allPassed = gens.filter((g) => g.checks.length && g.checks.every((c) => c.passed)).length;
  const editedAssessments = new Set(edits.map((e) => e.output?.assessment_id).filter(Boolean));
  const days = dayKeys(period.from, period.to);
  const companyName = new Map((companies ?? []).map((c) => [c.id, c]));
  const byCompany = new Map<string, { generated: number; approved: number; published: number }>();
  for (const g of gens) {
    const x = byCompany.get(g.company_id) ?? { generated: 0, approved: 0, published: 0 };
    x.generated += 1;
    if (g.status === "approved") x.approved += 1;
    if (g.assessment_status === "published") x.published += 1;
    byCompany.set(g.company_id, x);
  }
  const durByModel = new Map<string, number[]>();
  for (const c of builderCalls.filter((x) => x.success && x.latency_ms !== null))
    durByModel.set(c.model ?? "—", [...(durByModel.get(c.model ?? "—") ?? []), c.latency_ms!]);
  return {
    generationsAccess,
    attempts: generated.length + failed.length,
    generatedEvents: generated.length,
    failedEvents: failed.length,
    instrumentedSamples: instrumented.length,
    durations: instrumented.map((e) => e.output!.duration_ms!),
    retrieval: {
      ok: generated.filter((e) => e.output?.retrieval === "ok").length,
      none: generated.filter((e) => e.output?.retrieval === "none").length,
      failed: [...generated, ...failed].filter((e) => e.output?.retrieval === "failed").length,
      references: gens.reduce((a, g) => a + g.refs, 0),
      generationsWithRefs: gens.filter((g) => g.refs > 0).length,
    },
    repair: {
      attempted: instrumented.filter((e) => e.output?.repair_attempted).length,
      accepted: instrumented.filter((e) => e.output?.repair_accepted).length,
    },
    lifecycle: {
      generated: gens.length,
      validated: allPassed,
      reviewed: gens.filter((g) => editedAssessments.has(g.assessment_id) || g.status !== "draft").length,
      approved: gens.filter((g) => g.status === "approved").length,
      rejected: gens.filter((g) => g.status === "rejected").length,
      published: gens.filter((g) => g.assessment_status === "published").length,
    },
    regenerated,
    humanEdits: edits.length,
    editedAssessments: editedAssessments.size,
    checks: [...checkTotals]
      .map(([check, t]) => ({ check, ...t }))
      .sort((a, b) => a.passed / a.total - b.passed / b.total),
    trend: days.map((d) => ({
      day: d,
      generated: generated.filter((e) => dayKeyOf(e.created_at) === d).length,
      failed: failed.filter((e) => dayKeyOf(e.created_at) === d).length,
    })),
    durationByModel: [...durByModel].map(([model, xs]) => ({
      model,
      samples: xs.length,
      ms: xs.sort((a, b) => a - b),
    })),
    byCompany: [...byCompany]
      .map(([id, x]) => ({
        id,
        name_en: companyName.get(id)?.name_en ?? "—",
        name_ar: companyName.get(id)?.name_ar ?? "—",
        ...x,
      }))
      .sort((a, b) => b.generated - a.generated),
    references: {
      total: refs.length,
      validated: refs.filter((r) => r.validation_status === "validated").length,
      needsReview: refs.filter((r) => r.validation_status === "needs_review").length,
      incomplete: refs.filter((r) => r.validation_status === "incomplete").length,
      embedded: refEmb ?? 0,
    },
  };
}

// ------------------------------------------------------------------ recruitment (platform or one company)
export async function recruitmentMonitoring(
  supabase: ServerSupabase,
  period: Period,
  opts: { companyId?: string | null; excludeCompanies?: Set<string> | null },
) {
  const within = <T extends { gte: (c: string, v: string) => T; lt: (c: string, v: string) => T }>(
    q: T,
    col: string,
  ) => q.gte(col, period.from.toISOString()).lt(col, period.to.toISOString());
  const scoped = <T extends { eq: (c: string, v: string) => T }>(q: T) =>
    opts.companyId ? q.eq("company_id", opts.companyId) : q;
  type App = {
    id: string;
    job_id: string;
    company_id: string;
    status: string;
    was_shortlisted: boolean;
    requires_task: boolean;
    completed_at: string | null;
    match_score: number | null;
    submitted_at: string;
    decided_at: string | null;
    job: { title_en: string; title_ar: string } | null;
  };
  // Cohort: applications SUBMITTED in the period; their assignments and interviews are followed whenever they happen,
  // so every funnel step shares the same denominator.
  const [{ rows: appsRaw }, { count: publishedJobs }] = await Promise.all([
    readAll<App>(
      () =>
        scoped(
          within(
            supabase
              .from("applications")
              .select(
                "id, job_id, company_id, status, was_shortlisted, requires_task, completed_at, match_score, submitted_at, decided_at, job:jobs(title_en, title_ar)",
              ),
            "submitted_at",
          ),
        ).order("submitted_at") as unknown as Q<App>,
    ),
    scoped(supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "published")),
  ]);
  const ex = opts.excludeCompanies;
  const apps = ex ? appsRaw.filter((a) => !ex.has(a.company_id)) : appsRaw;
  const asg: {
    id: string;
    application_id: string | null;
    status: string;
    created_at: string;
    submitted_at: string | null;
    sub: { percentage: number | null; status: string } | null;
  }[] = [];
  const ivs: {
    id: string;
    application_id: string;
    status: string;
    scheduled_at: string;
    candidate_confirmed_at: string | null;
    created_at: string;
  }[] = [];
  for (let i = 0; i < apps.length; i += 200) {
    const ids = apps.slice(i, i + 200).map((a) => a.id);
    const [a, v] = await Promise.all([
      supabase
        .from("assessment_assignments")
        .select(
          "id, application_id, status, created_at, submitted_at, sub:assessment_submissions(percentage, status)",
        )
        .in("application_id", ids),
      supabase
        .from("interviews")
        .select("id, application_id, status, scheduled_at, candidate_confirmed_at, created_at")
        .in("application_id", ids),
    ]);
    asg.push(...((a.data ?? []) as never[]));
    ivs.push(...((v.data ?? []) as never[]));
  }
  const appIds = apps.map((a) => a.id);
  // Stage durations from the status history of these applications.
  const history: { application_id: string; to_status: string; created_at: string }[] = [];
  for (let i = 0; i < appIds.length; i += 200) {
    const { data } = await supabase
      .from("application_status_history")
      .select("application_id, to_status, created_at")
      .in("application_id", appIds.slice(i, i + 200));
    history.push(...(data ?? []));
  }
  const firstAt = new Map<string, Map<string, number>>();
  for (const h of history) {
    const m = firstAt.get(h.application_id) ?? new Map<string, number>();
    const t = new Date(h.created_at).getTime();
    if (!m.has(h.to_status) || t < m.get(h.to_status)!) m.set(h.to_status, t);
    firstAt.set(h.application_id, m);
  }
  const stage = (fromS: string, toS: string) => {
    const xs: number[] = [];
    for (const [, m] of firstAt)
      if (m.has(fromS) && m.has(toS) && m.get(toS)! >= m.get(fromS)!)
        xs.push((m.get(toS)! - m.get(fromS)!) / 3_600_000);
    return { samples: xs.length, avgHours: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null };
  };
  const invited = apps.filter((a) => a.requires_task || asg.some((s) => s.application_id === a.id)).length;
  const completedAssess = apps.filter((a) =>
    asg.some((s) => s.application_id === a.id && (s.status === "submitted" || s.status === "evaluated")),
  ).length;
  const scores = asg.map((s) => s.sub?.percentage).filter((x): x is number => typeof x === "number");
  const byJob = new Map<string, { title_en: string; title_ar: string; scores: number[] }>();
  for (const s of asg) {
    if (typeof s.sub?.percentage !== "number" || !s.application_id) continue;
    const app = apps.find((a) => a.id === s.application_id);
    if (!app) continue;
    const x = byJob.get(app.job_id) ?? {
      title_en: app.job?.title_en ?? "—",
      title_ar: app.job?.title_ar ?? "—",
      scores: [],
    };
    x.scores.push(s.sub.percentage);
    byJob.set(app.job_id, x);
  }
  const days = dayKeys(period.from, period.to);
  const matchBuckets = [0, 20, 40, 60, 80].map((lo) => ({
    label: `${lo}–${lo === 80 ? 100 : lo + 19}`,
    value: apps.filter(
      (a) =>
        a.match_score !== null &&
        a.match_score >= lo &&
        (lo === 80 ? a.match_score <= 100 : a.match_score < lo + 20),
    ).length,
  }));
  return {
    publishedJobs: publishedJobs ?? 0,
    applications: apps.length,
    funnel: {
      applied: apps.length,
      invited,
      assessed: completedAssess,
      reviewed: apps.filter(
        (a) =>
          (firstAt.get(a.id)?.has("under_review") ?? false) ||
          a.was_shortlisted ||
          ["shortlisted", "interview_scheduled", "interview_completed", "hired", "rejected"].includes(
            a.status,
          ),
      ).length,
      shortlisted: apps.filter((a) => a.was_shortlisted).length,
      interviewed: new Set(ivs.filter((i) => i.status !== "cancelled").map((i) => i.application_id)).size,
      hired: apps.filter((a) => a.status === "hired").length,
      rejected: apps.filter((a) => a.status === "rejected").length,
    },
    assessmentCompletionRate: invited ? completedAssess / invited : null,
    avgScore: scores.length
      ? { value: scores.reduce((a, b) => a + b, 0) / scores.length, samples: scores.length }
      : null,
    scoreByJob: [...byJob.values()]
      .map((j) => ({
        ...j,
        avg: j.scores.reduce((a, b) => a + b, 0) / j.scores.length,
        samples: j.scores.length,
      }))
      .sort((a, b) => b.samples - a.samples)
      .slice(0, 10),
    matchBuckets,
    matchSamples: apps.filter((a) => a.match_score !== null).length,
    stages: [
      { key: "submitted→assessment_completed", ...stage("submitted", "assessment_completed") },
      { key: "assessment_completed→shortlisted", ...stage("assessment_completed", "shortlisted") },
      { key: "shortlisted→interview_scheduled", ...stage("shortlisted", "interview_scheduled") },
      { key: "submitted→hired", ...stage("submitted", "hired") },
    ],
    trend: days.map((d) => ({
      day: d,
      applications: apps.filter((a) => dayKeyOf(a.submitted_at) === d).length,
      invited: asg.filter((s) => dayKeyOf(s.created_at) === d).length,
      completed: asg.filter((s) => s.submitted_at && dayKeyOf(s.submitted_at) === d).length,
    })),
    interviews: {
      total: ivs.length,
      scheduled: ivs.filter((i) => i.status === "scheduled").length,
      confirmed: ivs.filter((i) => i.candidate_confirmed_at).length,
      completed: ivs.filter((i) => i.status === "completed").length,
      cancelled: ivs.filter((i) => i.status === "cancelled").length,
      ids: ivs.map((i) => i.id),
      trend: days.map((d) => ({
        day: d,
        scheduled: ivs.filter((i) => dayKeyOf(i.created_at) === d).length,
        completed: ivs.filter((i) => i.status === "completed" && dayKeyOf(i.scheduled_at) === d).length,
      })),
    },
  };
}

/** Video attendance for the given interviews (joins recorded by the app or Daily webhooks — never meeting content). */
export async function interviewAttendance(supabase: ServerSupabase, interviewIds: string[]) {
  const rows: { interview_id: string; role: string; joined_at: string | null; source?: string }[] = [];
  for (let i = 0; i < interviewIds.length; i += 200) {
    const { data, error } = await supabase
      .from("interview_attendance")
      .select("interview_id, role, joined_at")
      .in("interview_id", interviewIds.slice(i, i + 200));
    if (error) return null;
    rows.push(...(data ?? []));
  }
  const withJoin = new Set(rows.filter((r) => r.joined_at).map((r) => r.interview_id));
  const candidateJoined = new Set(
    rows.filter((r) => r.joined_at && r.role === "candidate").map((r) => r.interview_id),
  );
  const interviewerJoined = new Set(
    rows.filter((r) => r.joined_at && r.role !== "candidate").map((r) => r.interview_id),
  );
  return {
    joins: rows.filter((r) => r.joined_at).length,
    interviewsWithJoin: withJoin.size,
    candidateJoined: candidateJoined.size,
    interviewerJoined: interviewerJoined.size,
  };
}

// ------------------------------------------------------------------ B2B & subscriptions
export async function b2bMonitoring(supabase: ServerSupabase, period: Period, includeDemoCompanies: boolean) {
  type Sub = {
    company_id: string;
    status: string;
    is_demo: boolean;
    price_sar: number | null;
    payment_status: string;
    assessment_credits: number | null;
    credits_used: number;
    created_at: string;
    activated_at: string | null;
    company: { name_en: string; name_ar: string; is_demo: boolean } | null;
  };
  const [{ rows: subsRaw }, { rows: paysRaw }, { rows: jobs }, { rows: apps }] = await Promise.all([
    readAll<Sub>(
      () =>
        supabase
          .from("company_subscriptions")
          .select(
            "company_id, status, is_demo, price_sar, payment_status, assessment_credits, credits_used, created_at, activated_at, company:company_profiles(name_en, name_ar, is_demo)",
          )
          .order("created_at") as unknown as Q<Sub>,
    ),
    readAll<{ company_id: string; kind: string; amount_sar: number; paid_on: string }>(
      () =>
        supabase
          .from("company_payments")
          .select("company_id, kind, amount_sar, paid_on")
          .order("paid_on") as unknown as Q<never>,
    ),
    readAll<{ company_id: string; created_at: string }>(
      () =>
        supabase
          .from("jobs")
          .select("company_id, created_at")
          .gte("created_at", period.from.toISOString())
          .lt("created_at", period.to.toISOString())
          .order("created_at") as unknown as Q<never>,
    ),
    readAll<{ company_id: string; submitted_at: string }>(
      () =>
        supabase
          .from("applications")
          .select("company_id, submitted_at")
          .gte("submitted_at", period.from.toISOString())
          .lt("submitted_at", period.to.toISOString())
          .order("submitted_at") as unknown as Q<never>,
    ),
  ]);
  const subs = includeDemoCompanies ? subsRaw : subsRaw.filter((s) => !s.company?.is_demo);
  const paying = subs.filter((s) => !s.is_demo);
  // Revenue counts only payments recorded against non-demonstration subscriptions: simulated payments are never revenue.
  const payingIds = new Set(paying.map((s) => s.company_id));
  const pays = paysRaw.filter((p) => payingIds.has(p.company_id));
  const received = pays.reduce(
    (a, p) => a + (p.kind === "refund" ? -Number(p.amount_sar) : Number(p.amount_sar)),
    0,
  );
  const contract = paying.filter((s) => s.price_sar !== null).reduce((a, s) => a + Number(s.price_sar), 0);
  const receivedBy = new Map<string, number>();
  for (const p of pays)
    receivedBy.set(
      p.company_id,
      (receivedBy.get(p.company_id) ?? 0) + (p.kind === "refund" ? -1 : 1) * Number(p.amount_sar),
    );
  const outstanding = paying
    .filter((s) => s.price_sar !== null && s.payment_status !== "waived")
    .reduce((a, s) => a + Math.max(0, Number(s.price_sar) - (receivedBy.get(s.company_id) ?? 0)), 0);
  const statuses = ["active", "pending", "suspended", "expired", "cancelled"];
  const months = new Map<string, { month: string; revenue: number }>();
  for (const p of pays) {
    const m = p.paid_on.slice(0, 7);
    const x = months.get(m) ?? { month: m, revenue: 0 };
    x.revenue += (p.kind === "refund" ? -1 : 1) * Number(p.amount_sar);
    months.set(m, x);
  }
  const subMonths = new Map<string, { month: string; created: number; activated: number }>();
  for (const s of subs) {
    const m = s.created_at.slice(0, 7);
    const x = subMonths.get(m) ?? { month: m, created: 0, activated: 0 };
    x.created += 1;
    subMonths.set(m, x);
    if (s.activated_at) {
      const am = s.activated_at.slice(0, 7);
      const y = subMonths.get(am) ?? { month: am, created: 0, activated: 0 };
      y.activated += 1;
      subMonths.set(am, y);
    }
  }
  const activity = subs.map((s) => ({
    id: s.company_id,
    name_en: s.company?.name_en ?? "—",
    name_ar: s.company?.name_ar ?? "—",
    demo: s.is_demo,
    jobs: jobs.filter((j) => j.company_id === s.company_id).length,
    applications: apps.filter((a) => a.company_id === s.company_id).length,
    allocated: s.assessment_credits,
    used: s.credits_used,
  }));
  return {
    organizations: subs.length,
    byStatus: statuses.map((st) => ({
      status: st,
      paying: paying.filter((s) => s.status === st).length,
      demo: subs.filter((s) => s.is_demo && s.status === st).length,
    })),
    demonstration: subs.filter((s) => s.is_demo).length,
    revenue: { received, contract, outstanding, payments: pays.length },
    revenueByMonth: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
    subscriptionTrend: [...subMonths.values()].sort((a, b) => a.month.localeCompare(b.month)),
    credits: {
      allocated: subs
        .filter((s) => s.assessment_credits !== null)
        .reduce((a, s) => a + (s.assessment_credits ?? 0), 0),
      unlimited: subs.filter((s) => s.assessment_credits === null).length,
      used: subs.reduce((a, s) => a + s.credits_used, 0),
      usedLimited: subs.filter((s) => s.assessment_credits !== null).reduce((a, s) => a + s.credits_used, 0),
    },
    activity: activity.sort((a, b) => b.applications + b.jobs - (a.applications + a.jobs)),
  };
}

// ------------------------------------------------------------------ AI vs human review
export async function aiVsHuman(supabase: ServerSupabase) {
  const { rows: suggestions } = await readAll<{
    subject_id: string | null;
    created_at: string;
    model: string | null;
    output: {
      question_id?: string;
      criteria?: { key: string; score: number; evidence: string | null }[];
    } | null;
  }>(
    () =>
      supabase
        .from("ai_analysis_records")
        .select("subject_id, created_at, model, output")
        .eq("kind", "assessment_evaluation")
        .order("created_at") as unknown as Q<never>,
  );
  const pairs: { ai: number; human: number; missingEvidence: boolean }[] = [];
  const subs = [...new Set(suggestions.map((s) => s.subject_id).filter((x): x is string => !!x))];
  const evals: {
    submission_id: string;
    question_id: string | null;
    rubric_scores: Record<string, number>;
  }[] = [];
  for (let i = 0; i < subs.length; i += 200) {
    const { data } = await supabase
      .from("assessment_evaluations")
      .select("submission_id, question_id, rubric_scores")
      .in("submission_id", subs.slice(i, i + 200));
    evals.push(...((data ?? []) as never[]));
  }
  // Latest suggestion per (submission, question) compared with the human evaluation of the same question.
  const latest = new Map<string, (typeof suggestions)[number]>();
  for (const s of suggestions)
    if (s.subject_id && s.output?.question_id) latest.set(`${s.subject_id}|${s.output.question_id}`, s);
  for (const [k, s] of latest) {
    const [sub, q] = k.split("|");
    const human = evals.find((e) => e.submission_id === sub && e.question_id === q);
    if (!human) continue;
    for (const c of s.output?.criteria ?? []) {
      const h = Number(human.rubric_scores?.[c.key]);
      if (Number.isFinite(h)) pairs.push({ ai: c.score, human: h, missingEvidence: !c.evidence });
    }
  }
  return {
    suggestions: latest.size,
    comparedCriteria: pairs.length,
    meanAbsDiff: pairs.length ? pairs.reduce((a, p) => a + Math.abs(p.ai - p.human), 0) / pairs.length : null,
    overrideRate: pairs.length ? pairs.filter((p) => p.ai !== p.human).length / pairs.length : null,
    missingEvidenceRate: pairs.length ? pairs.filter((p) => p.missingEvidence).length / pairs.length : null,
    models: [...new Set(suggestions.map((s) => s.model).filter(Boolean))] as string[],
    lastAt: suggestions.at(-1)?.created_at ?? null,
  };
}
