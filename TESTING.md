# Testing

| Suite | Command | Scope |
|---|---|---|
| Unit | `npm test` | Status machine, shortlist-before-interview, hire without shortlist, scoring, matching, career calculations, redirect safety |
| Integration / security (live) | `npm run test:integration` | Runs against the real Supabase project as real demo users (needs `DEMO_USER_PASSWORD` in `.env.local`) |
| E2E | `npm run test:e2e` | Playwright browser journeys (needs a running app and demo password) |

## Live integration coverage
`tests/integration/security.test.ts`
- Candidate A cannot read candidate B's applications, documents or profile
- Candidates cannot read notes, status history reasons, interview/assessment evaluations, answer keys
- Company A cannot read company B's applications
- Interviewers see only assigned interviews, never internal notes
- Users cannot promote themselves (direct insert, protected columns, admin RPC)
- Super Admin RPCs reject non-admins
- Anonymous users see only the public catalogue
- Internal helpers are not callable via the API

`tests/integration/recruitment-flow.test.ts`
- Duplicate applications are rejected
- Hiring without prior shortlisting is allowed
- Full journey: apply → interview-before-shortlist rejected → workflow-only status rejected → assign assessment → start (no answer keys in payload) → autosave → submit (resubmit rejected) → keys visible after submit → rubric evaluation (out-of-range rejected) → shortlist → interview → interviewer evaluation (hidden from candidate) → complete → hire → candidate-safe timeline (no internal reasons) → notifications → closed application can't be withdrawn/moved
- Pending companies cannot publish jobs

## Latest results (2026-11-10)
- Unit + integration: **30/30 passed** (`npx vitest run`).
- These live tests found and led to fixing a real enum-cast bug in `submit_assessment` (migration 0012).
- Lint: clean. Typecheck: clean. Production build: passes.
- Email: real confirmation and password-reset emails verified as delivered to an authorized inbox; PKCE callback and password update verified.

## Playwright (2026-11-10)
**11/11 passed** against the production build (`npm run build && npx playwright test`):
- public (desktop + Pixel 7): AR/RTL and EN/LTR landing with live showcase; protected routes redirect; public job board
- candidate: discover → job detail with explainable match → apply → tracking
- company recruiter: applications → detail with evidence match, shortlist gate, internal notes
- interviewer: interviews visible, applications area blocked
- super admin: control center, pending approval queue, audit log
- access control: candidate cannot open company/admin areas

## 2026-11-11 (new Mac) — verified
| Suite | Result |
|---|---|
| Vitest unit + live integration (`npx vitest run`) | **51/51** — adds calendar slots/zones (9), final-evaluation scoring (5), `'use server'` export guard, calendar conflicts (live), final evaluation rules (live), assessments + semantic RLS (live) |
| Playwright standard (`npx playwright test`) | **17/17** (desktop + Pixel 7 public; journeys; calendar availability → slot finder → candidate confirms; assistant API access control) |
| Live AI (`RUN_LIVE_AI=1 npx playwright test tests/e2e/ai-live.spec.ts --project=desktop`) | **9/9** — CV extraction, both assistants (streaming), semantic panel, AI job draft, interview questions, rubric-assisted evaluation, job → assessment + rubric, career plan, final evaluation report |
| Live video (`RUN_LIVE_VIDEO=1 npx playwright test tests/e2e/video.spec.ts`) | **1/1** — real two-person Daily call in a private room; outsiders refused |

Notes: the app limits sign-in to 10/min per IP; the E2E `signIn` helper waits out the window once instead of weakening the control. Live suites cost provider credits and create demo artifacts (draft assessments, CV versions, cancelled interviews).

## 2026-11-11 (B2B, registry organizations, reference library, Assessment Builder)
| Suite | Result |
|---|---|
| Typecheck · lint · production build | clean · 0 warnings · passes |
| Vitest (`npx vitest run`) | **59/59** — adds assessment quality checks (5), B2B chain (2, live), assessment materials + reference library confidentiality (1, live, includes the private `reference-library` bucket) |
| Playwright standard (`npx playwright test`) | **24/24** (16 live specs skipped by flag) — adds `b2b.spec.ts`: directory (ten organizations, fictional hidden, no unverified logos, no legacy branding), ten profiles with Simulation labels, candidate-only sign-up + database-driven employer access form, Elm workspace + labelled opportunities, subscriptions (demonstrations apart from revenue), employee access request → pending (no workspace) → Super Admin decision |
| Live builder (`RUN_LIVE_AI=1 npx playwright test tests/e2e/builder-live.spec.ts --project=desktop`) | **5/5** — Elm SWE, SDAIA ML Engineer, MoF Financial Analyst, GEA Event Coordinator, Sipchem Quality Engineer; each a draft with 11/11 checks, references, CSV data, rubric, assessor guide. `BUILDER_ONLY=elm,…` limits the run |

