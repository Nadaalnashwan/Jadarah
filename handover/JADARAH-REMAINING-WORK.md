# JADARAH — Remaining work (prioritised)

Only unfinished work is listed. Completed work is in `JADARAH-HANDOVER.md` (section D) and `JADARAH-TEST-REPORT.md`.
"DB change" = needs a migration (owner approval required before applying to the hosted project).
"Credentials" = needs a secret the owner must provide.

---

## P0 — Critical before the demo

The core pipeline (per-question files → extraction → per-question AI evaluation → persisted results → employer review →
candidate feedback → weighted total) **passed a live end-to-end test on 2026-11-12 (29/29)**. The continuation session
(same day, after snapshot `b57ebca`) closed most of the remaining gaps; status per item below. Details of every change:
`CHANGES-SINCE-b57ebca.md`.

### P0-1 Choose and fund the AI provider for evaluation — **OPEN: owner decision + credentials**
- **Facts:** on the hosted project (read-only check of `ai_provider_logs`), OpenAI `gpt-6.1-sol` → `openai_quota_exhausted`,
  `gemini-3.8-flash` → `gemini_overloaded`/`gemini_timeout`, every success on `gemini-3.5-flash`; one Groq
  `openai/gpt-oss-120b` evaluation succeeded on 11-11. In the continuation environment only Groq is configured
  (`npm run ai:verify`: Groq OK, Gemini/OpenAI not configured); Groq produced correct evaluations, but of about 18 Groq
  requests in that session 1 evaluation failed on a schema mismatch (after the repair pass) and 3 were refused with
  HTTP 429 (rate limit).
- **Recommendation:** route `assessment_evaluation` to Gemini with `GEMINI_MODEL=gemini-3.5-flash` (the model that did
  every successful evaluation and all OCR) on a **paid** Gemini key, and keep OpenAI as the deep-task primary only if a
  funded key is provided; otherwise leave `OPENAI_API_KEY` empty so evaluations do not first wait for a quota error.
  Gemini is also required for JPEG / scanned-PDF reading (P0-2). Groq stays the last fallback.
- **What the owner must provide/decide:** (a) a paid `GEMINI_API_KEY` (and the model choice above), and/or (b) a
  funded `OPENAI_API_KEY`, or (c) confirm the routing without OpenAI. No code change is needed for (a)–(c): routing is by
  environment (`src/services/ai/config.ts`).
- **Acceptance:** `npm run ai:verify` shows the chosen model OK; `scripts/verify/evaluate-fixtures.ts` runs 0 FAIL with
  the chosen provider; one evaluation in the employer UI logs `success = true` on that model in `ai_provider_logs`.

### P0-2 Verify the remaining formats live — **DONE for DOC, PPTX, XLSX; BLOCKED for JPEG and scanned PDF (Gemini key)**
- Two extraction defects found and fixed: PPTX/XLSX with no real text were reported as "read" (only part headers), and
  XLSX cells were sent as shared-string index numbers. Encrypted Office files are now reported as password-protected.
- New real fixtures (`scripts/fixtures/make-office-fixtures.py`): `forecast.pptx`, `image-only.pptx`, `budget.xlsx`,
  `empty.xlsx`, `protected.xlsx` (truly encrypted).
- Live run (`scripts/verify/evaluate-fixtures.ts`, Groq, no database): **25 PASS, 0 FAIL, 2 BLOCKED**
  (`docs/evidence/ai-evaluation/`). DOC 5/5, PPTX 6/6, XLSX 6/6 with verified quotes; the same PPTX against a question it
  does not answer scored **0/6**; protected PDF, protected XLSX, image-only PPTX → `extraction_failed`, no score, no AI
  call. JPEG and scanned PDF: correctly **not scored** without transcription; reading them needs Gemini.
- **Remaining:** with a Gemini key, run `NODE_USE_ENV_PROXY=1 npx tsx --conditions=react-server scripts/verify/evaluate-fixtures.ts`
  (expect `image_ai` / `pdf_ocr_ai` with "18,450 SAR"), then one browser evaluation per format on a local/staging project
  (or the hosted project with approval).

### P0-3 Duplicate-evaluation prevention and evaluation status — **DONE in code; persisted states need proposal 0034**
- Input hash (file bytes + answer + question + criteria + evaluator version) computed before any AI file reading; an
  unchanged input returns the stored result with **no provider call**; the panel offers "Re-evaluate anyway" (forced).
- In-process lock per submission + question; database lock with 0034.
- States: Not evaluated / Reading files / Evaluating / Completed / Failed / Requires human review.
- Tested: unit (hash, reuse, lock, state, the action's orchestration incl. "no second provider call" and "forced run
  calls again"), SQL (proposal 0034: lock, failure persisted, stale run closed, RLS), render (EN/AR).
- **Remaining:** owner approval to apply proposal 0034 (then the failed state survives a refresh and the live phase is
  shown); a browser check of a second click (no new `ai_provider_logs` row) on a database.

### P0-4 Confidence, limitations and identifiers — **DONE**
- Prompt starts with `TASK ID` and `QUESTION ID`; the model returns `limitations[]`; confidence high/medium/low with
  reasons is derived from recorded facts and shown in the panel. Stored in their own columns with 0034 (without it,
  limitations are kept as "points to check" and confidence is derived at display time).

### P0-5 Explicit "reject AI suggestion" — **DONE in code; needs proposal 0034 (approval)**
- `reject_ai_question_evaluation(ai_evaluation, reason)`; rejection kept in `assessment_ai_rejections` and in the
  history; source `ai_rejected`; a rejected result cannot be accepted. The button appears only when 0034 is applied.

### P0-6 Owner approvals needed now
1. P0-1 provider decision and key(s).
2. Apply `supabase/proposals/0034_ai_evaluation_reliability.sql` to the hosted project (additive; rollback in its
   header), **or** first to a staging project. Not applied anywhere yet.
3. Confirm the AI evaluation gate after the JPEG/scanned-PDF check, before any demo seeding (P1).

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
- Request structured outputs with `strict: true` for providers that support it (Groq/OpenAI) to reduce schema
  mismatches; today `strict: false` is sent and Zod validates with one repair pass.
- Push GitHub branch `preview/premium-redesign` after owner approval (the Claude GitHub App lacked write permission:
  HTTP 403).
- Docker-based local Supabase (`npx supabase start`) has never been run (image pulls were blocked in the cloud
  container).
