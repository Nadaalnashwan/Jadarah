# JADARAH — Master handover

Prepared on 2026-11-12. This document describes the project as it is in the archive `JADARAH-FULL-HANDOVER.zip`. It is
written so a new developer or AI agent can continue without the original conversation. Companion documents (same
folder): `JADARAH-REMAINING-WORK.md`, `JADARAH-SETUP-WINDOWS.md`, `ENVIRONMENT-REFERENCE.md`,
`JADARAH-TEST-REPORT.md`, `JADARAH-DEMO-DATA-PLAN.md`, `JADARAH-DEPLOYMENT-GUIDE.md`, `NEXT-AGENT-MASTER-PROMPT.md`.
Existing in-repo references that remain valid: `README.md`, `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`,
`TESTING.md`, `DEPLOYMENT.md`, `LOCAL-SETUP.md`, `docs/EVALUATION.md`, `docs/BRAND_COLORS.md`, `docs/NAVIGATION.md`,
`docs/MONITORING.md`.

---

## 0. Project versions — which one is the latest

| What | Location | Branch | Commit | Notes |
|---|---|---|---|---|
| GitHub remote | github.com/Nadaalnashwan/Jadarah | `feature/jadarah-product-experience` | `e08fc66` | Last pushed state. Nothing after it was pushed (owner instruction: do not push). |
| Original local project | `/home/user/Jadarah` (cloud container) | `feature/jadarah-product-experience` | `3ce9690` | 2 local commits ahead of the remote (`1243b82` design identity + 3D film, `3ce9690` violet signature). Clean working tree. Must not be overwritten. |
| **Latest working project** | `/home/user/jadarah-premium` (git worktree of the same repository) | **`preview/premium-redesign`** | **see `git log -1` in the archive** (handover commit on top of `858c8c9`) | Contains everything below. All work committed; no uncommitted changes. |
| Other local branches | — | `feature/jadarah-greenfield-build`, `claude/bold-franklin-mlzpas` | `0fceeed` | Older; unchanged. |

Commits on `preview/premium-redesign` after the remote base `e08fc66` (oldest first):

```
1243b82 feat(design): coherent visual identity, navy ink layer, living 3D city film, period-free copy
3ce9690 feat(design): subtle violet signature across the interface and the 3D city
e580a62 feat(design): premium redesign preview — warm editorial light, luminous indigo dark, purple portal identity
963bdfb fix(design): remove background logo watermarks and decorative portal graphics behind content
53cb6f6 fix: interview classification, calendars, job publishing, task solution files, softer portal, brand fonts
797a24c perf: fewer sequential round trips per page; WebGL setup after first paint
ac3ec1a docs: LOCAL-SETUP.md for Windows 11 (replaces PREVIEW-SETUP.md)
403508f Task solution files: health check, applied-migration docs, E2E check
23cb8c6 health: report unknown (not pre-0029/ready) when a probe times out or fails unexpectedly
5e2484f Question-level task evaluation: per-question files, rubrics, AI evaluation and scoring
3e6db73 Question-level evaluation: never alter tasks locked after assignment; map their rubric to tasks read-only
eb32e19 Question-level evaluation: inert leaving question, docs, live E2E script
91284e3 File extraction: legacy .doc text, explicit password-protected / empty / damaged reporting
858c8c9 tests: damaged legacy .doc is reported as failed (real .doc files are now read)
(+ handover documents commit)
```

To recreate the branch from the archive: the archive is a plain source export (no `.git`). The authoritative history
lives in the container repository above; if it is gone, initialise a new repository from the archive and record the
commit list above in the first commit message.

---

## A. Project overview

**Jadarah (جدارة, "merit/competence")** is a bilingual (Arabic-first, English) skills-based hiring platform for Saudi
Arabia. Employers hire on *demonstrated* skills: every job can carry a practical task (assessment), candidates prove
skills by completing it, and the employer reviews evidence, interviews and decides. AI assists (CV reading, matching
explanations, assessment building, evaluation suggestions) but never decides.

