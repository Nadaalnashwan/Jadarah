# JADARAH — Remaining work (prioritised)

Only unfinished work is listed. Completed work is in `JADARAH-HANDOVER.md` (section D) and `JADARAH-TEST-REPORT.md`.
"DB change" = needs a migration (owner approval required before applying to the hosted project).
"Credentials" = needs a secret the owner must provide.

---

## P0 — Critical before the demo

The core pipeline (per-question files → extraction → per-question AI evaluation → persisted results → employer review →
candidate feedback → weighted total) **passed a live end-to-end test on 2026-11-12 (29/29)**. The items below close the
remaining gaps the owner asked for.

### P0-1 Restore the intended AI provider for evaluation
- **Objective:** evaluation currently succeeds only on the fallback `gemini-3.5-flash`. OpenAI returns
  `openai_quota_exhausted` and `gemini-3.8-flash` returned `gemini_overloaded`.
- **Files:** `src/services/ai/config.ts` (routes), environment.
- **Acceptance:** `npm run ai:verify` reports the chosen model working, and one live evaluation is logged in
  `ai_provider_logs` with `success = true` on that model.
- **Test:** `npm run ai:verify`, then evaluate one question in the employer UI.
- **DB change:** no. **Credentials:** yes: a funded `OPENAI_API_KEY`, or a decision to route `assessment_evaluation`
  to Gemini (`GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL`).

### P0-2 Verify the remaining formats live (JPEG, scanned PDF OCR, DOC, PPTX/XLSX)
- **Objective:** these paths are implemented and the non-AI parts are tested locally
  (`tests/unit/extraction-formats.test.ts`), but they have not been evaluated by the live provider.
- **Files:** `src/services/evaluation/extract.ts`; fixtures `tests/fixtures/evaluation/{photo.jpg,scanned.pdf,report.doc,protected.pdf}`.
- **Acceptance:**
  - a question with `photo.jpg` and one with `scanned.pdf` produce `image_ai` / `pdf_ocr_ai` with the real text
    ("18,450 SAR");
  - `report.doc` is evaluated with its text;
  - `protected.pdf` produces an explicit failure and no score.
- **Test:** extend `scripts/verify/question-evaluation-e2e.cjs` with these files, or run it on a local/staging
  project.
- **DB change:** no. **Credentials:** Gemini key. Writes demo records if run against the hosted project, which needs
  owner approval.

### P0-3 Duplicate-evaluation prevention and evaluation status
- **Objective:** clicking "Evaluate"/"Re-evaluate" always calls the AI again. Add:
  - skip when the latest AI result for the same submission + question has the same `input_sha256`, unless "Re-evaluate"
    is confirmed (the hash is computed from file bytes + answer + criteria);
  - an in-flight lock per submission + question;
  - visible states per question: Not evaluated / Reading files / Evaluating / Completed / Failed / Requires human
    review.

  Today the button only shows a spinner, and failures appear as a toast without being persisted.
- **Files:** `src/features/assessments/question-evaluation-actions.ts`,
  `src/app/company/applications/[id]/question-review.tsx`.
- **Acceptance:**
  - a second click with unchanged input returns the stored result without a new `ai_provider_logs` row;
  - a forced re-run adds a new row;
  - the failed state is visible after refresh.
- **Test:** unit test for the hash comparison; live check of `ai_provider_logs` counts.
- **DB change:** persisting the failed and in-progress states needs a small table or status values (e.g.
  `assessment_ai_runs(submission_id, question_id, status, error, started_at, finished_at)`). Hash-based deduplication
  needs no DB change. **Credentials:** no.

### P0-4 Confidence / limitations and identifiers in the evaluation prompt
- **Objective:**
  - add the task id and question id to the evaluation prompt (`evaluationPrompt` in
    `src/lib/domain/question-evaluation.ts`);
  - ask the model for `limitations[]`;
  - derive a confidence level (high / medium / low) from extraction status, verified evidence and truncation, and show
    it in the review panel. This can be derived at display time from the stored `files`, `criteria` and `concerns`,
    so no DB change is needed.
- **Acceptance:** the panel shows the confidence level with its reasons; the prompt contains both ids (unit test).
- **DB change:** no. **Credentials:** no.

