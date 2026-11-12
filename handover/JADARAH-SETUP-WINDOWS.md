# JADARAH — Setup on Windows 11

There is one application process to run, the Next.js app; the backend runs inside it (Server Actions and
`/api/*` routes). The database, authentication and storage are Supabase: either the existing hosted project or a local
Supabase in Docker. AI, email and video are optional external services.

## 1. Required software

| Software | Version | Notes |
|---|---|---|
| Node.js | **24 LTS** (`unpdf` declares `node >= 24`; 22 works with an engine warning) | https://nodejs.org → Windows installer (.msi). Includes npm 10+. |
| Windows Terminal + PowerShell | built in | Run every command below in PowerShell. |
| Git (optional) | 2.4x | Only if you want to initialise a repository from the ZIP. |
| Docker Desktop (optional) | latest | Only for a local Supabase (section 5B). |
| PostgreSQL 16 + pgvector (optional) | — | Only for the SQL tests (`tests/db/run-local.sh`), which run on Linux/WSL. |

Check Node in a **new** PowerShell window:

```powershell
node --version
```

## 2. Extract the archive

Right-click `JADARAH-FULL-HANDOVER.zip` → *Extract All…* → for example `C:\Projects\`. Then open the folder:

```powershell
cd C:\Projects\JADARAH-FULL-HANDOVER
```

Run **every following command in this folder** (it contains `package.json`).

## 3. Install dependencies

```powershell
npm ci
```

This installs the exact versions from `package-lock.json` into `node_modules` and takes a few minutes the first
time. Playwright browsers are only needed for the browser tests:

```powershell
npx playwright install chromium
```

## 4. Environment variables

```powershell
Copy-Item .env.example .env.local
```

```powershell
notepad .env.local
```

The minimum to start the app is:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000`

For AI evaluation also set `GEMINI_API_KEY` (and optionally `OPENAI_API_KEY`). `ENVIRONMENT-REFERENCE.md` describes
every variable. Never commit `.env.local` (it is git-ignored).

## 5. Database

### 5A. Hosted Supabase project (current setup)

Every repository migration up to **0033** is already applied to the hosted project (verified 2026-11-12, see
`JADARAH-HANDOVER.md` section C). **Do not apply 0029, 0032 or 0033 again.**

Check after starting the app: http://localhost:3000/api/health should show
- `"database": "ok"`
- `"database_schema": "0029"`
- `"task_solution_files": "ready"`
- `"question_evaluation": "ready"`

### 5B. A new or local Supabase (only if you do not use the hosted project)

```powershell
npx supabase init
```

```powershell
npx supabase start
```

`supabase start` applies every file in `supabase/migrations` in order to a fresh local database and prints a local URL
and keys. Put those in `.env.local`. Demo data: run `supabase/seed/demo_seed.sql`, then
`select public.seed_demo('<password>')` in the local SQL editor (http://127.0.0.1:54323). This path has not been
executed in the environment where the handover was prepared (Docker images could not be downloaded there).

To apply a single migration to a database you control (always take a backup first; the script refuses a version that
is already in the ledger):

```powershell
npx tsx scripts/import/apply-migration.ts supabase/migrations/20261112000033_question_level_evaluation.sql
```

This needs `SUPABASE_DB_URL` in `.env.local` (the Session pooler connection string). **Never point it at the hosted
production project for 0029/0032/0033**: they are applied there under different ledger versions.

## 6. Start the application

Development (hot reload):

```powershell
npm run dev
```

Production mode:

```powershell
npm run build
```

```powershell
npm run start
```

Open http://localhost:3000. Stop with `Ctrl + C`.

## 7. Tests

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript, no output files |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (`tests/unit`, 129 tests) |
| `npm run test:integration` | Integration tests against the Supabase project in `.env.local`. **They write data: use a local or test project.** |
| `npm run test:e2e` | Playwright against a running app (`npm run start` first) |
| `bash tests/db/run-local.sh` | SQL tests on a throwaway local PostgreSQL 16 (Linux/WSL only) |
| `node scripts/verify/question-evaluation-e2e.cjs <files> <out>` | Live question-level evaluation check. **It writes demo records; needs owner approval for the hosted project.** |

## 8. Demo accounts

See `DEMO_ACCOUNTS.md` (email addresses). The password is the value of `DEMO_USER_PASSWORD` used when the seed ran.
It is not stored in the repository.

## 9. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `npm ci` engine warning for `unpdf` | Use Node 24. |
| Error "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" | `.env.local` missing, misnamed or not in the project folder; restart `npm run dev` after editing. |
| `/api/health` shows `question_evaluation: "missing_0033"` | The database is not the hosted project or lacks 0033: apply the migrations in order (section 5B). |
| "This feature is being enabled. Please try again later" | A database function is missing (PostgREST `PGRST202`): a migration is not applied to that database. |
| "No AI provider is configured" / "AI could not evaluate this answer now" | Set `GEMINI_API_KEY` or `OPENAI_API_KEY`; run `npm run ai:verify`; check `ai_provider_logs` for `quota_exhausted` or `overloaded`. |
| Uploads fail with a type error | The file type is not on the allow-list (`src/lib/upload/rules.ts`) or is larger than 20 MB. |
| Candidates cannot see a published job | The company is not listed in the catalogue (Super Admin → Subscriptions), or the deadline has passed. |
| Sign-in loops on `/sign-in` | Sign-in is limited to 10 attempts per minute per IP; wait one minute. |
| `next start` says the port is in use | Another server is running: `Get-Process node`, then stop it, or use `npm run start -- -p 3001`. |
| Changes not visible after `npm run build` | Restart `npm run start`: a running server keeps serving the old build. |
