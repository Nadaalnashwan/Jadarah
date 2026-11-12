# JADARAH — Test and verification report

Only tests that were actually executed are reported. **Environment** for 2026-11-12 runs: Linux cloud container,
Node 22.23, Chromium (Playwright), the app built with `next build` and served with `next start` on `localhost:3300`,
against the **hosted Supabase project** (`qqvvlornhvfykusaxaid`) using demo accounts. SQL tests use a throwaway local
PostgreSQL 16 (+ pgvector). Earlier results (2026-11-10) are taken from `TESTING.md` and are labelled as such.

## Static checks and automated suites (latest code: branch `preview/premium-redesign`, commit `858c8c9` + handover docs)

| Check | Command | Result | Date |
|---|---|---|---|
| TypeScript | `npm run typecheck` | Pass (0 errors) | 2026-11-12 |
| Lint | `npm run lint` | Pass (0 errors, 0 warnings) | 2026-11-12 |
| Unit tests | `npm test` | **129/129 passed**, 16 files (incl. `question-evaluation.test.ts` 25, `extraction-formats.test.ts` 6) | 2026-11-12 |
| SQL tests | `bash tests/db/run-local.sh` | **PASS** `0029_platform`, `0032_task_solution_files`, `0033_question_level_evaluation` | 2026-11-12 |
| Production build | `npm run build` | Pass | 2026-11-12 |
| Clean-copy package check | extract ZIP → `npm ci` → typecheck → lint → unit → SQL → build → `next start` → `/api/health` | Pass (see the final section of this report) | 2026-11-12 |
| Integration tests (`tests/integration`) | `npm run test:integration` | **Not run on 2026-11-12** (they write to the configured project). Last recorded: 30/30 on 2026-11-10 (`TESTING.md`) | 2026-11-10 |
| Playwright suite (`tests/e2e`) | `npm run test:e2e` | **Not re-run after the evaluation work.** 11/11 on 2026-11-10 (`TESTING.md`). Landing/public specs were run during the 2026-11-11/12 redesign (strict-mode selector fixes; one SwiftShader flake passed on retry) | 2026-11-11/12 |

## Live end-to-end verifications (real UI, hosted database, demo accounts)

### Task Solution Files upload (owner's file `UX_Friction_Analysis_Report.pdf`, 72,204 B)

`scripts/verify/task-solution-files-e2e.cjs` passed **24/24, twice**:
- the UI upload completes and the object is stored with identical bytes (SHA-256 `4c7ca7b6…8b24`);
- the metadata row is correct; the file survives a refresh;
- submission is recorded with a timestamp; no uploads or removals after submission;
- the same-company employer downloads identical bytes through a signed URL;
- another company's recruiter and admin, another candidate and anonymous users are all denied;
- the bucket has no public URL and tampered signed URLs are refused;
- `.exe` and 21 MB files are refused in the UI and by Storage.

Root cause fixed: migrations 0029/0032 were missing on the hosted project.

### Question-level evaluation

`scripts/verify/question-evaluation-e2e.cjs`, final run **29/29** (2026-11-12, assessment `748f2394-…`). A first run
passed 28/28, but its test script typed answers during a question transition, so each typed answer landed one
question late. The product fix (the outgoing question is inert) and the test fix were made, and the run was repeated.

The task had 5 questions:
- Q1 case study, 10 points, employer rubric, PDF;
- Q2 coding, 10 points, employer rubric, a deliberately weak ZIP;
- Q3 long answer, 8 points, no rubric, DOCX + PNG;
- Q4 multiple choice, 2 points;
- Q5 long answer, 4 points, nothing submitted.

| Requirement | Result |
|---|---|
| Files persisted and mapped to their question id | Q1 `database_design.pdf`; Q2 `api_solution.zip`; Q3 `analysis_report.docx` + `revenue_chart.png`; none unlinked; the path carries the submission and question ids |
| Written answers on their own questions | Yes |
| Contents extracted | PDF text layer (`pdf_text`); ZIP entries `package.json`, `src/routes/orders.js`, `README.md` read; DOCX (`docx`); PNG transcribed (`image_ai`) |
| Each question evaluated independently | 4 AI results (Q1, Q2, Q3, Q5); none for the objective Q4 |
| Correct criteria per question | Q1: `schema_correctness, indexing, normalisation`; Q2: `endpoint, validation, tests`; Q3: AI-derived criteria (labelled) totalling 8 |
| Feedback references the actual content | Q1 quotes from the PDF (verified); Q2 cites the missing validation, HTTP 200 instead of 201, no tests; Q3 cites 15.0 %, 10.0 %, 12.5 % |
| Scores reflect quality | AI: Q1 **10/10**, Q2 **1/10**, Q3 **8/8**, Q5 **0/4 (no submission)** |
| Missing requirements | Q2: validation (UUID, positive integer), 400 response, 201 response, automated tests |
| Nothing submitted | Q5 recorded as `no_submission`, suggested 0, no AI call |
| Persistence | `assessment_ai_evaluations`, `assessment_evaluations` (sources: `ai_accepted` Q1, `ai_adjusted` Q2 from 1 to 2), history rows with timestamps; the AI result is unchanged after adjustment |
| Overall score | Auto 2 (Q4) + reviewed 20 = **22/34 = 64.71 %**, matching Σ approved / Σ points |
| Employer UI after refresh | The overview table shows each question's own AI suggestion and approved score |
| Candidate report | Per-question approved scores, files and feedback (after sharing); no reviewer notes or model names |
| Isolation | Q1's result contains nothing from Q2/Q3; another company sees no AI evaluations |