Evidence screenshots: `EVIDENCE_DIR=$PWD/docs/evidence npx playwright test tests/e2e/b2b.spec.ts --project=desktop` → `docs/evidence/`.
Test hygiene: `freshJob()` closes its job when the test ends, so test roles never stay in public listings. The access-request E2E uses a throwaway `@jadarah-demo.test` employee and declines the request, so no false membership is created at a real organization (approval is covered by `b2b.test.ts` on a throwaway organization).

## 2026-11-11 (restored on the owner's Mac)
- vitest **64/64** (adds `tests/integration/saved-assessments.test.ts`: the five saved builder drafts — owner access, rubric editable, CSV download, no cross-company or candidate access, no legacy branding; read-only).
- Playwright **24 passed, 0 failed** (19 gated specs skipped) against a production build on port 3100: `npx next build && npx next start -p 3100`, then `E2E_BASE_URL=http://localhost:3100 npx playwright test`.
- Visual evidence: `CAPTURE_EVIDENCE=1 E2E_BASE_URL=… npx playwright test tests/e2e/evidence.spec.ts --project=desktop` → `docs/evidence/11–17-*.png`.

## 2026-11-11 (product experience: job-linked tasks, identity, CV-first, discovery, brand journey)
| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint .` | clean |
| `npx vitest run tests/unit` | **49/49** — adds brand colour/contrast + safe identity URLs (5), CV date normalisation (2), career discovery + exploratory feedback (4) |
| `npx next build` | passes |
| Playwright `tests/e2e/public.spec.ts` (desktop + Pixel 7, production build) | **6/6** — landing AR/RTL + EN/LTR, journey chapter + skip, no district/directory UI, protected routes, public job board |
| Database lifecycle (live project, impersonated demo users inside a transaction that is rolled back) | apply → task auto-assigned (`assessment_pending`, incomplete) · duplicate apply rejected (23505) · start twice = same attempt · no answer keys in the attempt payload · submit → application complete · other user cannot start the task (42501) · task cannot be replaced or edited once assigned · anonymous task preview |
| Company identity RPC (same method) | admin saves · other company / recruiter / direct insert rejected (42501) · invalid colour and foreign storage path rejected (23514) · public read |

Not run here (need the demo password, which is not available in this environment): `npm run test:integration` and the signed-in Playwright journeys (`journeys`, `calendar`, `b2b`, live AI/video). `tests/e2e/calendar.spec.ts` was updated for the new behaviour (scheduling now returns to the application with `?scheduled=<id>`).
If your Playwright browser version differs, set `PW_CHROMIUM_PATH` to a Chromium executable.

## 2026-11-11 (CV upload, assessment workflow, fabricated data, logo) — executed in a cloud session
All runs used a **local Supabase stack** (`supabase start`, Postgres 17) built from `supabase/migrations/0001–0027`, i.e. the
schema the hosted project has today. The hosted project was only read (no writes, no migrations). AI/video keys were removed
from the test processes (CV extraction ran in its labelled rule-based mode).

Local preparation (after `supabase start`): load `supabase/seed/demo_seed.sql` and `select public.seed_demo('<pw>')`; then
re-run the two data backfills that the hosted project got because the seed predated them —
`insert into company_subscriptions (company_id, plan, status, is_demo, payment_status) select id, 'legacy_demo', 'active', true, 'demo' from company_profiles where is_demo and status = 'approved' on conflict do nothing;`
and `update applications set completed_at = submitted_at where completed_at is null and not requires_task;` — and mirror the
hosted project's anon grants (`revoke select … from anon` on all public tables, `grant select` on the catalogue tables only).

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint .` | 0 problems |
| `npx next build` | passes |
| `npx vitest run tests/unit` | **68/68** (adds CV type/bytes/grounding 12, workflow + listing provenance 7) |
| `npx vitest run` (unit + integration, local DB, schema 0001–0027) | **88 passed, 9 failed** — new `workflow.test.ts` 3/3 (CV upload for a brand-new candidate incl. the original FK defect, apply → task assigned with no employer step → no answer keys → submit → employer sees CV + evidence → shortlist; hire without shortlist), `security` 8/8, `recruitment-flow` 3/3, `calendar` 2/2, `final-evaluation` 1/1. The 9 failures need data that only exists on the hosted project: the ten registry organizations (`recruiter.elm` …, ALM-003, saved builder drafts) and the embeddings backfill. |
| Same with proposal 0030 applied locally | **88 passed, 9 failed** (same 9) |
| Playwright, production build (`next start -p 3100`), local DB, schema 0001–0027 | **22 passed, 6 failed, 19 skipped** — `core-journeys` 4/4 (sign-up → PDF CV upload → extraction → review → 3-step onboarding; DOCX version; image-only PDF saved with manual path; invalid file refused; apply → task opens immediately → submit → complete; employer sees CV + evidence and shortlists; public board lists only employer jobs; logo proportions), `journeys` 5/5, `calendar` 1/1, `public` 6/6 (desktop + Pixel 7), `api-security` 3/3, `auth-confirm` 2/2. The 6 failures are `b2b.spec` (needs the registry organizations). Skipped: live AI/video/builder/evidence specs (gated) and the real-inbox email spec. |
| Same E2E subset with proposal 0030 applied locally | **21 passed, 1 skipped** |
| `scripts/cleanup/remove-fabricated-data.sql` on a local copy | dry run rolls back unchanged; COMMIT run removes demo identities/companies, test organizations and the practice job with demo-only applications; keeps the registry organization, the employer job, the practice job a real candidate applied to, the builder draft (author detached) and all 15 library templates |

