# جدارة · JADARAH

**من المهارة إلى الفرصة. · From skill to opportunity.**

JADARAH is a bilingual (Arabic/English) talent-intelligence and recruitment platform. Candidates build evidence-backed profiles, take practical assessments and follow development plans; companies publish jobs, compare candidates requirement by requirement, run structured interviews and decide. AI supports — people decide.

> The product never presents fictional or sample records as platform activity: demo identities, demo companies and imported practice scenarios are hidden from real users (see `scripts/cleanup/remove-fabricated-data.sql` to remove them for good).

## Stack
Next.js 16 (App Router, Server Actions, `proxy.ts`) · React 19 · Three.js (landing journey, lazy-loaded) · TypeScript (strict) · Tailwind CSS v4 · Motion · Recharts · Zod · Supabase (Postgres, Auth, Storage, RLS) · Vitest · Playwright · GitHub Actions.

## Quick start
```bash
git clone https://github.com/Nadaalnashwan/Jadarah && cd Jadarah
git checkout feature/jadarah-greenfield-build
npm ci
cp .env.example .env.local   # fill in values (see below)
npm run dev                  # http://localhost:3000
```

### Environment variables
| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | Publishable (anon) key — RLS applies |
| `NEXT_PUBLIC_SITE_URL` | public | Base URL used in auth email redirects |
| `SUPABASE_SERVICE_ROLE_KEY` | server/scripts only | Admin provisioning script |
| `SUPABASE_DB_URL` | scripts only | Demo seed/reset over a privileged connection |
| `JADARAH_ENV` | server | `local` / `demo` / `production` guard |
| `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` | scripts only | First Super Admin |
| `DEMO_USER_PASSWORD` | scripts/tests only | Shared password of demo identities |
| `AI_PROVIDER`, `AI_TIMEOUT_MS`, `AI_PRIMARY_TIMEOUT_MS`, `AI_STRICT_ROUTING` | server | AI routing (fast → Groq, structured → Gemini, deep → OpenAI) |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GEMINI_THINKING_LEVEL` | server | Gemini (structured extraction/generation) |
| `GROQ_API_KEY`, `GROQ_MODEL` | server | Groq (assistants, fast tasks; streaming) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | server | OpenAI (deep evaluation) |
| `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `SEMANTIC_RELATED_MIN` | server | Gemini embeddings + pgvector semantic matching |
| `DAILY_API_KEY`, `DAILY_WEBHOOK_SECRET` | server | Daily.co private video interviews |
| `RESEND_API_KEY` | — | Future work (lowest priority), not integrated |

Never prefix secrets with `NEXT_PUBLIC_`.

### Windows 11 (PowerShell)
```powershell
git clone https://github.com/Nadaalnashwan/Jadarah.git
cd Jadarah
git checkout feature/jadarah-product-experience
npm ci
Copy-Item .env.example .env.local   # then edit .env.local (see variables above)
npm run build
npm run start                       # http://localhost:3000   (or: npm run dev)
```
Requires Node.js 22+ (24 LTS recommended) and npm. Database migrations: see [DATABASE.md](DATABASE.md) — on a fresh Supabase project run `supabase db push`, or apply `supabase/migrations/*.sql` in order.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Develop / production build / serve |
| `npm run lint` · `typecheck` · `format` | Quality gates |
| `npm test` | Unit tests (domain rules) |
| `npm run test:integration` | RLS + recruitment-flow tests against the Supabase in `.env.local` (needs `DEMO_USER_PASSWORD`); `tests/integration/workflow.test.ts` runs only against a **local** Supabase |
| `npm run test:e2e` | Playwright browser journeys (`RUN_LOCAL_E2E=1` adds the candidate + employer core journeys against a local Supabase) |
| `npm run seed:generate` | Regenerate `supabase/seed/demo_seed.sql` from typed demo data |
| `npm run demo:seed` / `demo:reset -- --yes` | Seed / remove demo data (refuses in production) |
| `npm run admin:provision` | Idempotently create the first Super Admin |
| `npm run ai:verify` | Verify AI/Daily keys, exact model IDs, real requests, latency |
| `npm run eval:offline` | Offline evaluation (no AI calls): rule-based CV skill extraction vs a labelled benchmark → `src/data/evaluation/results.json` |
| `npm run ai:embed-skills` / `ai:embed-profiles` | Backfill pgvector embeddings (idempotent, content-hashed) |
| `npx tsx scripts/import/apply-migration.ts <file>` | Apply one migration in a transaction and record it |
| `npx tsx scripts/import/import-organizations.ts <package dir>` | Import/reconcile the ten registry organizations (idempotent) |
| `npx tsx scripts/import/import-references.ts <package dir> [--skip-upload] [--only key]` | Import the assessment reference library (cached, idempotent) |
| `node scripts/brand-assets.mjs` | Regenerate `public/brand/*.svg` and the app icon from the approved symbol geometry |
| `npx tsx scripts/exploration/generate-sql.ts` | Regenerate migration 0026 from `scripts/exploration/tasks.ts` |
| `npm run demo:rotate-password -- --yes` | Rotate the shared password of `@jadarah-demo.test` identities only |
| `psql "$SUPABASE_DB_URL" -f scripts/cleanup/remove-fabricated-data.sql` | Preview (dry run, rolls back) removal of demo/test/practice data; change the last line to `COMMIT` only after review |

## Recruitment workflow
Candidate applies → the application is created → the job's attached practical task is assigned **in the same transaction** and opens immediately (no employer approval step) → the candidate submits → the application is complete and the employer evaluates the CV and the assessment evidence → shortlist → interview → decision. While the task is outstanding the employer can only reject or hire (hiring never requires a shortlist); interviews always require a shortlist. Jobs without a task are complete at submission.

## Testing against a local Supabase (no production data touched)
```bash
npx supabase start                                  # applies supabase/migrations/* to a local stack
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed/demo_seed.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select public.seed_demo('<local password>')"
# .env.local → local URL/keys from `npx supabase status`, SUPABASE_DB_URL, DEMO_USER_PASSWORD=<local password>
npm test && npm run test:integration
npm run build && npx next start -p 3100
RUN_LOCAL_E2E=1 E2E_BASE_URL=http://localhost:3100 npx playwright test
```
See [TESTING.md](TESTING.md) for the exact local preparation used for the latest results.

## Documentation
[ARCHITECTURE](ARCHITECTURE.md) · [DATABASE](DATABASE.md) · [SECURITY](SECURITY.md) · [TESTING](TESTING.md) · [DEPLOYMENT](DEPLOYMENT.md) · [DEMO_ACCOUNTS](DEMO_ACCOUNTS.md) · [MONITORING](docs/MONITORING.md) · [BRAND COLORS](docs/BRAND_COLORS.md) · [NAVIGATION](docs/NAVIGATION.md) · [Handoff](docs/handoffs/JADARAH_HANDOFF.md)