- **Target users:** candidates (students, graduates, professionals), employers (company admins, recruiters,
  interviewers), the platform's super admin.
- **Business model:** B2B subscriptions for organisations (approval + active subscription gate all employer services;
  see migration 0020 `company_service_active()`); candidates use the platform free.
- **Candidate experience:** sign up → onboarding → profile and CV (AI-extracted, candidate-confirmed) → discover jobs
  with explainable match → apply (answer job questions) → complete the job's practical task (timed attempt, autosave,
  per-question answers and solution files) → track application, calendar (interviews and task deadlines) → interviews
  (video via Daily) → results and shared feedback; career path / exploratory tasks / AI assistant.
- **Employer experience:** organisation registration (approval by super admin, subscription) → team invitations →
  jobs (create, link a practical task, publish) → applications pipeline with evidence match → assign assessments →
  review each question (AI suggestion + human decision) → shortlist → schedule interviews (internal calendar,
  conflict checks) → interview rubric evaluations → final evaluation and decision → feedback to candidate.
- **Admin experience:** control centre, organisation approval queue, subscriptions and catalogue listing, users,
  audit log, AI/system monitoring.
- **Main workflows:** apply → task → review → shortlist → interview → final evaluation → hire/reject; the status
  machine is enforced in the database (`application_transition_allowed`, `_transition_application`).

## B. Technical architecture

| Layer | Technology |
|---|---|
| Frontend + backend | **Next.js 16.4.6** (App Router, Server Components, Server Actions, Route Handlers, `src/proxy.ts` as middleware), **React 19.3**, TypeScript 5, Tailwind CSS 4.3 (`@theme inline`), Motion 14, Radix UI, Sonner, Recharts. Read `node_modules/next/dist/docs/` before changing framework code (AGENTS.md: this Next.js version has breaking changes). |
| Database | **Supabase Postgres** (hosted project ref `qqvvlornhvfykusaxaid`), RLS on every table, business rules in SQL functions (`security definer`, `search_path = ''`), pg_cron housekeeping, pgvector embeddings. |
| Auth | Supabase Auth (email/password, PKCE, email confirmation). Session read with `supabase.auth.getClaims()` (`src/lib/auth/session.ts`); roles from `user_roles` + `company_memberships`. |
| Storage | Supabase Storage, private buckets: `candidate-cvs`, `candidate-certificates`, `candidate-projects`, `assessment-attachments`, `assessment-materials`, `company-documents`, `interview-attachments`, plus company identity assets. Access through `can_read/can_write/can_delete_storage_object` policies; downloads through short-lived signed URLs. |
| AI | Provider-agnostic layer `src/services/ai/provider.ts` + routing `src/services/ai/config.ts`: Gemini, OpenAI, Groq with per-task routes (fast / structured / deep), fallback chain, retries, shared cooldowns, schema validation (Zod) with one repair pass, logging to `ai_provider_logs`. |
| Video | Daily.co rooms (`src/services/daily.ts`), webhook ingest `src/app/api/webhooks/daily` (needs `DAILY_WEBHOOK_SECRET`). |
| Email | Outbox table + dispatcher `src/app/api/internal/email/dispatch` (SMTP or Resend; not configured in the current environment). |
| 3D | Three.js 0.180 Riyadh city on the landing page (`src/features/landing/city/scene.ts`, `city-stage.tsx`, `scene-chapters.ts`), deferred after first paint, adaptive DPR, respects `prefers-reduced-motion`. Must be preserved. |
| Hosting | Not deployed. `DEPLOYMENT.md` and `JADARAH-DEPLOYMENT-GUIDE.md` describe the intended setup (Vercel or any Node host + Supabase). |

**Directory map**

