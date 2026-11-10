# JADARAH | جدارة — Engineering Handoff

> Keep this file current. A new session must be able to resume from GitHub alone.

## Project
- Purpose: AI-assisted, evidence-based talent intelligence & recruitment platform (candidates, companies, Super Admin).
- Taglines: **أكثر من سيرة ذاتية.** / **Beyond What's Seen.**
- Brand colours (exact): Midnight Navy `#0F1B3D`, Royal Blue `#3B66F6`, Lavender `#A9B8FF`, Sky Blue `#CDE7F6`, Warm Ivory `#F8F6F0`.
- Fonts: IBM Plex Sans Arabic (AR), Manrope (EN).

## Repository
- Repo: https://github.com/Nadaalnashwan/Jadarah
- Working branch: `feature/jadarah-greenfield-build` (never commit to `main`; no merge without approval)
- Note: the repo was empty; this branch is currently the only branch on the remote.
- Local clone: `~/Developer/Jadarah`
- Latest verified pushed commit: see `git ls-remote origin refs/heads/feature/jadarah-greenfield-build` (updated at each checkpoint below)

## Supabase
- Project ref: `qqvvlornhvfykusaxaid` (dashboard name "maknon Project"; confirmed by the owner as the new JADARAH project; it was empty on 2026-11-10)
- URL: `https://qqvvlornhvfykusaxaid.supabase.co`
- Migrations: `supabase/migrations/2026111000000{1..8}_*.sql` — **all 8 applied** via Supabase MCP (`list_migrations` shows them).
- RLS: enabled on every `public` table. Privileged writes only via SECURITY DEFINER RPCs that re-check roles.
- Storage: 6 private buckets (`candidate-cvs`, `candidate-certificates`, `candidate-projects`, `assessment-attachments`, `company-documents`, `interview-attachments`) with object policies.
- Types: `src/types/database.ts` (regenerate after schema changes).
- No service-role key is stored anywhere in the repo. Scripts that need it read `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`.

## Auth & email status (verified 2026-11-10)
- Email confirmation is ON (signUp returns no session).
- Real delivery verified: confirmation email and password-reset email were delivered to an authorized Gmail inbox (plus-addressed test identity) by `noreply@mail.app.supabase.io`.
- Confirmation link confirmed the address (`auth.users.email_confirmed_at` set).
- PKCE `/auth/callback?code=` exchange verified via the reset flow → `/reset-password` → password updated → new password signs in.
- SMTP: **Supabase default SMTP** (rate-limited, only for team-member addresses). Production needs custom SMTP (Dashboard → Auth → SMTP). Not configurable via MCP.
- Site URL / redirect URLs: default `http://localhost:3000` works locally. Add the production domain in Dashboard → Auth → URL Configuration before deploying.

## Business rules enforced in the database
- Shortlisted-before-interview: `create_interview()` + trigger `interviews_enforce_shortlist`.
- Hire without shortlist: allowed (`change_application_status(..., 'hired')`).
- Status machine: `application_transition_allowed()` + trigger `applications_enforce_transition`; mirrored in `src/lib/domain/application-status.ts`.
- Internal notes / status reasons: company-only RLS; candidates read `get_application_timeline()`.
- AI never changes application state (no AI code path calls status RPCs).

## Required environment variables
See `.env.example`. Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`. Server: `SUPABASE_SERVICE_ROLE_KEY`, `JADARAH_ENV`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `AI_TIMEOUT_MS`.

## Resume commands
```bash
cd ~/Developer/Jadarah
git checkout feature/jadarah-greenfield-build && git pull
npm ci
cp .env.example .env.local   # fill values
npm run dev
```

## Progress checklist
- [x] Repo, branch, Next.js 16 scaffold (App Router, TS strict, Tailwind v4)
- [x] Schema, RLS, storage, business-rule RPCs (applied)
- [x] Brand system, logo assets, signature animation
- [x] Landing page (AR/EN), language + theme persistence
- [x] Auth flows (signup, confirm, sign in, reset, sign out) — verified with real email
- [ ] Candidate workspace
- [ ] Company workspace
- [ ] Super Admin workspace
- [ ] AI provider layer
- [ ] Demo seed (10 companies, 30+ candidates, 30+ jobs, 15 assessments, 40+ resources, 10 plans)
- [ ] Tests (Vitest unit, DB integration/RLS, Playwright E2E)
- [ ] CI, docs, deployment prep

## Known issues
- After a successful password reset the redirect sometimes lands on `/` instead of the role home (fallback now `/onboarding`). Re-verify.
- The in-app browser pane cannot open `*.supabase.co` links; email links were resolved with `curl` and the resulting callback URL opened in the app.

## Next three priorities
1. Workspaces (candidate, company, admin) on the existing RPCs.
2. Demo seed with real Auth identities.
3. Tests + docs + CI.
