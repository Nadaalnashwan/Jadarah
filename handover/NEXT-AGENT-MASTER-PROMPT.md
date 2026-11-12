# Master prompt for the next AI coding agent (copy everything below the line)

---

You are continuing development of **JADARAH** (جدارة), a bilingual (Arabic/English) skills-based hiring platform built
with Next.js 16.4.6 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4, Supabase (Postgres + RLS, Auth,
Storage), Three.js and a provider-agnostic AI layer (Gemini / OpenAI / Groq). Continue from the exact current state.
Do not repeat completed work.

## 1. Read first (in this order) before touching code

0. `handover/CHANGES-SINCE-b57ebca.md`: what the continuation session changed (read this first).
1. `handover/JADARAH-HANDOVER.md`: versions and branches, architecture, data model, the **applied-migrations table**
   (verified against the live ledger), feature status, AI engine facts, production test records, the owner's rules.
2. `handover/JADARAH-REMAINING-WORK.md`: the prioritised backlog (P0 → P3) with acceptance criteria.
3. `handover/JADARAH-TEST-REPORT.md`: what was actually tested, and what was **not**.
4. `docs/EVALUATION.md`: the question-level evaluation design.
5. `handover/ENVIRONMENT-REFERENCE.md`, `handover/JADARAH-SETUP-WINDOWS.md`,
   `handover/JADARAH-DEPLOYMENT-GUIDE.md`, `handover/JADARAH-DEMO-DATA-PLAN.md`.
6. `AGENTS.md`: this Next.js version has breaking changes. Read `node_modules/next/dist/docs/` before changing
   framework-level code.

## 2. Verify the starting point

- The latest work is the updated ZIP (or `/home/user/jadarah-work`, branch `feature/jadarah-product-experience`):
  remote `e08fc66` → `1c56654` (import of snapshot `b57ebca`) → continuation commits. The commits `b57ebca`,
  `858c8c9`, `3ce9690` no longer exist anywhere reachable (see `JADARAH-HANDOVER.md` section 0.1). If you only have the
  ZIP, initialise a repository from it. Never overwrite the owner's original project folder. GitHub has only `e08fc66`.
- Run, and expect these results:
  - `npm ci`;
  - `npm run typecheck` → 0 errors;
  - `npm run lint` → clean;
  - `npm test` → 161 passing;
  - `bash tests/db/run-local.sh` (Linux/WSL with PostgreSQL 16 + pgvector) → 3 PASS;
  - `WITH_PROPOSALS=0034_ai_evaluation_reliability.sql bash tests/db/run-local.sh tests/db/*.test.sql tests/db/proposals/*.test.sql` → 4 PASS;
  - `npm run build` → pass.

  If anything differs, stop and report.
- Check `/api/health` with the owner's `.env.local`: expect `question_evaluation: ready` and
  `ai_evaluation_reliability: not_applied` (until the owner approves proposal 0034).

## 3. Rules (from the owner; non-negotiable)

1. Inspect the actual code before editing. Preserve existing functionality: the Three.js Riyadh landing scene must
   stay (improve, never remove); no logo watermarks behind content; UI copy has no trailing periods.
2. **Never push to GitHub without the owner's approval.** Never force-push, reset, rebase shared branches or delete
   branches.
3. **Never modify production data or apply migrations to the hosted Supabase project (`qqvvlornhvfykusaxaid`) without
   explicit approval.** Read-only queries are fine. Migrations 0029, 0032 and 0033 are already applied there; do not
   re-apply them. Proposal 0034 is prepared and NOT applied.
4. Never invent credentials, never print or commit secrets, never commit `.env*` files with values.
5. No mock data or fake AI results to make features look working. Never claim a test result you did not run. Report
   failures with evidence.
6. Deliver work as ZIP archives when the owner asks; do not overwrite the original project.
7. Demo data seeding is **on hold** until the owner confirms the AI evaluation gate. Never seed production.
8. Deployment only after explicit approval.

## 4. What is already done (do not redo)

- Task files are attached **per question** (storage path `<candidate>/<submission>/<question>/<file>`, enforced by
  RLS + `register_assessment_file`).
- File extraction:
  - PDF text, DOCX, DOC (`word-extractor`), PPTX/XLSX text;
  - ZIP via the in-memory `src/lib/zip/safe-zip.ts`;
  - images and scanned PDFs via labelled Gemini transcription;
  - explicit failures for password-protected, empty, damaged and mislabelled files.