Provider actually used (from `ai_provider_logs`):
- OpenAI `gpt-6.1-sol`: `quota_exhausted`;
- Gemini `gemini-3.8-flash`: `overloaded`;
- every successful call ran on **`gemini-3.5-flash`**.

Time per question in the UI, final run: Q1 17.9 s, Q2 13.2 s, Q3 15.7 s (includes the PNG transcription), Q5 5.3 s (no AI call). Token use was 5,740 input / 6,451 output across 6 evaluation
calls, and 2,418 / 417 across 2 transcription calls.

## Feature checks

| Area | Procedure | Result | Date | Limitations |
|---|---|---|---|---|
| Authentication | Sign-in of 6 demo roles in the live scripts; sign-up/confirmation/reset (`TESTING.md`) | Pass | 11-12 / 11-10 | Email delivery not configured here |
| Candidate workflow | Start task, answer, upload per question, submit, view results (live, Arabic and English) | Pass | 11-12 | Discover/apply not re-run on 11-12 |
| Employer workflow | Assign assessment, AI-evaluate, review, share feedback (live) | Pass | 11-12 | Job creation UI not re-run after the fix |
| Admin workflow | Playwright control centre / approvals / audit | Pass | 11-10 | Not re-run |
| File upload | See above | Pass | 11-12 | — |
| File extraction | Live: PDF, DOCX, ZIP, PNG. Local real files: DOC text, password-protected PDF, image-only PDF, JPEG, empty, damaged, mislabelled, encrypted ZIP entries | Pass | 11-12 | JPEG and scanned-PDF OCR not run against the AI provider |
| AI evaluation / question-level grading | See above | Pass (fallback model) | 11-12 | Primary models unavailable |
| Calendar | Unit (`calendar.test.ts`); visual check of both calendars | Pass | 11-12 | No live calendar E2E with new events |
| Interview classification | Unit (`interview-phase.test.ts`): upcoming / in progress / awaiting update / completed, Asia/Riyadh | Pass | 11-12 | — |
| Job publishing | Rolled-back SQL transaction as real roles: draft invisible, publish updates 1 row, listed company visible, unlisted invisible | Pass (behaviour documented) | 11-12 | Catalogue coupling decision pending |
| Performance | Interleaved baseline vs optimised (7 runs/page): sum of medians 20,038 → 16,748 ms (−16 %); candidate dashboard 2,053 → 1,423 ms; employer dashboard 1,652 → 1,090 ms; landing LCP 2,144 → 1,092 ms | Measured | 11-12 | Public `/jobs` +23 % and `/admin` +10 % (noise or regression, not resolved); landing long tasks ~4.1 s under software GL |
| Arabic / English | Screenshot sweeps of main pages; live candidate flow in Arabic | Pass | 11-11/12 | — |
| Light / dark themes | Contrast script (all text roles ≥ 4.5:1) + sweeps | Pass | 11-11/12 | — |
| Health endpoint | `/api/health` | `database ok`, `database_schema 0029`, `task_solution_files ready`, `question_evaluation ready`, `server_key missing`, `email not_configured`, `video_webhooks not_configured` | 11-12 | — |

## Not tested

- Integration suite and full Playwright suite after the evaluation work (2026-11-12).
- Live AI on JPEG, scanned PDF (OCR), DOC, PPTX/XLSX.
- Re-running the AI Assessment Builder after its per-question rubric change.
- Email delivery, Daily webhooks, notification emails.
- Local Docker Supabase (`supabase start`).
- Any deployment (nothing is deployed).
- Windows 11 setup (instructions written, not executed on Windows).

## Final package check (JADARAH-FULL-HANDOVER.zip)

Filled in after building the archive: see the end of the final summary in the conversation and `HANDOVER-ZIP-CHECK.txt`
inside the archive.