### P0-5 Explicit "reject AI suggestion" action
- **Objective:** the reviewer can currently score independently (`source = human`), but there is no recorded
  rejection of a specific AI result.
- **Files:** `question-review.tsx`, `review_assessment_question` (0033).
- **Acceptance:** the history shows "AI result X rejected by reviewer".
- **DB change:** yes, a new `source` value (e.g. `ai_rejected`) or a rejection column. **Credentials:** no.

### P0-6 Confirm with the owner that the gate is met
- The real end-to-end evaluation has passed (`JADARAH-TEST-REPORT.md`, section "Question-level evaluation"). Ask the
  owner to confirm before any demo seeding.

---

## P1 — Demo readiness (only after P0 sign-off)

| ID | Objective | Files | Acceptance | DB change | Credentials |
|---|---|---|---|---|---|
| P1-1 | Decide job visibility: list the demo companies in the catalogue (Super Admin → Subscriptions), or apply proposal `supabase/proposals/0032_job_visibility_without_catalogue.sql` | `can_view_job`, `src/app/company/jobs/page.tsx` | Candidates see every published job of approved companies used in the demo | Proposal = yes | no |
| P1-2 | Prepare demo jobs, applications, assigned tasks and genuine per-question submissions with real files, then run the real AI evaluation | `JADARAH-DEMO-DATA-PLAN.md`, `scripts/verify/*`, `scripts/demo/*` | Every submitted question has its own files and a stored AI result; dashboards show real records | no (data only; needs approval for the hosted project) | AI keys |
| P1-3 | Schedule interviews only when the demo date and time are confirmed; check both calendars | `src/features/interviews`, `src/app/candidate/calendar`, `src/app/company/interviews` | Upcoming vs history correct in Asia/Riyadh time | no | Daily key for video |
| P1-4 | Verify dashboard metrics against the database | `src/app/company/page.tsx`, `src/app/candidate/page.tsx`, `src/app/admin/*` | Each number matches a SQL count | no | no |
| P1-5 | Clean up the verification records listed in `JADARAH-HANDOVER.md` section F, if the owner wants | — | Records removed and storage objects deleted | data only | approval |

## P2 — Production readiness

| ID | Objective | Notes | DB change | Credentials |
|---|---|---|---|---|
| P2-1 | Environment review | See `ENVIRONMENT-REFERENCE.md`; set `JADARAH_SERVER_KEY` (+ insert its hash into `private.service_keys`), `CRON_SECRET`, an email provider, `DAILY_WEBHOOK_SECRET` | no (service key row = data) | yes |
| P2-2 | Migrations review | Decide on proposals 0028 (function EXECUTE hardening), 0030 (workflow/CV/listings), 0031 (monitoring), job-visibility 0032. Reconcile the ledger names (MCP timestamps) before ever using `supabase db push` | yes | no |
| P2-3 | RLS and Storage review | Run `tests/integration/security.test.ts` against staging and `tests/db/run-local.sh`; review the `assessment-attachments` and `interview-attachments` policies | no | staging project |
| P2-4 | AI result provenance | `record_ai_question_evaluation` can be called by any recruiter of the company. Move AI writes behind the server key (`private.require_service`) | yes | server key |
| P2-5 | Authentication security | Redirect URLs, email templates, rate limits (shared limiter needs the server key) | no | yes |
| P2-6 | Error handling and logging | Health route `/api/health`; `ai_provider_logs`; monitoring pages (proposal 0031) | maybe | no |
| P2-7 | Performance | Landing long tasks under software GL; public `/jobs`; admin page | no | no |
| P2-8 | Hosting, domain, HTTPS, production build | `JADARAH-DEPLOYMENT-GUIDE.md` | no | hosting account, DNS |

## P3 — Optional improvements

- Sandbox execution of submitted code (containers) for test-based grading. Today code is read, not run.
- `.xls` reading; OCR of images inside ZIP archives; ZIP64 support.
- Batch "Evaluate all questions" with a progress queue (background job).
- Push GitHub branch `preview/premium-redesign` after owner approval (the Claude GitHub App lacked write permission:
  HTTP 403).
- Docker-based local Supabase (`npx supabase start`) has never been run (image pulls were blocked in the cloud
  container).