- Question-level AI evaluation (`src/features/assessments/question-evaluation-actions.ts`,
  `src/lib/domain/question-evaluation.ts`):
  - criteria precedence: own rubric → mapped assessment rubric → shared (labelled) → AI-derived (labelled);
  - verified quotes, per-criterion and per-requirement results;
  - append-only `assessment_ai_evaluations`.
- Human review with AI vs human source, history, candidate feedback; weighted overall score recomputed per question
  (migration 0033). Employer UI: `src/app/company/applications/[id]/question-review.tsx`; candidate:
  `src/app/candidate/assessments/[id]/page.tsx`.
- **Live verification on 2026-11-12: 29/29** (`scripts/verify/question-evaluation-e2e.cjs`): PDF, ZIP, DOCX + PNG on
  separate questions; scores 10/10, 1/10, 8/8, nothing-submitted 0/4; total 22/34 = 64.71 %.
- Also done: task solution upload fix; calendars (candidate + employer); interview upcoming/history classification
  (Asia/Riyadh); job publishing checks; performance pass; premium redesign; Windows setup guide.

## 5. Your next tasks (in order)

Done in the continuation session (do not redo): OOXML extraction fixes + fixtures; DOC/PPTX/XLSX live check (Groq);
duplicate prevention by input hash; in-process lock; six evaluation states; ids in the prompt; model limitations;
derived confidence; explicit rejection (code + proposal 0034); review UI; offline harness.

1. **P0-1** Ask the owner for the provider decision and key(s) (recommendation in `JADARAH-REMAINING-WORK.md`). Verify
   with `npm run ai:verify` and `scripts/verify/evaluate-fixtures.ts` (0 FAIL).
2. **P0-2** With a Gemini key: rerun the harness (JPEG + scanned PDF must read "18,450 SAR"), then one browser
   evaluation per format on a local/staging project (hosted only with approval).
3. **Proposal 0034:** apply only after the owner approves (staging first is preferable); then check the failed state
   after refresh, the live phase, the lock across two tabs and the rejection in the browser.
4. Report to the owner and wait for confirmation of the gate. Then **P1** demo data per
   `handover/JADARAH-DEMO-DATA-PLAN.md`. Then **P2**; deploy only after approval.

## 6. Known issues and exact paths

- Candidates only see jobs of companies with `company_profiles.listed = true` (`can_view_job`). Owner decision: list
  the companies, or apply `supabase/proposals/0032_job_visibility_without_catalogue.sql`. This proposal name clashes
  with migration `20261112000032_task_solution_files.sql`; they are different files.
- `JADARAH_SERVER_KEY`, the email provider and `DAILY_WEBHOOK_SECRET` are not configured: rate limits are in memory,
  email is in-app only, Daily webhooks are off.
- `record_ai_question_evaluation` can be called by any recruiter of the company (P2-4 provenance).
- Two AI-built tasks already assigned keep a shared rubric (content locked by the 0025 trigger
  `lock_assigned_task_content`). The app narrows it per question read-only.
- Submitted code is never executed (no sandbox).
- Old submission-level solution files (`question_id null`) are shown as "not linked to a question" and are never
  evaluated.
- Proposals not applied: `supabase/proposals/0028_function_execute_hardening.sql`, `0030_workflow_cv_listings.sql`,
  `0031_monitoring.sql`.
- Verification records exist on the hosted project for demo accounts (`JADARAH-HANDOVER.md` section F); remove them
  only with approval.
- The cloud environment needed `NODE_USE_ENV_PROXY=1` for Node `fetch`; Docker image pulls were blocked; pushing to
  GitHub failed with HTTP 403 (the GitHub App lacked write access).
- Groq (`openai/gpt-oss-120b`) occasionally returns output that fails the schema and is rate-limited (HTTP 429) on the
  continuation key; both are handled as failures without a score.
- When restarting `next start`, kill the old `next-server` process first: a running server keeps serving the previous
  build, and a rebuilt `.next` under a running server produces error pages.

## 7. Reporting

At each milestone report what changed (files), what you ran (commands and results) and what remains. Mark anything
untested as untested. Provide ZIP deliverables when asked.
