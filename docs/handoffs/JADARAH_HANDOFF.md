# JADARAH | جدارة — Engineering Handoff

> Keep this file current. A new session must be able to resume from GitHub alone.

## Project
AI-assisted, evidence-based talent intelligence & recruitment platform (candidates, companies, Super Admin). Taglines: **أكثر من سيرة ذاتية.** / **Beyond What's Seen.** Brand colours (exact): `#0F1B3D` `#3B66F6` `#A9B8FF` `#CDE7F6` `#F8F6F0`. Fonts: IBM Plex Sans Arabic / Manrope. Original logo: three ascending slabs + "merit diamond" (`src/components/brand/logo.tsx`, `public/brand/*`).

## Session 2026-11-11 — new Mac (current status, read first)
**Machine setup (this Mac):** Node v24.22.2 LTS at `~/.local/node`, gh 2.103.3 at `~/.local/bin/gh` (user-local, checksum-verified; not on the default PATH — use `export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"`). Xcode CLT installed. Git identity is repo-local (Nada Al-Nashwan). Push with `git -c credential.helper='!~/.local/bin/gh auth git-credential' push` (gh logged in as Nadaalnashwan). `.env.local` recreated from the target configuration; secrets entered by the owner.

**AI provider status (verified with live keys via `npm run ai:verify`):**
| Provider | Model | Status |
|---|---|---|
| Gemini (structured) | `gemini-3.8-flash` | Model ID exists; **overloaded at Google** (503 "high demand", 20–90 s timeouts) on 2026-11-11 |
| Gemini backup (owner-approved) | `gemini-3.5-flash` | **Working** — schema-valid CV extraction ~2.7 s. Used automatically when 3.8 is overloaded/times out (15 s primary budget) |
| Gemini embeddings | `gemini-embedding-2` @768 | **Working** — 699 ms single, 63 texts in 2.4 s |
| Groq (fast) | `openai/gpt-oss-120b` | **Working** — 539 ms, valid JSON |
| OpenAI (deep) | `gpt-6.1-sol` | Model ID exists; key valid; **account has no credits** (`credit_balance_exhausted`) — owner must add billing. Deep tasks fall back to Gemini (labelled) meanwhile |
| Daily.co | — | **Key valid** (domain `midan`); integration not built yet |
| Resend | — | Future work, lowest priority, not integrated |
Note: `gemini-2.5-flash` (old default) is retired for new users.

**Done this session**
- `src/services/ai/config.ts` + `provider.ts`: task routing (fast→Groq, structured→Gemini, deep→OpenAI), approved same-provider backup model, per-model timeouts, bounded retries (overloaded/timeout → next model, no same-model retry), visible cross-provider fallback (`AI_STRICT_ROUTING=true` disables), per-user 10-min cache for `cacheable` calls, Gemini 3 `thinkingLevel`, Gemini `responseJsonSchema` from Zod, SSE `streamText()` for Groq/OpenAI/Gemini (not yet wired into the assistant UI), every call logged to `ai_provider_logs` (provider/model/latency/tokens/error code — no prompts).
- Migration **0013 `semantic_embeddings` applied**: `skill_embeddings`, `candidate_embeddings`, `job_embeddings` (vector(768), model+dims-keyed, RLS), RPCs `related_skills`, `semantic_fit`, `semantic_job_ranking` (security invoker). Types hand-added to `src/types/database.ts`.
- Backfilled 63 skills / 33 candidates / 30 jobs (`npm run ai:embed-skills`, `npm run ai:embed-profiles`). Measured: unrelated skill pairs median cosine 0.78 (p99 0.88; Java↔JavaScript 0.90) → related-skill threshold **0.92**. Candidate↔job: top-1 = candidate's own role in **28/28**; fit range 0.66–0.87 (median 0.725) → gauge calibrated 0.65–0.88.
- Match explanation (candidate job page + company application page) shows semantic similarity and related skills as **labelled AI inference, never part of the evidence score**. Embeddings refresh under the user's session when content hash changes.
- typecheck, lint, build pass.

**Demo password:** the old `DEMO_USER_PASSWORD` was lost. With owner approval, `npm run demo:rotate-password -- --yes` set a new random password on the 61 `@jadarah-demo.test` identities only (no data touched) and wrote it to `.env.local` on this Mac. Ask the owner for it on other machines, or rotate again.

**Verified end to end (2026-11-11, real providers)** — `RUN_LIVE_AI=1 npx playwright test tests/e2e/ai-live.spec.ts`: **5/5 pass**
| Journey | Result |
|---|---|
| Candidate CV upload → AI extraction with evidence | ✓ (Gemini 3.5 ~3 s, or Groq ~5 s when Gemini overloaded) |
| Candidate assistant | ✓ Groq gpt-oss-120b, ~0.6 s provider / ~2 s UI |
| Semantic similarity panel on job detail | ✓ labelled AI inference |
| Company AI job draft | ✓ (Gemini 3.5 ~6 s / Groq ~3.4 s) |
| Company assistant + interview question suggestions | ✓ Groq ~0.6 s / ~1.4 s |
Regression: lint ✓, typecheck ✓, vitest 30/30 ✓, existing Playwright 13 passed (1 skipped by design) ✓.