| Path | Purpose |
|---|---|
| `src/app/(marketing)` | Public landing (3D city film), jobs board, companies, about. |
| `src/app/(auth)`, `src/app/auth` | Sign-in/up, callbacks, password reset. |
| `src/app/candidate/*` | Candidate area: dashboard, discover, jobs, applications, assessments (attempt + results), calendar, interviews, career, assistant, profile, settings. |
| `src/app/company/*` | Employer area: dashboard, jobs, applications (review incl. `question-review.tsx`, `question-views.ts`, `panels.tsx`), assessments (builder), interviews & calendar, analytics, assistant, settings/team. |
| `src/app/admin/*` | Super admin: control centre, approvals, subscriptions, users, audit, monitoring. |
| `src/app/api/*` | `health`, `assistant`, `webhooks/daily`, `internal/email/dispatch`. |
| `src/features/*` | Server actions and client components per domain (`assessments/question-evaluation-actions.ts`, `assessments/file-actions.ts`, `assessments/file-answer.tsx`, `company/actions.ts`, `calendar`, `interviews`, …). |
| `src/services/*` | Server services: `ai/*` (provider, CV, builder, recruiting), `evaluation/extract.ts` (file reading), `daily.ts`, `email`, `final-evaluation.ts`, `semantic.ts`. |
| `src/lib/domain/*` | Pure, unit-tested domain logic: scoring, question evaluation, calendar/interview phase, listings visibility, application status, matching. |
| `src/lib/zip/safe-zip.ts` | In-memory defensive ZIP reader. |
| `src/lib/upload/*` | Upload rules (types, sizes, MIME aliases) and client upload with progress. |
| `src/components/*` | UI primitives (`ui/`), brand (`brand/logo.tsx`, `portal-art.tsx`), app shell. |
| `src/app/globals.css` | Design tokens: warm editorial light theme, luminous indigo dark theme (see `docs/BRAND_COLORS.md`). |
| `supabase/migrations` | Applied schema (see section C). `supabase/proposals` = NOT applied proposals. `supabase/seed` = demo seed function. |
| `tests/unit`, `tests/integration`, `tests/db`, `tests/e2e` | Vitest unit/integration, SQL tests (`tests/db/run-local.sh`), Playwright. |
| `scripts/*` | Admin provisioning, demo seed/reset, AI verification, embeddings, imports, `verify/*` live E2E scripts. |

## C. Database and data model

Core tables (all RLS-protected): `profiles`, `user_roles`, `company_profiles`, `company_memberships`,
`company_invitations`, `company_subscriptions`, `candidate_profiles`, `candidate_skills`, `candidate_documents`,
`skills`, `jobs`, `job_skills`, `job_application_questions`, `applications`, `application_answers`,
`application_status_history`, `application_notes`, `assessments`, `assessment_questions`, `assessment_options`,
`assessment_rubrics`, `assessment_assignments`, `assessment_submissions`, `assessment_answers`,
`assessment_answer_files`, `assessment_ai_evaluations`, `assessment_evaluations`, `assessment_evaluation_history`,
`assessment_assessor_guides`, `assessment_materials`, `interviews`, `interview_participants`, `interview_attendance`,
`interview_attachments`, `interview evaluations / final evaluations` (0019), `notifications`, `notification_preferences`,
`email_outbox`, `audit_log`, `ai_provider_logs`, `ai_analysis_records`, `ai_generation_records`, embeddings tables.

Key relationships:
- **Roles:** `user_roles` (candidate / super_admin) and `company_memberships(company_id, user_id, role ∈ company_admin,
  recruiter, interviewer, status)`. Helpers: `is_super_admin()`, `has_company_role()`, `can_recruit()`,
  `company_service_active()`.
- **Jobs & applications:** `jobs(company_id, status, listing_type, assessment_id)` → `applications(job_id,
  candidate_id, company_id, status, requires_task, task_assignment_id)`; one application per candidate per job.
  Candidate visibility of a job: `can_view_job` requires published + company approved **and `company_profiles.listed`**
  (see known issue in section D).
