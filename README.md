# جدارة · JADARAH

**أكثر من سيرة ذاتية. · Beyond What's Seen.**

JADARAH is a bilingual (Arabic/English) talent-intelligence and recruitment platform. Candidates build evidence-backed profiles, take practical assessments and follow development plans; companies publish jobs, compare candidates requirement by requirement, run structured interviews and decide. AI supports — people decide.

> Demo companies and people are fictional.

## Stack
Next.js 16 (App Router, Server Actions, `proxy.ts`) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Motion · Recharts · Zod · Supabase (Postgres, Auth, Storage, RLS) · Vitest · Playwright · GitHub Actions.

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

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Develop / production build / serve |
| `npm run lint` · `typecheck` · `format` | Quality gates |
| `npm test` | Unit tests (domain rules) |
| `npm run test:integration` | Live RLS + recruitment-flow tests against Supabase (needs `DEMO_USER_PASSWORD`) |
| `npm run test:e2e` | Playwright browser journeys |
| `npm run seed:generate` | Regenerate `supabase/seed/demo_seed.sql` from typed demo data |
| `npm run demo:seed` / `demo:reset -- --yes` | Seed / remove demo data (refuses in production) |
| `npm run admin:provision` | Idempotently create the first Super Admin |
| `npm run ai:verify` | Verify AI/Daily keys, exact model IDs, real requests, latency |
| `npm run ai:embed-skills` / `ai:embed-profiles` | Backfill pgvector embeddings (idempotent, content-hashed) |
| `npm run demo:rotate-password -- --yes` | Rotate the shared password of `@jadarah-demo.test` identities only |

## Documentation
[ARCHITECTURE](ARCHITECTURE.md) · [DATABASE](DATABASE.md) · [SECURITY](SECURITY.md) · [TESTING](TESTING.md) · [DEPLOYMENT](DEPLOYMENT.md) · [DEMO_ACCOUNTS](DEMO_ACCOUNTS.md) · [Handoff](docs/handoffs/JADARAH_HANDOFF.md)
