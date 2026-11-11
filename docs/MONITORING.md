# Monitoring & Evaluation

Super Admin: **/admin/monitoring** (sidebar "Monitoring & evaluation"; the old `/admin/ai` redirects to its AI tab).
Companies: **/company/analytics** (their own recruitment figures only — the same view, scoped by `company_id` and RLS).

Tabs: Platform overview · AI monitoring · Assessment monitoring · Recruitment monitoring · B2B & subscriptions ·
Evaluation & quality. Filters live in the URL (`tab`, `range=24h|7d|30d|90d|custom`, `from`, `to`, `provider`,
`model`, `operation`, `company`, `scope=all` to include demo records, `page` for the attempt list) so every view is
shareable and survives reloads. Demo identities and fictional companies are excluded unless `scope=all`.

## Flow (as implemented)

```
 AI calls (services/ai/provider.ts)            Assessment Builder (features/assessments/builder-actions.ts)
   one row per provider ATTEMPT                   events: generated | failed | section_regenerated |
   provider, model, operation, latency,           human_edit | approved (no content; duration, retrieval,
   tokens, success, error_code                    references, checks, repair) → ai_generation_records
   [+ request_id, attempt, is_fallback            drafts + rule-based checks → assessment_generations
    with proposal 0031]
   → ai_provider_logs (write failures counted in-process)
                                                 Recruitment / B2B workflows (existing tables)
                                                   applications, application_status_history,
                                                   assessment_assignments/_submissions, interviews,
                                                   interview_attendance, company_subscriptions,
                                                   company_payments, reference_assessments/_embeddings
                     │                                         │
                     └──────────────► Supabase (RLS: Super Admin reads platform-wide; companies only their rows)
                                                   │
                         services/monitoring.ts — server-side, period-filtered, paged reads (no 50-row samples)
                         lib/monitoring/ai-metrics.ts — summarize, percentiles, time buckets, fallback correlation
                         lib/monitoring/alerts.ts — thresholds with minimum samples
                         scripts/eval/run.ts — offline labelled benchmark → src/data/evaluation/results.json
                                                   │
                         /admin/monitoring (server components; only aggregates reach the browser)
                         /company/analytics (same recruitment view, company-scoped)
                                                   │
                         Alerts: shown on the page on each visit; with proposal 0031, raise_monitoring_alert()
                         sends ONE in-app notification per alert key to active Super Admins per 6 h (dedupe +
                         cooldown in private.monitoring_alerts) and writes an audit entry → human investigation
                         via the alert's "Investigate" link (pre-filtered tab).
```

No external alert channels (email/SMS/Resend) are used.

## Metric definitions and sources

| Metric                     | Source                                                            | Definition                                                                                                                            |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| AI attempts                | `ai_provider_logs` rows in the period                             | every provider call, including retries and fallback models                                                                            |
| Logical requests           | same rows, grouped                                                | exact by `request_id` (0031); otherwise same user + operation with each attempt ≤ 2 min after a failed one — **labelled approximate** |
| Success / failure rate     | attempts                                                          | successful attempts ÷ attempts (failure = remainder)                                                                                  |
| p50 / p95 / p99 latency    | `latency_ms` of attempts that recorded one                        | nearest-rank percentile; p99 only with ≥ 100 samples                                                                                  |
| Tokens                     | `input_tokens`, `output_tokens`                                   | sums over attempts that reported tokens; the reporting share is shown; **no cost is estimated**                                       |
| Error categories           | `error_code`                                                      | quota · rate limit · timeout · availability (overloaded/5xx/network) · schema · auth · invalid request · other                        |
| Fallback performance       | logical requests                                                  | first-try success · primary failed · recovered by retry (same model) · recovered by fallback model · failed completely                |
| Builder attempts           | `ai_generation_records` (kind `assessment`)                       | `generated` + `failed` events (failed recorded from this release on)                                                                  |
| Drafts passing every check | `assessment_generations.validation`                               | drafts whose stored rule-based checks all passed ÷ drafts generated                                                                   |
| Lifecycle                  | generations + `assessments.status`                                | generated → validated (all checks) → reviewed (human edit or decided) → approved → published                                          |
| Duration by model          | `ai_provider_logs` (operation `assessment_builder`, successful)   | p50/p95 per model                                                                                                                     |
| Reference library health   | `reference_assessments.validation_status`, `reference_embeddings` | counts only; contents never shown                                                                                                     |
| Recruitment cohort         | `applications.submitted_at` in period                             | every funnel step counts cohort applications that reached it at any time                                                              |
| Assessment completion      | cohort assignments                                                | invited candidates who submitted ÷ invited                                                                                            |
| Average score              | `assessment_submissions.percentage`                               | mean over scored submissions (never an average of averages)                                                                           |
| Stage durations            | `application_status_history`                                      | mean time between first entry into each status; only applications that reached both                                                   |
| Interviews                 | `interviews`, `interview_attendance`                              | scheduled / confirmed / completed / cancelled; joins recorded by app or Daily webhook — a room is not proof an interview happened     |
| Paid revenue               | `company_payments` of non-demo subscriptions                      | payments − refunds; demonstration subscriptions never count                                                                           |
| Contract value / unpaid    | `company_subscriptions.price_sar` (non-demo)                      | unpaid = contract − recorded payments, waived excluded                                                                                |
| Credits                    | `assessment_credits`, `credits_used`                              | unlimited plans shown separately; "remaining" only for limited plans                                                                  |

## Alerts (lib/monitoring/alerts.ts)

| Key                          | Fires when                                | Minimum sample         |
| ---------------------------- | ----------------------------------------- | ---------------------- |
| `ai.quota.<provider>`        | ≥ 3 quota errors in 60 min                | 3 errors               |
| `ai.error_rate`              | ≥ 30 % failed attempts in 60 min          | 20 attempts            |
| `ai.latency_p95`             | last-hour p95 ≥ 2 × previous-7-day p95    | 20 recent, 30 baseline |
| `builder.failures`           | ≥ 50 % failed generations in 24 h         | 3 attempts             |
| `monitoring.telemetry_write` | AI log rows failed to save on this server | 1 failure              |

## Evaluation (separate from live monitoring)

`npm run eval:offline` runs the **rule-based** CV skill extractor on a hand-labelled synthetic benchmark
(`scripts/eval/fixtures/cv-skills.json`, 20 CVs, 80 labelled skills; taxonomy snapshot in `fixtures/skills.json`) and
writes `src/data/evaluation/results.json` (date, model, sample, definitions, methodology, limitations, per-case errors).
Current result: precision 92.8 %, recall 80.0 %, 5 unsupported claims, evidence quotes 100 % verbatim, schema 100 %;
all 3 negation cases produced a false skill (a known limitation of rule matching).

Shown as **Not evaluated** (insufficient evidence, nothing invented): AI-provider CV extraction (needs paid live calls on
a labelled set), semantic matching (no labelled relevance benchmark), job relevance / difficulty of assessments (no
human-labelled judgements), AI-vs-human scoring until ≥ 20 criteria have both scores.

## Privacy

Telemetry rows hold no prompts, CV text, answers, assessor guidance or interviewer notes. Builder events store ids,
counts and timings only. Super Admins read Builder **metadata** through `monitoring_assessment_generations()` rather
than gaining access to draft rows (which stay recruiter-only).
