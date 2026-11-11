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
