# JADARAH — Environment variables reference

Source of truth: `.env.example`, `src/lib/env.ts` (public) and `src/lib/server-env.ts` (server). Values below are
placeholders. **No real secret appears in this document.**

**Frontend-safe** = prefixed `NEXT_PUBLIC_`; bundled into the browser, so it must never hold a secret. **Server-only** =
read on the server or by scripts only.

## Minimum configurations

| Goal | Variables |
|---|---|
| Start the app locally | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` |
| Supabase (hosted or local) | the three above; scripts also need `SUPABASE_SERVICE_ROLE_KEY` and/or `SUPABASE_DB_URL` |
| AI evaluation (question-level grading, OCR) | `GEMINI_API_KEY` (+ `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`). Optional: `OPENAI_API_KEY` + `OPENAI_MODEL` (preferred for evaluation when funded), `GROQ_API_KEY` |
| File uploads | Supabase only (buckets created by migrations 0007/0029/0032). No extra variable. |
| Email | `EMAIL_PROVIDER=smtp`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, plus `JADARAH_SERVER_KEY` and `CRON_SECRET` for the dispatcher |
| Video interviews | `DAILY_API_KEY`; webhooks: `DAILY_WEBHOOK_SECRET` (+ `JADARAH_SERVER_KEY`) |
| Production deployment | All of the above that apply, `JADARAH_ENV=production`, `NEXT_PUBLIC_SITE_URL=https://<domain>`; no test variables |

## Every variable

