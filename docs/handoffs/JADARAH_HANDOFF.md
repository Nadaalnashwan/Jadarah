# JADARAH | جدارة — Engineering Handoff

> Keep this file current. A new session must be able to resume from GitHub alone.

## Project
AI-assisted, evidence-based talent intelligence & recruitment platform (candidates, companies, Super Admin). Taglines: **أكثر من سيرة ذاتية.** / **Beyond What's Seen.** Brand colours (exact): `#0F1B3D` `#3B66F6` `#A9B8FF` `#CDE7F6` `#F8F6F0`. Fonts: IBM Plex Sans Arabic / Manrope. Original logo: three ascending slabs + "merit diamond" (`src/components/brand/logo.tsx`, `public/brand/*`).

## Repository
- Repo: https://github.com/Nadaalnashwan/Jadarah — branch `feature/jadarah-greenfield-build` (only branch on the remote; `main` was never created; do not merge without owner approval).
- Local clone: `~/Developer/Jadarah`.
- Latest verified pushed commit: run `git ls-remote origin refs/heads/feature/jadarah-greenfield-build` (each checkpoint in `git log` is pushed and verified).

## Supabase
- Project ref `qqvvlornhvfykusaxaid` (dashboard name "maknon Project"; confirmed by the owner as the new JADARAH project).
- Migrations 0001–0012 in `supabase/migrations/` — **all applied** (0009 and 0012 were applied by fetching the pinned commit file through the `http` extension; content identical to the repo files).
- RLS on every public table; least-privilege grants (this project grants nothing to API roles by default — migrations 0010/0011 add explicit grants; **any new table/function needs explicit grants**).
- Storage: 6 private buckets with object policies.
- Demo seed applied: 61 Auth identities, 10 companies (9 approved, Imtidad pending), 30 jobs (24 published), 32 candidates, 15 assessments/75 questions, 51 resources, 10 plan templates, 12 personal plans, 82+ applications, 28+ interviews. `platform_settings.environment = 'demo'`.
- `http` extension enabled (used for loading the seed). Drop it if not wanted.

## Auth & email (verified 2026-11-10)
- Email confirmation ON. Real confirmation + reset emails delivered to the owner's Gmail (plus-addressed test identity `nadooamn+jadarah-e2e1@…`), confirmation link confirmed the user, PKCE callback → reset → new password signs in.
- SMTP: Supabase default (rate-limited). Custom SMTP needed for production (dashboard only).
- Site URL / redirect URLs: defaults work for localhost; production domain must be added in the dashboard.
- **Real Super Admin provisioned (2026-11-10)** for the owner's Gmail address (not demo, role `super_admin` only) via SQL with a random unknown password; the owner sets the password through the password-reset email. `npm run admin:provision` remains available for future admins (needs the service-role key). A demo super admin also exists (`platform.admin@jadarah-demo.test`).
- `/auth/callback` now also handles implicit-flow links (`#access_token=…`, e.g. admin-triggered recovery emails) via the client page `/auth/confirm`; covered by `tests/e2e/auth-confirm.spec.ts`.
- Supabase default SMTP returned HTTP 429 after a few emails in an hour — custom SMTP is needed before real use.

## Completed and verified
- Landing (cinematic, AR/EN, live showcase from demo DB), public pages, public job board.
- Auth flows (signup, confirm, sign in, forgot/reset, sign out, suspended gate, safe `next` redirects).
- Candidate: onboarding (3 steps), overview with interactive charts, profile editor (sections), CV upload/versions/signed download/delete/parse+review, job discovery (search/filters/saved/pagination/match), job detail with explainable match, apply (CV/cover/questions), application timeline (filtered), interviews & shared feedback, withdraw, timed assessment workspace with autosave + results, skill map (radar), career goals → gap analysis → plan → milestones, assistant, notifications, settings/privacy.
- Company: approval banner, onboarding, verification with private docs, dashboard (funnel, donut, per-job, weekly), jobs CRUD + lifecycle + AI draft (review required), applications (filters/sort/pagination), detail (match, CV, profile, answers, status decisions with internal reason + candidate message, notes, assessment assignment, rubric evaluation, shared feedback, shortlist-gated interview scheduling), compare (2–4), talent pool (opt-in), interviews list/detail (questions + suggestions, confidential evaluations, feedback sharing, complete/cancel/reschedule), team (invite/roles/remove, last-admin guard), analytics, company profile, assistant.
- Super Admin: live stats & charts, company review (approve/reject/request info/suspend/reactivate) with documents, users (search/filter/suspend/roles/company admin assignment), jobs & assessments oversight, learning resources (add/activate/link check), reports (snapshots), AI usage, audit logs, settings + integration status, demo environment with guarded reset.
- Tests: 18 unit + 12 live integration/security (30/30) + 11 Playwright (desktop + mobile public, 5 role journeys) — all passing. Lint clean, typecheck clean, production build passes.

## Implemented but not externally configured
- AI providers (Gemini/OpenAI adapters, logging, schemas) — no API key configured; rule-based fallbacks are active and labelled.
- Email notifications — in-app notifications work; outbound email sending not wired to a provider (`notifications.email_status` stays `not_sent`).
- Deployment — Vercel-ready, not deployed.

## Partially implemented / known limitations
- Assessment `file_upload` question type: candidates can answer by text only; file attachment UI not built (bucket + policies exist).
- Interview attachments bucket exists; no UI.
- Rate limiting is in-memory (single instance).
- Company invitations are not emailed; invitees see them at `/invitations` after signing in with the invited email.
- E2E does not mutate company approval (covered by live integration RPC tests instead).
- Arabic numerals: deliberately Latin digits with Gregorian calendar.

## Required environment variables
See `.env.example` and README. Local `.env.local` (gitignored) currently holds public Supabase values, `DEMO_USER_PASSWORD`, and the e2e email-test identity.

## Resume
```bash
cd ~/Developer/Jadarah && git pull
npm ci && npx playwright install chromium
npm run dev                     # or: npm run build && npm start
npx vitest run                  # unit + live integration (needs DEMO_USER_PASSWORD)
npx playwright test             # needs a build (uses npm start) and DEMO_USER_PASSWORD
```

## Next three priorities
1. Owner completes the admin password via the reset email; configure custom SMTP + production redirect URLs.
2. Configure an AI provider key (server env) and verify CV parsing, job drafting and question generation end to end.
3. Deploy to Vercel (see DEPLOYMENT.md), set `environment='production'` for the production database, add CSP.
