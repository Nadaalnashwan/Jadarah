# JADARAH — Safe demo data plan

**Status: ON HOLD.** Do not create demo jobs, applications, tasks, submissions or interviews until the owner confirms
that the AI evaluation gate is met. The live end-to-end test passed on 2026-11-12 (`JADARAH-TEST-REPORT.md`), but
P0-1 (provider) and P0-2 (remaining formats) in `JADARAH-REMAINING-WORK.md` are open. **Never run a seed against
production without explicit owner approval.** Prefer a local or staging Supabase project.

## Principles

- **Use existing accounts** (`DEMO_ACCOUNTS.md`): demo candidates `candidate01…`, employers `admin.<company>`,
  `recruiter.<company>`, `interviewer.<company>`, and the platform admin. All have `profiles.is_demo = true` and
  `@jadarah-demo.test` addresses, so emails to them are suppressed by `email_is_suppressed()`.
- **Tag everything:**
  - titles start with `[DEMO]`;
  - jobs and assessments are created by demo company accounts;
  - every created id is stored in a manifest file (`demo-manifest.json`) so the seed can be reversed exactly.
- **Idempotent:** look up by a deterministic key (`assessments.creation_key` for tasks; for jobs, the title + company)
  before creating; re-running creates nothing new.
- **Reversible:** a reset script deletes only ids from the manifest (and their storage objects), never anything else.
  The existing `npm run demo:reset` script is guarded by `JADARAH_ENV`; it must refuse `production` unless explicitly
  overridden.
- **Real data paths only:**
  - create through the same RPCs and server actions the UI uses (`assign_assessment`, `start_assessment`,
    `save_assessment_answer`, Storage upload + `register_assessment_file`, `submit_assessment`, then
    `evaluateQuestionWithAI` / `record_ai_question_evaluation` and `review_assessment_question`);
  - **no fake AI scores and no direct inserts into score or counter columns**;
  - dashboards must read these records.
- **Independent of real users:** never touch non-demo profiles, companies or applications.

## Steps (after approval)

1. **Pick the environment.** A local Supabase (`npx supabase start`) or a staging project with all migrations up to
   0033. Check `/api/health` → `question_evaluation: ready`.
2. **Companies:** use existing approved demo companies (e.g. Nawat Technologies, Souqa Digital Commerce). For
   candidates to see their jobs, mark them **listed** in Super Admin → Subscriptions, or apply the visibility proposal
   (owner decision, P1-1).
3. **Jobs (3–4 per company):** realistic Saudi roles (e.g. Full-Stack Developer, Data Analyst, Cybersecurity Analyst),
   with skills, application questions, deadlines in the future (Asia/Riyadh), status `published`.
4. **Practical tasks:** one per job, with 3 open questions, each with:
   - a question-specific rubric (employer criteria) and deliverables in `config.deliverables`;
   - plus 1–2 objective questions.

   Publish before assigning: content is locked once assigned.
5. **Applications:** 3–5 demo candidates per job through `apply_to_job` (the job's task is auto-assigned).
6. **Submissions:** for each candidate, write genuine answers and generate real files per question (PDF via Chromium,
   ZIP of real source code, DOCX via the `buildDocx` helper in `tests/unit/helpers/zip-writer.ts`, PNG charts). Use
   varied quality: complete / partial / clearly missing requirements. Store each file only under its question.
7. **Run the real AI evaluation** per question (the employer UI or the same server action), then approve or adjust
   scores as a recruiter. Share feedback for some candidates only.
8. **Interviews:** schedule only after the owner confirms the demo date and time; use `create_interview` with demo
   interviewers. Check both calendars and the upcoming/history split.
9. **Verify:** dashboard numbers equal SQL counts; employer review shows the stored AI results; candidate reports show
   the shared feedback; the manifest lists every id.
10. **Reset:** run the reset with the manifest; confirm zero leftover rows and storage objects.

## Existing verification records on the hosted project

`JADARAH-HANDOVER.md` section F lists the records created by the 2026-11-12 verifications (demo accounts only). They
are not part of a seed manifest; remove them only with owner approval, by id. Delete storage objects first through
the Storage API, then the assignments (submissions, answers, files, evaluations and history cascade). Note that the
task-content lock prevents deleting questions of assigned assessments: delete the assignments before the assessments.
