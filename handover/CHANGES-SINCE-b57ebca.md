# JADARAH — Changes since snapshot `b57ebca` (continuation session, 2026-11-12)

Starting point: `JADARAH-FULL-HANDOVER.zip` (`git archive` of `preview/premium-redesign` at `b57ebca`). Work repository:
`/home/user/jadarah-work`, branch `feature/jadarah-product-experience` = remote `e08fc66` → `1c56654` (import of the
archive, unchanged) → continuation commits. Nothing pushed, nothing deployed, no hosted database written, no migration
applied anywhere. The original project folder was not modified.

## 1. File extraction (P0-2)

| Change | Why | Files |
|---|---|---|
| PPTX/XLSX with no real text → `failed` with an explicit reason (was `read` with only `--- slide…` headers, so an image-only deck or an empty workbook went to the evaluator as "read") | A file must never be scored when its content could not be read | `src/services/evaluation/extract.ts` |
| XLSX read as cell-addressed rows per named sheet, shared strings and inline strings resolved, formulas shown with their cached value (was a list of strings followed by bare index numbers) | The evaluator could not tell which value belonged to which row or column | same |
| PPTX: slides in numeric order, paragraphs kept, speaker notes (linked through the slide relationships) labelled | Candidates often explain in notes | same |
| Encrypted PPTX/XLSX (OLE container) → "password-protected" (was "does not match its declared type"); reader errors caught per format | Exact failure reasons | same |
| Real fixtures + generator: `forecast.pptx`, `image-only.pptx`, `budget.xlsx`, `empty.xlsx`, `protected.xlsx` (encrypted through the LibreOffice API; command-line filter options did not encrypt) | Fixtures for PPTX/XLSX did not exist | `scripts/fixtures/make-office-fixtures.py`, `tests/fixtures/evaluation/*` |

## 2. Evaluation reliability and transparency (P0-3, P0-4)

| Change | Files |
|---|---|
| Evaluator core moved out of the server action into a shared service (same prompt, schema and scoring for the action and the offline harness); output schema gains `limitations[]`; payload gains `evaluator_version`, `task_id`, `question_id`, `confidence`, `confidence_reasons` | `src/services/evaluation/question-evaluator.ts` |
| Input hash over file bytes, answer, task/question ids, instructions, points, deliverables, criteria + source, language and evaluator version, computed **before** any AI file reading; reuse rule (identical, real, not rejected; never an "unreadable" result) | `src/lib/domain/evaluation-hash.ts` |
| Server action rewritten as an orchestrator: load → criteria → download → hash → reuse unless `force` → lock → read files → evaluate → store; failures recorded on the run; fallback when proposal 0034 is absent (limitations kept as "points to check"); new `rejectAiSuggestion`; clear message when accepting a rejected result | `src/features/assessments/question-evaluation-actions.ts` |
| In-process lock per submission + question (stale after 5 min; a released old holder cannot free a newer lock) | `src/services/evaluation/run-lock.ts` |
| Prompt starts with `TASK ID` / `QUESTION ID`; system prompt asks for limitations; `evaluationConfidence` (high/medium/low + reasons from recorded facts); `questionEvaluationState` (6 states) | `src/lib/domain/question-evaluation.ts` |
| Schema-mismatch warning includes zod's type message (types only, never content) for diagnosis | `src/services/ai/provider.ts` |

## 3. Employer review UI

`src/app/company/applications/[id]/question-review.tsx`, `question-views.ts`, `page.tsx`:
- status column and badge per question (Not evaluated / Reading files / Evaluating / Completed / Failed / Requires
  human review); live phase while running (polls `/api/company/evaluation-state` when 0034 is applied; Server Actions
  are dispatched one at a time per client, so polling is a Route Handler);
- "Nothing changed since the evaluation of …" notice with "Re-evaluate anyway" / "Keep the stored result";
- failure message (persisted with 0034) with "the previous result below is unchanged";
- confidence badge with reasons, "Limitations stated by the evaluator";
- "Reject this AI suggestion" with a required reason (only when 0034 is applied); rejected result struck through in the
  overview, "Start from the AI suggestion" hidden, history shows "AI suggestion rejected: <reason>";
- all copy in English and Arabic, no trailing periods, existing tokens and components only.

New route: `src/app/api/company/evaluation-state/route.ts` (read-only, RLS, same access rules as the page).
Health: `/api/health` → `ai_evaluation_reliability: ready | not_applied | unknown`.

## 4. Proposal 0034 (NOT applied) — `supabase/proposals/0034_ai_evaluation_reliability.sql`

- `assessment_ai_runs` (+ unique partial index = database lock; stale runs closed after 5 minutes), RPCs
  `begin_ai_question_run`, `update_ai_question_run`;
- `assessment_ai_evaluations`: `run_id`, `limitations`, `confidence`, `confidence_reasons`, `evaluator_version`;
  `record_ai_question_evaluation` stores them and completes the run atomically;
- `assessment_ai_rejections`, `reject_ai_question_evaluation`; review source `ai_rejected`; history action
  `ai_rejected` (`evaluation_id` becomes nullable); `review_assessment_question` refuses a rejected result;
- grants: authenticated + service_role only; read policies company-only. Rollback steps in the header.
- **Impact if applied:** additive; existing rows unchanged; the app starts using persisted states and rejection
  immediately (no deploy needed beyond this code). Same caller rule as 0033 (any recruiter of the company; see P2-4).

`tests/db/run-local.sh` gained `WITH_PROPOSALS=...`; test: `tests/db/proposals/0034_ai_evaluation_reliability.test.sql`.

## 5. Verification tooling

`scripts/verify/evaluate-fixtures.ts`: live file reading + evaluation of the fixtures with the configured provider,
no database; options `--only <text>`, `--repeat <n>`; JSON report in `docs/evidence/ai-evaluation/`.

## 6. Documentation

`docs/EVALUATION.md` (new section; `.doc` contradiction fixed: legacy Word is read, `.xls` is not),
`handover/JADARAH-HANDOVER.md`, `JADARAH-REMAINING-WORK.md`, `JADARAH-TEST-REPORT.md`, `JADARAH-SETUP-WINDOWS.md`,
`ENVIRONMENT-REFERENCE.md`, `NEXT-AGENT-MASTER-PROMPT.md`, this file.

## 7. Results (all actually run; see `JADARAH-TEST-REPORT.md`)

typecheck 0 errors · lint clean · unit **161/161** · SQL 3 PASS, and 4 PASS with 0034 · build pass · route smoke 401 ·
live harness **25 PASS / 0 FAIL / 2 BLOCKED** (Groq; JPEG + scanned PDF need Gemini).

## 8. Known limitations

- Not run in a browser against a database (no credentials or local Supabase in this environment).
- Proposal 0034 tested on plain PostgreSQL with the Supabase shim, not through PostgREST.
- JPEG / scanned-PDF OCR still unverified live (Gemini key needed).
- Without 0034, the "in progress" and "failed" states are not persisted (a failure is shown until the page is
  refreshed) and the lock covers one server instance only.