- **Assessments:** `assessments` → `assessment_questions(position, type, points = weight, config.deliverables,
  rubric_id)` → `assessment_rubrics(criteria jsonb, question_id, derived_from)`; `assessment_assignments(assessment,
  application, candidate, company)` unique per (assessment, candidate, application) → one `assessment_submissions` row
  → per question `assessment_answers` (unique submission+question), `assessment_answer_files` (submission_id,
  question_id; `kind` answer/solution), `assessment_ai_evaluations` (append-only), `assessment_evaluations` (human,
  unique submission+question; `source` human / ai_accepted / ai_adjusted), `assessment_evaluation_history`.
- **Interviews & calendar:** `interviews(application_id, company_id, scheduled_at, ends_at, status, video_room_name)`,
  `interview_participants`, `interview_attendance`, `interview_attachments`; calendars are derived views of interviews
  and assignment due dates (no separate events table). Double booking prevented in SQL (0017).
- **Constraints worth knowing:** content of a practical task is locked once assigned (`lock_assigned_task_content`
  trigger, 0025); application status transitions validated in SQL; storage paths must start with the owner's id and
  match the question/submission (0029/0033); MIME allow-list and 20 MB limit on `assessment-attachments`.
- **RLS summary:** candidates see only their own rows; companies only their own applications and submissions;
  interviewers only assigned interviews; AI evaluations, reviewer notes and history are company-only; anonymous users
  see only the public catalogue. Tests in `tests/integration/security.test.ts` and `tests/db/*.test.sql`.

**Migrations — applied state verified on 2026-11-12 by reading `supabase_migrations.schema_migrations` on the hosted
project.** The ledger records MCP timestamps, not the repository file names:

| Repo file | Applied? | Ledger entry |
|---|---|---|
| 0001–0012 (`core_identity` … `fix_submit_assessment`) | Applied | `20261110191944 core_identity` … `20261110203309 fix_submit_assessment` |
| 0013 `semantic_embeddings` | Applied | `20261110235108` |
| 0014–0019 | Applied | `ai_record_kinds`, `fix_assessment_insert_returning`, `internal_calendar`, `fix_interview_double_booking`, `video_interviews`, `final_evaluation` |
| 0020–0024, 0026 | Applied | `20261111000020` … `20261111000026` |
| 0025 `product_experience` | Applied | `20261111065229 product_experience` + `20261111070120 product_experience_embed_fix` |
| 0027 `public_exploration_preview` | Applied | `20261111071633` |
| 0029 `platform_completion` | **Applied 2026-11-12** (owner approved) | `20261112061024 platform_completion` |
| 0032 `task_solution_files` | **Applied 2026-11-12** (owner approved) | `20261112061323 task_solution_files` |
| 0033 `question_level_evaluation` | **Applied 2026-11-12** (owner approved) | `20261112072336 question_level_evaluation` |
| `supabase/proposals/0028_function_execute_hardening.sql` | **NOT applied** | — (app falls back when `assessment_in_use_for_manager` is missing) |
| `supabase/proposals/0030_workflow_cv_listings.sql` | **NOT applied** | — |
| `supabase/proposals/0031_monitoring.sql` | **NOT applied** (local only) | — |
| `supabase/proposals/0032_job_visibility_without_catalogue.sql` | **NOT applied** (name clashes with migration 0032; it is a separate proposal) | — |

Do not re-apply 0029/0032/0033 with `scripts/import/apply-migration.ts`: that script checks the file version, which is
not in the ledger, and would run them again.

Storage buckets: see section B; `assessment-attachments` is private, 20 MB, MIME allow-list (pdf, png, jpeg, webp, zip,
txt, csv, json, xls, doc, docx, xlsx, pptx).

## D. Current implementation status

Status legend: **Verified** = completed and verified by a test run listed in `JADARAH-TEST-REPORT.md`; **Implemented,
not fully tested**; **Partial**; **Blocked**; **Not implemented**.