| Name | Purpose | Required | Used by | Where to obtain | Exposure | Example placeholder |
|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | **Required** | app, scripts | Supabase → Project Settings → API | Frontend-safe | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public API key (RLS applies) | **Required** | app | same page → Publishable key | Frontend-safe | `sb_publishable_xxx` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Legacy fallback name for the key above | Optional | app | same | Frontend-safe | `eyJ…` (legacy) |
| `NEXT_PUBLIC_SITE_URL` | Absolute URL for links and auth redirects | **Required** | app | your URL | Frontend-safe | `http://localhost:3000` |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key for scripts (provisioning, demo seed/reset, imports, local E2E fixtures). Not used by the web app | Optional (scripts) | `scripts/*` | Supabase → API → service_role / secret key | **Server-only** | `<service-role-key>` |
| `SUPABASE_DB_URL` | Privileged Postgres connection for scripts (`apply-migration`, seed, cleanup) | Optional (scripts) | `scripts/*` | Supabase → Database → Connection string (Session pooler) | **Server-only** | `postgresql://postgres.<ref>:<password>@<host>:5432/postgres` |
| `JADARAH_ENV` | Environment guard for demo reset (`local`, `demo`, `production`) | Optional | scripts | — | Server-only | `local` |
| `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` | First Super Admin (`npm run admin:provision`) | Optional (once) | script | you choose | **Server-only** | `admin@example.com` / `<strong password>` |
| `DEMO_USER_PASSWORD` | Shared password of demo accounts (seed, integration and E2E tests) | Optional | scripts, tests | chosen at seed time | **Server-only** | `<demo password>` |
| `AI_PROVIDER` | Default provider label | Optional | AI layer | — | Server-only | `gemini` |
| `AI_TIMEOUT_MS` | Per-call timeout | Optional (default in code) | AI layer | — | Server-only | `25000` |
| `AI_PRIMARY_TIMEOUT_MS` | Shorter budget for a primary model that has a backup | Optional | AI layer | — | Server-only | `15000` |
| `AI_STRICT_ROUTING` | `true` = no cross-provider fallback | Optional | AI layer | — | Server-only | `false` |
| `AI_DEBUG` | `1` = log provider error codes | Optional | AI layer | — | Server-only | empty |
| `GEMINI_API_KEY` | Gemini (structured tasks, OCR/vision, embeddings; evaluation fallback) | **Required for AI evaluation** today | AI layer | Google AI Studio | **Server-only** | `<gemini key>` |
| `GEMINI_MODEL` | Primary Gemini model | Optional | AI layer | — | Server-only | `gemini-3.8-flash` |
| `GEMINI_FALLBACK_MODEL` | Backup on overload/timeout (did all evaluations on 2026-11-12) | Optional | AI layer | — | Server-only | `gemini-3.5-flash` |
| `AI_BUILDER_GEMINI_MODEL` | Assessment Builder-only model override | Optional | builder | — | Server-only | `gemini-3.5-flash-lite` |
| `GEMINI_THINKING_LEVEL` | `low`/`medium`/`high`/`default` | Optional | AI layer | — | Server-only | `low` |
| `GEMINI_JSON_SCHEMA` | `false` = do not send a JSON schema | Optional | AI layer | — | Server-only | empty |
| `GROQ_API_KEY` / `GROQ_MODEL` | Fast chat tasks | Optional | AI layer | console.groq.com | **Server-only** | `<groq key>` / `openai/gpt-oss-120b` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Deep tasks (evaluation, final evaluation) — **quota exhausted on 2026-11-12** | Optional (recommended) | AI layer | platform.openai.com | **Server-only** | `<openai key>` / `gpt-6.1-sol` |
| `EMBEDDING_PROVIDER` / `EMBEDDING_MODEL` / `EMBEDDING_DIMENSIONS` / `SEMANTIC_RELATED_MIN` | Semantic matching (pgvector, 768) | Optional | semantic service, scripts | — | Server-only | `gemini` / `gemini-embedding-2` / `768` / `0.92` |
| `IMPORT_GEMINI_MODEL`, `VISION_PER_PAGE` | Reference-library import script only | Optional | `scripts/import` | — | Server-only | empty |
| `JADARAH_SERVER_KEY` | Narrow key for `internal_*` RPCs (shared rate limits, AI cooldowns, email outbox, Daily webhooks). Its SHA-256 must be inserted into `private.service_keys` | Optional (**not set today**) | server | generate ≥ 32 random chars | **Server-only** | `<random 48 chars>` |
| `CRON_SECRET` | Bearer secret for `/api/internal/*` scheduled calls | Optional | email dispatch | generate | **Server-only** | `<random>` |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` | Transactional email (not configured today) | Optional | `src/services/email` | your SMTP provider | **Server-only** (password) | `smtp`, `Jadarah <no-reply@example.com>`, `smtp.example.com`, `465`, `<user>`, `<password>`, `true` |
| `RESEND_API_KEY` | Not integrated (future) | — | — | — | Server-only | empty |
| `DAILY_API_KEY` | Create video rooms and tokens | Optional | `src/services/daily.ts` | dashboard.daily.co → Developers | **Server-only** | `<daily key>` |
| `DAILY_WEBHOOK_SECRET` | Verify Daily webhooks | Optional (**not set today**) | `/api/webhooks/daily` | Daily webhook settings | **Server-only** | `<secret>` |
| `E2E_BASE_URL`, `PW_CHROMIUM_PATH`, `RUN_LOCAL_E2E`, `E2E_SHOTS_DIR`, `RUN_LIVE_AI`, `RUN_LIVE_VIDEO`, `BUILDER_ONLY`, `CAPTURE_EVIDENCE`, `EVIDENCE_DIR`, `E2E_EMAIL_TEST_ADDRESS`, `E2E_EMAIL_TEST_PASSWORD` | Test switches | Optional (tests only) | Playwright | — | Server-only | `http://localhost:3000`, `1`, … |
| `E2E_BASE`, `E2E_APPLICATION`, `E2E_ASSESSMENT` | Inputs of `scripts/verify/*-e2e.cjs` | Optional (verification only) | verify scripts | — | Server-only | `http://localhost:3000`, `<application uuid>` |
| `NODE_USE_ENV_PROXY` | Only in proxied cloud containers: lets Node `fetch` use `HTTPS_PROXY` | Environment-specific | Node | — | — | `1` |

## Current configuration status (2026-11-12, names only)

- Configured in the preparing environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY` (quota exhausted), `DAILY_API_KEY`, `DEMO_USER_PASSWORD`.
- Not configured: `JADARAH_SERVER_KEY` (health shows `server_key: missing`; rate limits run in memory), an email
  provider (`email: not_configured`), `DAILY_WEBHOOK_SECRET` (`video_webhooks: not_configured`).

## Continuation environment (2026-11-12, names only)

- Configured: `GROQ_API_KEY` (+ `GROQ_MODEL=openai/gpt-oss-120b`), `DAILY_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` **pointing to a different project (`squpszwbrqkflezfltoj`), not the documented
  hosted project**. `GEMINI_MODEL` was set but empty.
- Not configured: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`,
  `DEMO_USER_PASSWORD`, `JADARAH_SERVER_KEY`. Consequences: evaluations route to Groq; JPEG and scanned-PDF reading is
  unavailable (reported, never scored); no live database tests were possible.
- No new environment variables were introduced. Proposal 0034 needs none.

