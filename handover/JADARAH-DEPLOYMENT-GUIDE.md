# JADARAH — Deployment guide

**Status: not deployed.** Nothing in this guide has been executed against hosting infrastructure. `DEPLOYMENT.md` (in
the repository) contains the original Vercel notes; this guide extends it. Do not deploy, change DNS or modify
production Supabase without owner approval.

## Environments

| | Local development | Staging / demo | Production |
|---|---|---|---|
| App | `npm run dev` or `npm run build && npm run start` | Vercel Preview (or any Node 24 host) | Vercel Production (or a Node 24 host behind HTTPS) |
| Supabase | local Docker (`npx supabase start`) or a dev project | separate staging project (recommended for demo seeding) | the hosted project `qqvvlornhvfykusaxaid`, which today mixes production configuration with demo accounts |
| `JADARAH_ENV` | `local` | `demo` | `production` |
| Data | seed allowed | seed allowed, by manifest (`JADARAH-DEMO-DATA-PLAN.md`) | **no seeding**; `platform_settings.environment = 'production'` |

## Recommended hosting (fits the current architecture)

There is one Next.js 16 app (App Router, Server Actions, route handlers, `src/proxy.ts` middleware) plus Supabase.
**Vercel** works with no adapter: framework preset Next.js, Node 24.
- **Build:** `npm ci && npm run build`. **Start (non-Vercel):** `npm run start` (port 3000), behind a reverse proxy
  with TLS.
- **Function duration:** AI evaluation of one question takes ~5–30 s, so allow ≥ 60 s for server actions. The
  evaluator asks the provider for ≥ 60 s.
- **Body size:** uploads go directly from the browser to Supabase Storage (20 MB limit), not through the app.

## Production environment variables

Names only (see `ENVIRONMENT-REFERENCE.md`):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
JADARAH_ENV
GEMINI_API_KEY, GEMINI_MODEL, GEMINI_FALLBACK_MODEL, GEMINI_THINKING_LEVEL
OPENAI_API_KEY, OPENAI_MODEL
GROQ_API_KEY, GROQ_MODEL
EMBEDDING_*
AI_TIMEOUT_MS, AI_PRIMARY_TIMEOUT_MS
JADARAH_SERVER_KEY, CRON_SECRET
EMAIL_PROVIDER, EMAIL_FROM, SMTP_*
DAILY_API_KEY, DAILY_WEBHOOK_SECRET
```

Never add these to the web app: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `DEMO_USER_PASSWORD`,
`INITIAL_ADMIN_*`.

## Supabase production configuration

1. **Migrations:** the hosted project already has every repository migration through **0033** (ledger names differ:
   see `JADARAH-HANDOVER.md` section C). For a *new* project, apply `supabase/migrations/*` in filename order with
   `supabase db push` or `scripts/import/apply-migration.ts`. Do **not** apply files in `supabase/proposals/` without
   approval. For the existing project, never use `supabase db push` until the ledger is reconciled: it would try to
   re-run files whose versions are not in the ledger.
2. **Server key:** generate `JADARAH_SERVER_KEY` (≥ 32 chars). Register its hash with
   `insert into private.service_keys (name, key_hash) values ('app', encode(sha256(convert_to('<key>', 'UTF8')), 'hex'));`
   (any lowercase name works: `private.service_key_ok` accepts any registered hash). Run it in the SQL editor, never
   in a committed file. Then shared rate limits, AI cooldowns, the email outbox and Daily webhooks work.
3. **Storage:** buckets and policies come from migrations 0007/0029/0032/0033. Check that every bucket is
   **private**, `assessment-attachments` has a 20 MB limit and the MIME allow-list, and there are no public URLs
   (verified 2026-11-12).
4. **Auth URLs:** Dashboard → Authentication → URL configuration: Site URL `https://<domain>`; Redirect URLs
   `https://<domain>/auth/callback`, plus preview URLs for staging.
5. **SMTP:** configure custom SMTP for auth emails; set `EMAIL_PROVIDER=smtp` for app emails.
6. **pg_cron:** `jadarah-platform-housekeeping` (hourly) was created by 0029; check that it exists.
7. **Environment flag:** `update public.platform_settings set value = '"production"' where key = 'environment';` (the
   demo seed and reset then refuse to run).
8. **First Super Admin:** `npm run admin:provision` from a trusted machine with `SUPABASE_SERVICE_ROLE_KEY`.

## Domain and HTTPS

Add the domain in the host (Vercel → Domains). Create the DNS records it shows (A/ALIAS or CNAME). HTTPS is automatic
on Vercel; elsewhere, terminate TLS at the proxy (Let's Encrypt). Set `NEXT_PUBLIC_SITE_URL` and the Supabase Site
URL to the final `https://` origin.

## Security checks before go-live

- `npm run lint`, `npm run typecheck`, `npm test`, `bash tests/db/run-local.sh`.
- `npm run test:integration` against **staging**: it includes RLS and security tests.
- Secret scan of the deployed bundle: no server-only names appear in `.next/static`.
- Supabase advisors (security + performance) reviewed.
- Decide on proposal `0028_function_execute_hardening.sql`.
- Move AI result writes behind the server key (P2-4 in `JADARAH-REMAINING-WORK.md`).

## Post-deployment smoke tests

1. `GET /api/health` returns:
   - `status: ok`, `database: ok`, `auth: ok`;
   - `task_solution_files: ready`, `question_evaluation: ready`;
   - `server_key: configured`;
   - `email` reports the configured provider.
2. Landing page renders the 3D city; switch Arabic/English and light/dark.
3. Sign up → confirmation email → sign in.
4. Candidate: discover → apply → task (upload a file on a question) → submit.
5. Employer: review the question → AI evaluate → approve → share feedback; schedule an interview (calendar on both
   sides).
6. Admin: control centre loads; audit log shows the actions.

## Rollback

- **App:** Vercel → Deployments → promote the previous deployment (or redeploy the previous commit).
- **Database:** migrations are additive. Each file documents its manual rollback; for example 0032 has rollback steps
  in its header. Take a backup (Dashboard → Database → Backups / PITR) before every migration and restore if needed.
  Never drop tables with data without approval.
- **Config:** keep the previous environment variable set and restore it in the host.