| # | Feature | Status | Relevant files | DB deps | API/external deps | Tests performed | Remaining work / limitations |
|---|---|---|---|---|---|---|---|
| 1 | Authentication | Verified (sign-in used by every live test on 2026-11-12; sign-up/confirmation/reset verified 2026-11-10) | `src/app/(auth)`, `src/lib/auth/session.ts`, `src/proxy.ts` | profiles, user_roles | Supabase Auth, SMTP for emails | Playwright 11/11 (11-10), live E2E sign-ins (11-12) | Email delivery depends on Supabase/SMTP config. |
| 2 | Candidate dashboard | Implemented, not fully tested (renders; measured) | `src/app/candidate/page.tsx` | applications, assignments | — | Visual sweeps, latency measurement | Metrics not individually verified against records. |
| 3 | Employer dashboard | Implemented, not fully tested | `src/app/company/page.tsx` | `company_dashboard_stats` | — | Visual sweeps, latency | Same as above. |
| 4 | Admin dashboard | Partial | `src/app/admin/*` | audit, subscriptions | — | Playwright (11-10) | Monitoring extras need proposal 0031 (not applied). |
| 5 | Job creation | Implemented, verified at DB level | `src/features/company/actions.ts` (`saveJob`) | jobs, job_skills | — | Rolled-back SQL check as real roles (11-12) | UI creation not re-run in a browser after the fix. |
| 6 | Job publishing | Partial | `setJobStatus`, `src/app/company/jobs/page.tsx` | `can_view_job` | — | Rolled-back SQL check | Published jobs are hidden from candidates unless the company is `listed` (6 approved companies unlisted). Owner decision pending: apply proposal `0032_job_visibility_without_catalogue.sql` or list the companies. |
| 7 | Job discovery | Implemented, not fully tested | `src/services/discovery.ts`, `src/lib/domain/listings.ts` | jobs | embeddings (optional) | Unit `job-visibility.test.ts` | Expired deadlines filtered (Asia/Riyadh). |
| 8 | Applications | Verified (pipeline integration tests 11-10; used live 11-12) | `src/app/company/applications/*`, `src/app/candidate/applications/*` | applications, status history | — | Integration + live E2E | — |
| 9 | Calendar | Implemented, not fully tested | `src/app/candidate/calendar/page.tsx`, `src/components/app/interview-calendar.tsx` | interviews, assignments | — | Unit calendar tests, visual checks | No browser E2E of both calendars with fresh data. |
| 10 | Interview scheduling | Implemented, partially tested | `src/features/interviews`, `src/features/calendar` | interviews, participants | Daily.co | Integration (11-10) | Daily webhooks not configured (`DAILY_WEBHOOK_SECRET`). Schedule demo interviews only when the demo date/time is confirmed. |
| 11 | Interview history classification | Verified (unit) | `src/lib/domain/calendar.ts` (`interviewPhase`, `splitInterviews`) | interviews.ends_at | — | `interview-phase.test.ts` | — |
| 12 | Task assignment | Verified (live UI, 11-12) | `assignAssessment` in `src/features/company/actions.ts` | `assign_assessment` | — | Live E2E | — |
| 13 | Task question management | Implemented, not fully tested | `src/app/company/assessments/[id]/*`, `src/features/assessments/company-actions.ts`, `builder-actions.ts`, `src/services/ai/assessment-builder.ts` | questions, rubrics | AI builder | Unit `assessment-quality.test.ts` | Builder now writes one rubric per question; the AI builder was not re-run end to end after that change. |
| 14 | Task file attachments (per question) | Verified (live, 11-12) | `src/features/assessments/file-answer.tsx`, `file-actions.ts`, `attempt.tsx` | 0029/0032/0033 | Storage | Live E2E (user's PDF; 4 files on 3 questions), SQL tests | Old submission-level "solution" files are shown as "not linked to a question". |
| 15 | File extraction | PDF text, DOCX, ZIP, PNG (AI) **verified live**; DOC, password/empty/damaged handling **verified with real files locally**; JPEG and scanned-PDF OCR **implemented, not verified live** | `src/services/evaluation/extract.ts`, `src/lib/zip/safe-zip.ts` | — | Gemini (OCR) | Unit + live | `.xls` unsupported; code not executed; limits documented in `docs/EVALUATION.md`. |
| 16 | AI question-level evaluation | Verified live (29/29 on 2026-11-12) **using fallback model `gemini-3.5-flash`** | `src/features/assessments/question-evaluation-actions.ts`, `src/lib/domain/question-evaluation.ts` | 0033 | Gemini/OpenAI | Live E2E, unit, SQL | OpenAI quota exhausted; primary Gemini model overloaded during the test. Missing: duplicate-run prevention, persisted pending/failed states, explicit confidence field, task id in the prompt (see remaining work). |
| 17 | Overall score calculation | Verified | `_recompute_submission_score` (0033), `aggregateQuestionScores` | 0033 | — | SQL + unit + live | — |
| 18 | Employer evaluation review | Verified (live UI) | `src/app/company/applications/[id]/question-review.tsx` | 0033 | — | Live E2E | No separate "reject AI" button (reviewer can score independently). |
| 19 | Candidate feedback | Verified (live UI) | `src/app/candidate/assessments/[id]/page.tsx`, `get_assessment_result` | 0033 | — | Live E2E | Shown only after the company shares feedback. |
| 20 | Notifications | Partial | `src/features/notifications`, `email_outbox` (0029) | notifications, email_outbox | SMTP/Resend, `JADARAH_SERVER_KEY`, `CRON_SECRET` | Not tested on 11-12 | Email provider and server key not configured → in-app only. |
| 21 | Search & filtering | Implemented, not fully tested | `src/lib/admin-filters.ts`, discovery | — | — | Not re-tested | — |
| 22 | Three.js Riyadh experience | Verified (visual, previous sessions) | `src/features/landing/city/*` | — | WebGL | Screenshot sweeps, reduced-motion check | Long tasks under software GL; must never be removed. |
| 23 | Light theme | Verified | `src/app/globals.css` | — | — | Contrast script, sweeps | — |
| 24 | Dark theme | Verified | same | — | — | same | — |
| 25 | Arabic and English | Verified (sweeps; candidate flow tested in Arabic live) | `src/lib/i18n/*` | — | — | Sweeps, live E2E | — |
| 26 | Performance | Partial | `797a24c` | — | — | Interleaved measurements (−16% sum of medians) | Public `/jobs` and `/admin` not improved; landing long tasks unchanged. |
| 27 | Deployment readiness | Not deployed | `DEPLOYMENT.md`, `JADARAH-DEPLOYMENT-GUIDE.md` | — | Hosting, domain | Production build passes | Server key, email, webhooks, hosting, domain all pending. |

## E. AI evaluation engine (detail)

See `docs/EVALUATION.md` for the full design. Facts verified on 2026-11-12:

- **Provider configuration** is read in `src/services/ai/config.ts` (`providerConfig`, `ROUTES`, `OPERATION_TASK`) from
  `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `GROQ_API_KEY`,
  `GROQ_MODEL`, `AI_TIMEOUT_MS`, `AI_STRICT_ROUTING`.
- **Operations:** `assessment_evaluation` → task `deep` → route OpenAI → Gemini → Groq. `assessment_file_reading`
  (OCR of scanned PDFs and images) → `structured`, and files force Gemini (only multimodal provider wired).
- **What actually ran in the live test** (`ai_provider_logs`, last 3 h): OpenAI `gpt-6.1-sol` →
  `openai_quota_exhausted` (2×); Gemini `gemini-3.8-flash` → `gemini_overloaded` (2×); **all successful evaluations
  and transcriptions ran on `gemini-3.5-flash`** (`GEMINI_FALLBACK_MODEL`): 6 evaluation calls (5,740 input / 6,451
  output tokens, avg 6.4 s) and 2 transcription calls (2,418 / 417 tokens, avg 7.9 s).
- **Trigger:** server action `evaluateQuestionWithAI(applicationId, submissionId, questionId)` from the employer review
  UI ("Evaluate this question with AI"). There is no batch endpoint; each question is evaluated separately.
- **File extraction:** `extractSubmittedFile` in `src/services/evaluation/extract.ts` (PDF `unpdf`; scanned PDF and
  images → Gemini transcription labelled as AI; DOCX `mammoth`; DOC `word-extractor`; PPTX/XLSX XML text; ZIP via
  `safe-zip.ts`; text formats as UTF-8; type checked against magic bytes).
- **File ↔ question:** storage path `<candidate>/<submission>/<question>/<file>`, enforced by storage policy and
  `register_assessment_file`; evaluation selects `assessment_answer_files` by `submission_id` AND `question_id`.
- **Question id in evaluation:** the action loads exactly one question by id; the prompt includes the question number,
  type, points, instructions, deliverables and criteria (the raw ids are not written into the prompt text).
- **Rubric construction:** `questionCriteria()` — question's own rubric → assessment-wide rubric narrowed by the
  builder's task mapping → assessment-wide rubric labelled shared → AI-derived criteria labelled "AI-suggested".
- **Scores:** per criterion, clamped, scaled to question points; quotes verified against the submission
  (`evidenceFound`); overall = Σ approved question scores / Σ points (`_recompute_submission_score`).
- **Persistence:** `record_ai_question_evaluation` → `assessment_ai_evaluations`; human decision →
  `review_assessment_question` → `assessment_evaluations` + `assessment_evaluation_history`; audit log entries.
- **Failures and retries:** provider chain with retry on retryable errors and same-provider backup model; per-call
  timeout from `AI_TIMEOUT_MS` (evaluation asks for ≥ 60 s); overall deadline 3× timeout; 20 AI calls/min per user
  (memory rate limiter because `JADARAH_SERVER_KEY` is not set). A failed evaluation is shown as an error toast and is
  **not persisted**; nothing changes the score.
- **Employer review:** question-by-question panel; "Start from the AI suggestion", adjust, private notes, candidate
  feedback; source and history recorded.
- **Candidate feedback:** per-question approved score, files and feedback (after sharing); never AI internals.
- **Does the AI really read files?** Yes for PDF (text layer), DOCX, ZIP source files and PNG (AI transcription),
  verified on production with real files and the configured provider on 2026-11-12. Not yet verified live: JPEG,
  scanned PDF OCR, DOC (verified locally without AI), PPTX/XLSX.

## F. Production test records created during verification (demo accounts only)

On 2026-11-12, with owner approval, live tests created records for demo company **Nawat Technologies** and demo
candidate **candidate01** (application `1ac063fd-b765-4fa4-b0d1-068b8654d1d6`):
- assignments of library assessments *Communication Skills* (2 PDF copies), *Critical Thinking* (1), *AI Fundamentals*
  (1) with the owner's `UX_Friction_Analysis_Report.pdf`; *Problem Solving* (started, no files);
- three company assessments titled `QE test … orders platform`: `6b5e7fce-…` (evaluated; its typed answers are shifted
  one question by a test-script timing issue), `157b0bf6-…` (published, never assigned), `748f2394-…` (clean,
  evaluated: 22/34 = 64.71 %), with files, AI evaluations, reviews and history.
They are tagged by title and demo accounts. Remove them only with owner approval (see `JADARAH-DEMO-DATA-PLAN.md`).

## G. Standing rules from the owner

- Do not push to GitHub without explicit approval. Do not force-push, reset or delete branches.
- Do not overwrite or modify the original project `/home/user/Jadarah`; deliver work as separate copies/ZIPs.
- Do not modify production data or apply migrations without explicit approval.
- Never invent credentials, never expose secrets, never commit `.env*` files with values.
- Do not use mock data or fake AI results to pretend integrations work; never claim untested results.
- Keep the Three.js Riyadh 3D experience; improve, never remove. No logo watermarks behind content.
- Copy: no trailing periods in UI strings (both languages).
- Demo seeding is **on hold** until AI evaluation is verified end to end (it was verified on 2026-11-12 with the
  fallback model; confirm with the owner before seeding).
