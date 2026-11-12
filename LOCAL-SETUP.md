# JADARAH — run the complete local preview on Windows 11

This folder is a complete copy of the project (Next.js application + Supabase migrations). There is **one service to
start on your machine — the Next.js app**. The database, authentication and file storage are **Supabase** (your
hosted project, or a local Supabase if you choose). AI, email and video are optional external services.

Nothing in this folder contains real credentials. You create `.env.local` yourself.

---

## 1. Install the required software (once)

| Software | Version | Where |
|---|---|---|
| Node.js | **24 LTS** (22 also works) — includes npm | https://nodejs.org → "LTS" Windows installer (.msi) |
| A terminal | Windows Terminal with **PowerShell** (built into Windows 11) | Start menu → "Terminal" |
| Docker Desktop | only for the optional *local* Supabase (section 5B) | https://www.docker.com/products/docker-desktop |

Check Node after installing — open a **new** PowerShell window and run:

```powershell
node --version
```

It should print `v24…` (or `v22…`).

## 2. Open the project folder in PowerShell

Extract `JADARAH-COMPLETE-LOCAL-PREVIEW.zip`, for example to `C:\Projects\`. Then in PowerShell:

```powershell
cd C:\Projects\JADARAH-COMPLETE-LOCAL-PREVIEW
```

Every command below is run **in this folder**.

## 3. Install dependencies

```powershell
npm ci
```

This installs exactly the versions in `package-lock.json` (a few minutes the first time).

## 4. Environment variables

Create your local environment file from the template:

```powershell
Copy-Item .env.example .env.local
```

Open it in Notepad:

```powershell
notepad .env.local
```

**Required** (the app does not start its pages without them):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same page → Publishable key (`sb_publishable_…`) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` |

**Optional** — each feature works in a labelled fallback mode or stays disabled without them:

| Feature | Variables | Where to get them |
|---|---|---|
| AI (CV reading, assistants, assessment builder) | `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY` (+ the `*_MODEL` defaults already in the file) | Google AI Studio, console.groq.com, platform.openai.com |
| Video interviews | `DAILY_API_KEY`, `DAILY_WEBHOOK_SECRET` | dashboard.daily.co → Developers |
| Email delivery | `EMAIL_PROVIDER=smtp`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` | your email provider's SMTP settings |
| Internal jobs (needs migration 0029) | `JADARAH_SERVER_KEY` (any random text ≥ 32 characters), `CRON_SECRET` | you generate them |
| Scripts only (admin provisioning, demo seed, migrations) | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `DEMO_USER_PASSWORD`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` | Supabase → Project Settings → API / Database → Connection string |

Never commit `.env.local` (it is already git-ignored).

## 5. Database

### 5A. Use your existing hosted Supabase project (recommended)

The app works immediately against your current project. Migrations 0029 (`platform_completion`) and 0032
(`task_solution_files`, Task Solution Files / ملفات حل المهمة) and 0033 (`question_level_evaluation`, question-by-question
grading — see `docs/EVALUATION.md`) **were applied to the hosted project on 2026-11-12** — do not apply them again.
Check: open http://localhost:3000/api/health — it should show `"database_schema": "0029"`, `"task_solution_files": "ready"`
and `"question_evaluation": "ready"`.

For a **different** (new) Supabase project, apply every file in `supabase/migrations/` in order — take a backup first,
put `SUPABASE_DB_URL` (the *Session pooler* connection string) in `.env.local`, then for each file, for example:

```powershell
npx tsx scripts/import/apply-migration.ts supabase/migrations/20261112000032_task_solution_files.sql
```

(or use `npx supabase db push`). If `/api/health` shows `task_solution_files: "missing_0029_and_0032"` or `"missing_0032"`,
the task solution upload is refused by the database until those migrations are applied.

`supabase/proposals/0032_job_visibility_without_catalogue.sql` is a **proposal only** (see "Known configuration" below).

### 5B. Or a local Supabase (Docker Desktop)

```powershell
npx supabase init
```

```powershell
npx supabase start
```

`supabase start` applies every file in `supabase/migrations/` to a fresh local database and prints a local API URL
and publishable key — put those in `.env.local`. Demo data: run `supabase/seed/demo_seed.sql` and
`select public.seed_demo('<a password of your choice>')` in the local SQL editor (http://127.0.0.1:54323). *(This path
could not be executed in the environment where this package was prepared — Docker images were not downloadable there.)*

## 6. Start the application

Development mode (hot reload):

```powershell
npm run dev
```

Open **http://localhost:3000**. Stop it with `Ctrl + C`.

Production mode (what was measured and tested):

```powershell
npm run build
```

```powershell
npm run start
```

Then open **http://localhost:3000**.

There is no separate backend process: server routes (`/api/health`, `/api/assistant`, `/api/webhooks/daily`,
`/api/internal/email/dispatch`) run inside the same Next.js server. Health check: http://localhost:3000/api/health

## 7. Try the main flows

- Theme: sun/moon button (top bar). Language: "English / العربية" button.
- Demo accounts (if your project has the demo seed): see `DEMO_ACCOUNTS.md` — the password is the one used when the
  seed was run.
- Candidate: **التقويم / Calendar** in the sidebar; open an assigned task → each open question has its own area
  **ملفات الحل للسؤال / Solution files for question N** (PDF, DOC, DOCX, ZIP, JPG, PNG and more; up to 5 files per
  question, 20 MB each). Files are reviewed only with the question they were attached to.
- Employer: Applications → open an application → the task card shows **results by question** (AI suggestion and approved
  score), then one question at a time: instructions, criteria, answer, that question's files (preview / download),
  **Evaluate this question with AI**, and the reviewer's decision (score, private notes, feedback for the candidate).
  **Share feedback** publishes the overall and per-question feedback to the candidate.

## 8. Checks you can run

```powershell
npm run typecheck
```

```powershell
npm run lint
```

```powershell
npm test
```

```powershell
npm run test:e2e
```

(`test:e2e` runs Playwright against a running app; install its browser once with `npx playwright install chromium`.
`npm run test:integration` writes to the Supabase project in `.env.local` — use a local or test project.)

SQL tests for the migrations (`tests/db/*.test.sql`) run with `tests/db/run-local.sh` on Linux/WSL with PostgreSQL 16
and pgvector.

## Known configuration

- **Jobs not visible to candidates:** candidates only see published jobs of organizations that are approved **and listed
  in the catalogue** (`company_profiles.listed`, set by the Super Admin in *Subscriptions*). Employers now see a warning
  on their Jobs page when this applies. `supabase/proposals/0032_job_visibility_without_catalogue.sql` removes that
  coupling if you decide catalogue listing should not control job visibility (apply only after approval).
- **Interviews:** a past interview whose outcome was not recorded appears under History as "Outcome not recorded"; open
  it and record completed/cancelled.
- Times are shown in Saudi time (Asia/Riyadh).
