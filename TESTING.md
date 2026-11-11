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