Updated specs: `journeys.spec.ts` (current button text; practical-task redirect; shortlist gate wording), `b2b.spec.ts`
(practice scenarios are no longer listed publicly; labelled “Practice scenario” inside the employer's own workspace),
`security.test.ts` (platform statistics exclude demo records once proposal 0030 is applied).
Fixtures: `tests/fixtures/cv-sample.pdf`, `cv-sample.docx`, `cv-no-text.pdf` (synthetic, no personal data).
Run the core journeys: `RUN_LOCAL_E2E=1 E2E_BASE_URL=http://localhost:3100 npx playwright test tests/e2e/core-journeys.spec.ts --project=desktop`
(refuses to run unless `.env.local` points at a local Supabase).

## 2026-11-11 (redesign, monitoring & evaluation) — executed in a cloud session, local Supabase only
Local stack: repository migrations 0001–0029 + proposal 0031 (local only), demo seed, the backfills above. For realistic
monitoring checks the local `ai_provider_logs` was loaded with a copy of production's 160 AI attempt rows **with user ids
removed** (read-only query on production), and Assessment Builder **metadata** of production's 8 generations was mirrored
as clearly named local fixtures ("Local fixture draft N", 22 "Local fixture reference" rows). No production writes.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint .` | 0 problems |
| `npx next build` | passes (`/admin/monitoring` dynamic) |
| `npx vitest run tests/unit` | **79/79** (adds `monitoring.test.ts` 11: percentiles, summaries, error categories, zero-filled buckets, exact + heuristic fallback correlation, alert thresholds/minimum samples, Riyadh periods, URL building) |
| `npx vitest run tests/integration` | **22 passed, 8 failed** — the 8 need hosted-only data (registry organizations `recruiter.elm` …/ALM-003, saved builder drafts, embeddings); same group as the previous run |
| Playwright full suite (dev server, local DB) | 16 passed, 8 failed, 23 skipped → after updating `public.spec.ts` for the new hero: `public` **6/6**; remaining failures are the 6 `b2b.spec` tests (registry organizations). Skipped = live AI/video/builder/evidence and inbox specs (gated, to avoid AI credits) |
| `RUN_LOCAL_E2E=1` `core-journeys.spec.ts` | **4/4** — CV-first onboarding, apply → task → **file evidence upload → persists after reload → submit**, employer downloads the identical bytes, public board |
| Monitoring figures vs direct SQL (24 h) | attempts 160, failed 89, p50 3,061 ms, p95 15,017 ms, tokens 98,973 / 131,447 (95 rows reporting) — identical; Builder: 8 drafts, 8/8 all checks, 19 references over 7 drafts, 1 approved/published — identical to production |
| Authorization | candidate → `/admin/monitoring`, `/admin/ai`, `/company/analytics` redirected to `/candidate`; employer → admin pages redirected to `/company`; `/company/analytics` shows only that company (14 vs 87 platform applications); `raise_monitoring_alert` / `monitoring_assessment_generations` refuse non–Super Admins |
| Visual | light + dark, AR + EN screenshots of landing, candidate dashboard/skills/career, assessment upload, employer dashboard, CV review, Super Admin overview and every monitoring tab; no horizontal overflow, no console errors |

Offline evaluation: `npm run eval:offline` (no AI calls) → `src/data/evaluation/results.json`.

## 2026-11-11 (final landing film, strict brand palette, navigation restructure) — local Supabase, production build
| Check | Result |
|---|---|
| `npx tsc --noEmit` · `npx eslint .` | clean · 0 problems |
| `npx next build` | passes |
| `npx vitest run tests/unit` | **79/79** (`brand.test.ts` updated: approved navy/blue fallbacks; readable text on Professional Blue is now 4.75:1) |
| Playwright on `next start` (port 3100): `public` | **8/8** desktop + mobile — new film test: exact AR/EN copy, autoplay with a filling progress bar, scene changes without interaction, pause holds, play resumes, CTAs → `/sign-up` and `/employer/request-access`, skip focuses `#after-city`; reduced-motion test: no autoplay, manual "Next" |
| `journeys` · `calendar` · `api-security` | 5/5 · 1/1 · 3/3 (unchanged flows after the navigation restructure) |
| `RUN_LOCAL_E2E=1` `core-journeys` | **4/4** |
| Navigation sweep (script) | every candidate/employer route 200 in AR + EN; tabs + active states correct; no bell; notifications/talent routes redirect |
| Data | candidate skill rows of existing users 217 before/after; notification rows untouched |

Note: in `next dev` the Next.js dev badge overlaps the film's play button at 1280×720 / Pixel 7 — run the film E2E against a
production build (as above). The film test allows extra time because WebGL renders in software in headless Chromium.