**Phase 3 progress (2026-11-11)**
- ✓ Rubric-assisted evaluation: "Suggest rubric scores with AI" on the company application page (deep task; per-criterion scores clamped, evidence quotes verified against the answer, prompt-injection guard). Suggestions only — reviewer edits and submits. Live E2E ✓.
- ✓ Job → AI assessment: Assessment Builder can base generation on a company job; AI drafts questions + a job-tailored rubric; new **RubricEditor** (edit on drafts, read-only when published). Live E2E ✓.
- ✓ Migration 0014 (new AI record kinds) and **0015 (bug fix: companies could never create/clone assessments — INSERT…RETURNING failed RLS)** applied.
- Tests: vitest **33/33** (new `tests/integration/assessments-and-semantic.test.ts`), live AI E2E **7/7**.
- Test artifacts: live E2E creates draft assessments titled `E2E live AI assessment <timestamp>` in Nawat, and `e2e-live-ai-cv.pdf` CV versions for candidate01 (harmless demo data).
- ✓ AI career plan: setting a career goal personalises milestones from the deterministic gap analysis (only verified library resources / required skills accepted; template fallback labelled rule-based). Live E2E ✓. **Phase 3 complete.** Live AI E2E total: 8/8.

**Phase 4 progress — internal calendar (2026-11-11)**
- ✓ Backend (migrations 0016–0017 applied): `interviews.ends_at`, `candidate_confirmed_at`; participant booking windows with **EXCLUDE USING gist** (no interviewer double-booking, DB-enforced); candidate double-booking rejected (23P01); `interviewer_availability` (weekly, RLS); `interviewer_busy()` free/busy RPC; `confirm_interview_attendance()`; reschedule/cancel notify candidate **and** interviewers; **pg_cron** job `jadarah-interview-reminders` every 5 min (24 h / 1 h / evaluation-due, idempotent `interview_reminders` ledger).
- ✓ `tests/integration/calendar.test.ts` 2/2 (live). Found + fixed: `ON CONFLICT DO NOTHING` swallowed exclusion violations (0017).
- ☐ Calendar UI (month/week/day), availability editor, scheduling form with free/busy slots, candidate interviews page with confirm button.
- Dashboard to-dos for owner: enable leaked-password protection (Auth); `public.rls_auto_enable()` is a Supabase-created function flagged by the advisor.

**Bug fixed:** CV upload was broken — `cv-actions.ts` exported a constant from a `"use server"` module (Next 16 rejects it → 500 on every CV page action). Pre-existing; previous E2E never uploaded.

**AI reliability behaviour:** Groq/OpenAI use `json_schema` structured outputs; quota/auth errors are not retried; a process-wide circuit breaker skips overloaded/timed-out models for 3 min and quota/auth failures for 10 min. On 2026-11-11 Google reported both Gemini 3.8 and 3.5 Flash as overloaded intermittently — structured tasks then ran on Groq (visible in badges + `ai_provider_logs`).

**Exact next steps**
1. Owner: add OpenAI credits (deep evaluation currently skipped as `openai_quota_exhausted`).
2. ~~Streaming assistants~~ — done: `/api/assistant` streams Groq tokens (first token 0.5–0.7 s); access tests in `tests/e2e/api-security.spec.ts`.
3. Phase 4–6: internal calendar (availability, conflict-safe booking via DB exclusion constraint, notifications + reminders via pg_cron), Daily rooms/tokens, Final Candidate Evaluation Report.
4. Phase 7: Playwright E2E, Vercel preview deploy.

## Repository
- Repo: https://github.com/Nadaalnashwan/Jadarah — branch `feature/jadarah-greenfield-build` (only branch on the remote; `main` was never created; do not merge without owner approval).
- Local clone: `~/Developer/Jadarah`.
- Latest verified pushed commit: run `git ls-remote origin refs/heads/feature/jadarah-greenfield-build` (each checkpoint in `git log` is pushed and verified).

## Supabase
- Project ref `qqvvlornhvfykusaxaid` (dashboard name "maknon Project"; confirmed by the owner as the new JADARAH project).
- Migrations 0001–0017 in `supabase/migrations/` — **all applied** (0013–0017 on 2026-11-11 via MCP) (0009 and 0012 were applied by fetching the pinned commit file through the `http` extension; content identical to the repo files).
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
- AI: see the 2026-11-11 table above (Gemini/Groq/embeddings live; OpenAI blocked on billing). Rule-based fallbacks remain and are labelled.
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
