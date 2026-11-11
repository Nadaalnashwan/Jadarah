# JADARAH | جدارة — Engineering Handoff

> Keep this file current. A new session must be able to resume from GitHub alone.

## Session 2026-11-11 — CV upload, assessment workflow, fabricated data, logo (read first)
Branch `feature/jadarah-product-experience`. **No change was made to the hosted Supabase project** (read-only queries only); proposal 0030 lives in `supabase/proposals/` and needs owner approval.
- **CV upload (fixed):** root cause — `candidate_documents.candidate_id` references `candidate_profiles`, which a new candidate does not have during CV-first onboarding → FK error (23503) → the uploaded file was deleted and "Upload failed" shown. `registerCvUpload` now creates the empty profile row first, resolves PDF/DOCX from extension **and** declared type (browsers often send `""`/`octet-stream` for .docx), re-checks the stored bytes (`%PDF` / ZIP / OLE signatures, size), records each upload as a new version (original preserved, private). `parseCv` never throws to the client: unreadable files (scanned PDF without AI, legacy .doc, no details found) are saved and the candidate gets a clear "complete manually" path. Extraction results are **grounded** in the CV text (`lib/domain/cv-grounding.ts`): quotes not in the document are dropped, unsupported "stated" skills become "inferred", items not found word-for-word start unticked and are flagged. Also fixed: onboarding "Next" submitted the form on step 2 and skipped the Skills step.
- **Workflow:** apply → task assigned in the same transaction (already DB-side since 0025) → immediate access → submit → employer evaluates. Remaining employer gate removed from the product: the candidate progress rail no longer puts "Under review" before the task; while the task is outstanding the employer can only reject or hire (`employerTargets`, enforced in `changeStatus`); the manual "assign assessment" panel is relabelled "additional" and never re-assigns the job task. Shortlist-before-interview, hire-without-shortlist, duplicate prevention and answer-key protection unchanged and re-tested.
- **Fabricated data:** landing "Live from the demo database" showcase (fictional candidate, company funnel, plan) replaced by a data-free product explainer; footer/terms no longer describe demo/simulation content; imported practice listings (`listing_type='simulation'` with no employer author — the 20 jobs at the registry organizations) are no longer listed on the job board, organization pages, candidate discovery or recommendations (`LISTED_JOB_FILTER`); employer-posted jobs are no longer mislabelled "Simulation" (column default); talent pool and employer application lists hide demo identities from real organizations; public job board has an empty state. Permanent removal: `scripts/cleanup/remove-fabricated-data.sql` (dry run by default; verified locally).
- **Logo:** the symbol viewBox (`2 7 104 115`) cut off the bottom of the front layer and the luminous path in every placement; now `1 11.7 106 116` (even margin), lockup/app icon place it through a nested `<svg>`; the in-app `Logo` keeps the mark's true aspect ratio and has `sm`/`md`/`lg` sizes (meet page no longer squeezes it with `h-8`). Verified desktop + Pixel 7, light/dark, AR.
- **Fresh installs:** 0011 no longer fails on a new project (it revoked seed functions that don't exist yet).
- **Tests:** see TESTING.md (2026-11-11 CV/workflow section). Local Supabase + production build; registry-organization specs need hosted data.
- **Environment caution:** this cloud environment exports `NEXT_PUBLIC_SUPABASE_URL` for an unrelated project and Groq/Daily keys; `dotenv` does not override existing variables, so unset them before running tests against `.env.local`.

## Session 2026-11-11 (cloud) — completion audit, part 1 (read first)
- **Database:** maknon Project, ref `qqvvlornhvfykusaxaid` (ap-southeast-1, Postgres 17). Owner-confirmed production database for JADARAH. All 27 repo migrations applied (28 ledger rows incl. `product_experience_embed_fix`). **No database mutations were made this session.**
- **Cloud environment warning:** the Claude Code *Default* environment's `NEXT_PUBLIC_SUPABASE_URL`, `DATABASE_URL`, `DIRECT_URL` point to a different project (`squpszwbrqkflezfltoj`, no JADARAH tables). In cloud sessions, export the maknon public values before running the app (Next.js lets process env override `.env.local`). Not changed, because the Default environment serves other repositories.
- **Read-only audit:** RLS on all 83 public tables (`interview_reminders` intentionally has no policies); all SECURITY DEFINER functions pin `search_path`; buckets private except `company-identity` (public logos). Advisor: 4 functions executable by anon without need + `rls_auto_enable()` granted to `authenticated` → **proposal 0028** (`docs/proposals/0028-function-execute-hardening.md`, SQL in `supabase/proposals/`, NOT applied, awaiting owner approval). Leaked-password protection is off (dashboard steps in the proposal).
- **Verified against maknon:** typecheck ✓, production build ✓, `next start` smoke test (public pages 200 with live data, 21 published jobs; protected routes 307 → sign-in).
- **New local DB harness:** `tests/db/run-local.sh` applies every migration + the fictional demo seed to a throwaway local Postgres 16 (+pgvector; pg_cron stubbed) and runs `tests/db/*.test.sql`. Never touches a remote database.
- **Missing for full verification:** `DEMO_USER_PASSWORD` (signed-in E2E, live integration), `GEMINI_API_KEY`, OpenAI credits, SMTP/email provider, `DAILY_WEBHOOK_SECRET` + a public URL.

## Session 2026-11-11 — product experience (read first)
Branch: `feature/jadarah-product-experience` (from `feature/jadarah-greenfield-build` @ 0fceeed). Migrations **0025–0027 applied** to `qqvvlornhvfykusaxaid`.

**Brand (approved Brand Identity Boards are the source of truth):** new symbol — three translucent layered portals, recessed glowing doorway, luminous path (`src/components/brand/logo.tsx`, `public/brand/*`, `src/app/icon.svg`, regenerated by `node scripts/brand-assets.mjs`); lockup «جَدارة / JADARAH» with symbol on the right (never mirrored); palette from the boards (light: #0D1B3F #3B6CFF #8A8DFF #CFE4FF #FFF7E8 on #F5F4FC; dark: #18264A surfaces on #111B3D, #A9B8FF, #CDE7F6, #EEF3FF); tagline «من المهارة إلى الفرصة.»; BrandPattern / BrandWave / BrandLoader; auth panel, footer banner, empty and loading states use them.
**Landing:** one five-chapter 3D journey (enter portal → discover → develop → demonstrate → converge) along the luminous path (Three.js, procedural, lazy; posters `public/city/poster-{light,dark}-{rtl,ltr}.jpg` as fallback/LCP). Kingdom Centre, KAFD, Jeddah Tower, Al Khobar Water Tower are environment only — no districts, no directories, no geographic navigation. Skip, keyboard arrows, reduced motion, low-power quality.
**Employer:** job editor "حفظ وإنشاء مهمة عملية" → `/company/jobs/[id]/task` (AI / template / manual, idempotent `creation_key`) → task attached via `attach_job_task` → job page task panel (status, lock, replace, remove). Publishing a job with a draft task is blocked by the DB.
**Candidate:** apply → task assigned in the same transaction → redirected to the task → submit completes the application; job page shows a safe task preview and the company's identity. CV-first onboarding (upload → extraction → full editable review → approved data persisted without duplicates; skippable). Career discovery `/candidate/discover` + 12 exploratory tasks with grounded feedback (private, never a hiring score).
**Shortlist → interview:** «ترشيح للمقابلة» on the application (validated transition) opens scheduling in place; confirmation stays on the application.
**Company identity:** `/company/profile` logo/cover/colours/taglines with live preview + contrast; scoped CSS vars; shown in workspace sidebar, job pages, task workspace. Directory shows contact actions only for verified data.
**Not done / blocked:** GitHub push from the cloud session was refused (403 — the Claude GitHub App has read-only access to the repo); signed-in E2E and live integration tests need `DEMO_USER_PASSWORD` (not available in the cloud session); AI/Daily keys were not present in the cloud session (AI features fall back to labelled rule-based behaviour).


## Project
AI-assisted, evidence-based talent intelligence & recruitment platform (candidates, companies, Super Admin). Taglines: **أكثر من سيرة ذاتية.** / **Beyond What's Seen.** Brand colours (exact): `#0F1B3D` `#3B66F6` `#A9B8FF` `#CDE7F6` `#F8F6F0`. Fonts: IBM Plex Sans Arabic / Manrope. Original logo: three ascending slabs + "merit diamond" (`src/components/brand/logo.tsx`, `public/brand/*`).

## 2026-11-11 — Assessment Builder "Generation is unavailable" after a Gemini key change (fixed)
- **Cause (from `ai_provider_logs`):** `gemini-3.5-flash-lite` returned 503 overloaded (after 65 s). The router then **skipped `gemini-3.8-flash`, `gemini-3.5-flash` and OpenAI without calling them**, because a 10-minute in-memory "quota exhausted" cooldown from the *previous* key was keyed only by provider+model and survived the `.env.local` reload. Only Groq was left: its output was cut off at 3,072 tokens (`schema_mismatch`), and the retry hit its 8k tokens/min limit (`groq_rate_limited`) → `AIUnavailableError`.
- **Fixes:** cooldowns are keyed by provider + model + a short hash of the API key, so a new key takes effect immediately (`src/services/ai/provider.ts`). Builder retrieval (Gemini embeddings) failing no longer aborts the action — generation runs without references (`retrieveReferences`).
- **New key, probed with one tiny request each (2026-11-11 08:5x +03):** `gemini-3.5-flash-lite` 200 · `gemini-3.8-flash` 200 · `gemini-3.5-flash` 200 · `gemini-embedding-2` 200 (768 dims). Free-tier daily limits still apply.
- **Verified:** one builder generation through the UI (fictional regression company Nawat, so nothing added to the 10 organizations) → draft `4e2ae323-e77e-4a0e-ad6c-36e4a89213be`, `gemini-3.5-flash-lite`, 7.4 s, 11/11 checks, unpublished. It used 0 references, by design: the generic test job did not pass the relevance filter (score ≥ 0.38 or same role). The five saved drafts were not touched.
- Routing in effect: `AI_STRICT_ROUTING` unset (fallback on). Builder chain: 3.5-flash-lite → 3.8-flash → 3.5-flash → OpenAI (no credits) → Groq (8k TPM; too small for full assessments).

## Session 2026-11-11 (later) — restored on the owner's Mac (read first)
- Local clone fast-forwarded from `9952120` to `b93c6c4` (no local changes lost). Node v24.22.0 at `/usr/local/bin/node`; `gh` is **not installed** on this Mac (plain `git push` over HTTPS works). `.env.local` present with all keys used by the code (values not printed).
- Supabase: migrations **0001–0024 all applied** (checked via MCP). Demo password in `.env.local` signs in demo identities (verified, not printed).
- Site: `npm run dev` → http://localhost:3000 (landing, sign-in, `/companies` with exactly the 10 organizations, all 10 profile pages 200, no MIDAN text).
- The five saved builder drafts verified **read-only** by `tests/integration/saved-assessments.test.ts` (5/5): draft status, owning organization, tasks + rubric + assessor guide present, rubric editable by the owning recruiter, candidate CSVs download for the owner only; other organizations and candidates see nothing (assessor guide included); no legacy branding.
- Fixed: public opportunity page showed "Sign in to apply / Create account" to signed-in users → candidates now get **Apply** (→ `/candidate/jobs/[id]`), other roles get **Dashboard**.
- Test hygiene: E2E sign-in helper waits for the post-sign-in redirect to settle (a following `goto()` was sometimes overridden). New gated `tests/e2e/evidence.spec.ts` (`CAPTURE_EVIDENCE=1`) captures `docs/evidence/11–17-*.png`.
- Results on this Mac (final code): typecheck ✓ · lint ✓ · production build ✓ · vitest **64/64** (59 + 5 new) · Playwright **24 passed, 0 failed** (19 gated live/evidence specs skipped) against the production build (`next start -p 3100` + `E2E_BASE_URL=http://localhost:3100`, so the dev site on :3000 stays up). Running E2E against `next dev` is flaky (on-demand compilation) — use a production build.
- **Security (owner action):** the project's **legacy JWT API keys are still enabled**, and the `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is a legacy `service_role` JWT that is **still valid**. If that is the key seen in the screenshot, it is still active. A legacy JWT cannot be revoked on its own. Plan: Dashboard → Project Settings → API Keys → create a new **secret key** (`sb_secret_…`) → owner pastes it into `.env.local` as `SUPABASE_SERVICE_ROLE_KEY` (scripts only) → **disable legacy API keys** (the web app uses only the publishable key, so the site is unaffected). Not done without approval.
- Remote note: a `main` branch now exists on GitHub at `42fc037` (older commit; not created in this session). Untouched.

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
- ✓ Calendar UI: `/company/calendar` (month/week/day, Asia/Riyadh, brand colours, RTL, phone → Day view), `/company/availability` (weekly editor), scheduling form **free-slot finder** (availability ∩ free/busy), `/candidate/interviews` (invitations + Confirm attendance). Nav items added. `src/lib/domain/calendar.ts` + 9 unit tests; `tests/e2e/calendar.spec.ts` passes (availability → slot-finder scheduling → candidate confirms → calendar). **Phase 4 complete.**
- Dashboard to-dos for owner: enable leaked-password protection (Auth); `public.rls_auto_enable()` is a Supabase-created function flagged by the advisor.

**Phase 5 — Daily.co video interviews ✓ (2026-11-11)** — migration 0018 applied. Private room per video interview (created at scheduling / on first interviewer join; opens 15 min before, closes 30 min after; moved on reschedule; deleted on cancel). `interview_video_access()` gates `/meet/[id]` (candidate of the application or assigned interviewers only). Server-minted short-lived tokens; API key server-only; no recording. Waiting room + Daily Prebuilt (camera/mic/screen share; Prebuilt UI has no Arabic — JADARAH chrome is bilingual). `interview_attendance` join/leave tracking. **Verified:** `RUN_LIVE_VIDEO=1 npx playwright test tests/e2e/video.spec.ts` — real two-person call, both joined the same private room, attendance recorded; outsiders refused. Daily webhooks (`DAILY_WEBHOOK_SECRET`) not used yet (needs a public URL).

**Bug fixed:** CV upload was broken — `cv-actions.ts` exported a constant from a `"use server"` module (Next 16 rejects it → 500 on every CV page action). Pre-existing; previous E2E never uploaded.

**AI reliability behaviour:** Groq/OpenAI use `json_schema` structured outputs; quota/auth errors are not retried; a process-wide circuit breaker skips overloaded/timed-out models for 3 min and quota/auth failures for 10 min. On 2026-11-11 Google reported both Gemini 3.8 and 3.5 Flash as overloaded intermittently — structured tasks then ran on Groq (visible in badges + `ai_provider_logs`).

**Phase 6 — Final Candidate Evaluation Report ✓** (migration 0019): `/company/applications/[id]/report` — sections A–H, transparent overall score, AI-assisted recommendation (de-identified evidence, source-tagged), editable 7-dimension interview rubric, reviewer comments, human decision (finalize + lock; hire without shortlist preserved), explicit candidate feedback sharing.

**Phase 7 — verification (2026-11-11):** typecheck ✓ · lint ✓ · production build ✓ · vitest **51/51** · Playwright standard **17/17** · live AI **9/9** · live two-person Daily video **1/1**. See TESTING.md.

**Status by category**
- Completed and verified: restore on new Mac; Gemini (3.5 backup active; 3.8 overloaded at Google), Groq, Gemini embeddings; CV parsing; semantic matching; assessment generation + job-tailored rubric; rubric-assisted evaluation; assistants (streaming); career plans; internal calendar + reminders; Daily video; final evaluation report.
- Implemented but not externally configured: OpenAI deep evaluation (key valid, **no credits** — deep tasks currently served by Gemini/Groq, visibly labelled); Daily webhooks (no public URL yet); custom SMTP (dashboard).
- Not implemented (by decision): Resend — future work, lowest priority.
- Not done: Vercel deployment (needs owner authorization + Vercel account; see DEPLOYMENT.md).

**Exact next steps**
1. Owner: add OpenAI credits; enable leaked-password protection; configure custom SMTP; set production Site URL/redirects.
2. Deploy a Vercel **preview** from `feature/jadarah-greenfield-build` (owner authorizes and logs in to Vercel); add env vars (server keys only, never `NEXT_PUBLIC_`); add the preview URL to Supabase Auth redirect URLs; run the Playwright suite against `E2E_BASE_URL`.
3. Optional: Daily webhooks (meeting.started/ended) once a public URL exists; shared rate-limit store (Upstash) before horizontal scaling.

## Session 2026-11-11 (B2B + 10 organizations + reference library + Assessment Builder) — read first
**Status: complete except the blockers below.** Migrations **0020–0024 applied** (`npx tsx scripts/import/apply-migration.ts <file>`, transactional, recorded in the ledger).
- **B2B (0020–0022):** Super Admin provisions organizations; subscriptions (pending/active/suspended/expired/cancelled, SAR, period, credits, payment status, notes); payments; revenue view separates recorded payments, contract value and demonstrations. Employer access = active user + approved membership + authorised role + approved org + eligible subscription, enforced in `has_company_role` (all employer RLS/RPCs) and `requireCompanyMember` (`/workspace-paused`). No org-count limit, no public company creation, no gateway. Employee flow: `/employer/request-access` → email verification → `/onboarding/company` pending → `/admin/access-requests` approve (role adjustable) / reject.
- **Registry organizations:** ALM-001…010 imported idempotently (`scripts/import/import-organizations.ts`), listed, demonstration subscriptions (no price), 30 demo identities (`{admin|recruiter|interviewer}.{mc,gea,elm,dgda,stc,sdaia,sipchem,srsa,mof,sidf}@jadarah-demo.test`), 20 **simulation** jobs (labelled everywhere). Jadarat Jobs sheet empty → no verified jobs. Brand assets not verified → neutral identity tiles (no logos). Fictional companies unlisted, kept for regression.
- **Reference library (0023):** `scripts/import/import-references.ts <pkg dir>` — 22 packages: **16 complete + validated**, 6 assessor-only guides marked incomplete (no candidate material in the package). Scanned PDFs transcribed by vision, page by page where the model stopped early (`.vision.paged.txt` cache). Extraction model recorded per row (`gemini-3.5-flash-lite`, owner-approved for the import). 4,156 sector skills. 65 originals in private bucket `reference-library` (Super Admin only, verified live). Assessor content in a Super Admin-only table; recruiters get rubric structure only.
- **Assessment Builder:** `/company/assessments/builder` — retrieval (embeddings + skill/sector/role fit) → few-shot generation (structure only, never copied) → 11 automatic checks → one repair pass → draft with practical tasks, deliverables, synthetic CSVs, rubric, separate assessor guide; regenerate per section, edit, approve & publish (re-validates). **Never auto-published.**
- **Generated (all drafts, 11/11 checks, `gemini-3.5-flash-lite`):** Elm Software Engineer `469cf06b-5abd-45d7-8def-fcde2012edcc` · SDAIA ML Engineer `8b722600-2aa2-45eb-b6cd-0cfeb608ae62` · MoF Financial Analyst `2baae631-cf86-482e-a5da-d7c305e4eeea` · GEA Event Coordinator `ca322235-3346-4c0b-abbd-bc3c116fbddf` · Sipchem Quality Engineer `107494cd-3df3-4051-a90b-ec47cbff1cad`. Screenshots `docs/evidence/builder-*.png`.
- **Fixes this session:** 0021 companies could never create jobs; 0024 builder data files could not be saved (no storage UPDATE/DELETE policy; upload is now insert-only after removal); failed saves no longer leave empty drafts (two empty Elm drafts from earlier failed attempts remain, untouched); lite models: schema size constraints sent as description hints (Zod still enforces); rate limiter works outside requests; test jobs auto-close; org profile `h1`; footer/terms no longer call listed organizations fictional.
- **Model routing:** `AI_BUILDER_GEMINI_MODEL=gemini-3.5-flash-lite` in `.env.local` (owner-approved, builder only). Remove it once Gemini Flash has quota to return the builder to `gemini-3.8-flash`.
- **Blockers (owner):** Gemini key (including the replacement key set on 2026-11-11) is on the **Free Tier: 20 requests/day per model**; 3.8/3.5 Flash exhausted → enable billing on the Google project. Google serves `gemini-3.5-flash` under the `gemini-3.6-flash` quota. OpenAI: no credits. Groq: 8k tokens/min (too small for full assessments). Brand assets unverified. No verified job source.
- Tests: vitest 59/59 · Playwright 24/24 (+16 live, gated) · live builder 5/5 · typecheck/lint/build clean. See TESTING.md.

## Repository
- Repo: https://github.com/Nadaalnashwan/Jadarah — branch `feature/jadarah-greenfield-build` (a `main` branch exists on the remote at `42fc037`; never merge without owner approval).
- Local clone: `~/Developer/Jadarah`.
- Latest verified pushed commit: run `git ls-remote origin refs/heads/feature/jadarah-greenfield-build` (each checkpoint in `git log` is pushed and verified).

## Supabase
- Project ref `qqvvlornhvfykusaxaid` (dashboard name "maknon Project"; confirmed by the owner as the new JADARAH project).
- Migrations 0001–0024 in `supabase/migrations/` — **all applied** (verified 2026-11-11) (0009 and 0012 were applied by fetching the pinned commit file through the `http` extension; content identical to the repo files).
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

---

## Update 2026-11-11 — redesign, product fixes, Monitoring & Evaluation (supersedes the limitations above where they conflict)
- **Design system**: exact light/dark tokens in `src/app/globals.css` (same semantic names in both themes; tonal cards via
  `<Card tone="blue|mist|sand|peach|sage|teal|lilac">`; theme-aware chart colours `--chart-*` in `components/app/chart-colors.ts`).
  A few text roles were darkened/lightened slightly from the requested hexes to keep WCAG AA (light secondary #3F5366,
  muted #52606E, link ink #1C44B8; dark muted #C2CFDA, link #B3CCFF, primary-button text #0E1E2E).
- **Landing**: Candidate · JADARAH · Employer first viewport (`features/landing/role-hero.tsx`); CTAs → `/sign-up` and
  `/employer/request-access` (no auth bypass; organizations are never self-activated).
- **Candidate**: dashboard prioritised (actions → applications → opportunities → results → career); assessment file
  evidence works end to end **once migration 0029 is applied** (it is in `migrations/`, not yet on production);
  "My skills" grouped by evidence (demonstrated / CV / self-declared, inline edit, no data removed); Career Development
  ordered requirements → priorities → results → actions.
- **Employer**: dashboard stats from the company stats RPC (no silent redirect on error); numbered job-form sections; CV
  preview beside assessment evidence; Talent Pool removed from navigation (`/company/talent` → applications; no data removed);
  `/company/analytics` uses the shared recruitment monitoring view, scoped to the company.
- **Super Admin**: working filters + pagination on users/jobs/assessments (`lib/admin-filters.ts`, `admin/list-controls.tsx`);
  **/admin/monitoring** with six tabs, alerts and offline evaluation — see `docs/MONITORING.md`.
- **Not applied to production (owner approval needed)**: migration 0029; proposals 0028, 0030, 0031. Timezone risk in
  `company_service_active()` documented in DATABASE.md.
- Next: approve/apply 0029 then 0031 (backup first); add a labelled semantic-matching benchmark before reporting matching quality.

## Update 2026-11-11 (final) — landing film, strict palette, navigation
- Landing: cinematic 3D Riyadh film (`features/landing/saudi-city.tsx` over the existing Three.js scene): autoplay
  opening → candidates → companies, progress bar, pause/replay/skip, reduced-motion manual mode; posters in `public/city/`
  re-rendered from the scene without UI (old posters had a previous interface baked in). The two-card hero was removed.
- Colours: tokens regenerated strictly from the approved palette (`docs/BRAND_COLORS.md`); off-palette literals replaced
  (scene, email templates, auth panel, company-brand fallback). The logo artwork is unchanged.
- Navigation: candidate 14 → 9 items, employer 13 → 9 (`docs/NAVIGATION.md`); grouped pages use tabs; notifications
  and the standalone skills tab removed from the candidate/employer interface without touching data.
