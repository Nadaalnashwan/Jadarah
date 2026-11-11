# Security

## Controls
- **Authentication:** Supabase Auth with email confirmation, PKCE callback (`/auth/callback`), password reset, server-side session refresh in `proxy.ts`. Users with `status != active` are redirected to `/account-suspended`.
- **Authorization:** enforced in Postgres (RLS + SECURITY DEFINER RPCs re-checking roles). UI role checks are presentation only.
- **Least privilege:** explicit table/function grants; internal helpers (`notify`, `write_audit`, `_transition_application`, `seed_demo`, trigger functions) are not callable via the API.
- **No self-elevation:** the new-user trigger only assigns `candidate`; `user_roles` has no write policy; protected-column triggers on profiles/companies.
- **Private storage:** all buckets private; signed URLs valid 60 s; uploads limited by MIME type and size; object paths namespaced by user/company; no UPDATE policy (no silent overwrite).
- **Confidential data:** internal notes and status reasons are company-only; candidates read a filtered timeline RPC; interview evaluations are visible to the evaluator and company recruiters only; candidate feedback is shown only when explicitly shared; answer keys are never returned before submission.
- **Input/output validation:** Zod on every Server Action; AI output validated against schemas; RPC errors mapped to safe localized messages (`lib/errors.ts`).
- **Rate limiting:** per-IP limits on auth actions and per-user limits on AI calls (in-memory; use a shared store in multi-instance production). Supabase Auth applies project rate limits.
- **Headers:** `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `poweredByHeader` off.
- **CSRF:** Server Actions are POST-only with Next.js origin checks; auth cookies are `SameSite=Lax`.
- **XSS:** React escaping; no `dangerouslySetInnerHTML`.
- **Secrets:** only the publishable key reaches the browser; service-role key used only by `scripts/provision-admin.ts`. CI scans the client bundle and repo for secrets.
- **Audit:** status changes, company reviews, role/membership changes, assessment assignment and interview actions write to `audit_logs`.
- **Privacy:** candidate visibility setting, deactivation/deletion request, consent timestamp recorded at sign-up.

## Verified (live, see TESTING.md)
Candidate A cannot read B's records; companies are isolated; interviewers see only assigned interviews and no internal notes; candidates cannot read notes, history reasons, evaluations or answer keys; self-promotion is rejected; admin RPCs reject non-admins; anonymous users see only public catalogue data; internal helpers are not callable.

## Known gaps / production to-dos
- Configure custom SMTP (default Supabase SMTP is rate-limited and restricted).
- Enable MFA for Super Admin accounts in Supabase Auth.
- Replace in-memory rate limiting with a shared store before horizontal scaling.
- Add a Content-Security-Policy once third-party origins are finalised.
- The `http` Postgres extension was enabled to load the demo seed from a pinned commit; drop it (`drop extension http;`) if not needed.

## 2026-11-11 additions
- **AI:** keys server-only; task routing with visible fallback (badge + `ai_provider_logs`), no prompts logged; candidate answers/CVs treated as untrusted data (prompt-injection guard); the final-evaluation AI receives a de-identified evidence pack; AI never changes statuses.
- **Semantic data:** embeddings tables under RLS (candidates write only their own; companies only their jobs); similarity RPCs are security-invoker.
- **Calendar:** interviewer double-booking prevented by a Postgres exclusion constraint; free/busy exposes times only to recruiters; attendance confirmation candidate-only.
- **Video:** Daily rooms private; `interview_video_access()` admits only the candidate and assigned interviewers; short-lived room-scoped tokens minted server-side; camera/mic allowed by Permissions-Policy only on `/meet/*`; no recording.
- **Final evaluation:** company-internal (RLS); workflow columns writable only via RPCs; finalized reports locked; candidates see only explicitly shared feedback via a candidate-scoped RPC.
- Found/fixed: `'use server'` non-function export broke CV upload (now guarded by a unit test); companies could not create assessments (RLS on INSERT…RETURNING, 0015); `ON CONFLICT DO NOTHING` swallowed double-booking (0017).
- Owner to-dos: enable leaked-password protection; custom SMTP; MFA for Super Admins.

## B2B access and assessment confidentiality (0020–0023)
- **Employer access:** no public organization creation; sign-up is candidate-only; employer access is a request reviewed by a Super Admin. Every employer policy and RPC checks the subscription through `has_company_role`; a paused workspace exposes nothing.
- **Branding:** a logo is shown only when the identity is verified **and** usage is granted; otherwise a neutral tile. No organization is presented as a partner.
- **Reference library:** assessor content (answer expectations, guidance) is stored in a Super Admin-only table; recruiters retrieve rubric structure only; candidates cannot read references at all. Originals are kept in a private bucket.
- **Generated assessments:** never auto-published; approval re-runs validation (including assessor-leakage and legacy-branding checks). Assessor guides and assessor files are company-internal; candidates get candidate files through 60 s signed URLs only when assigned. File names containing legacy branding are rejected by the database.
- Verified live by `tests/integration/assessment-security.test.ts` and `tests/integration/b2b.test.ts`.

## Product experience (0025–0027)
- **Practical tasks:** assigned by `apply_to_job` in the same transaction (no employer gate); candidates receive the attempt without answer keys/explanations; assessor guides and reference content remain company/Super-Admin only. Once any candidate holds a task, its questions/options/sections/rubric/metadata are locked by triggers (same version for everyone) and the job's task cannot be swapped.
- **Idempotency:** task creation carries a client `creation_key` (unique per company); `apply_to_job` rejects duplicates and the action resumes the existing task.
- **Company identity:** writes only through `update_company_identity` (company admin of that company, active subscription); hex colours validated in DB and server; storage paths must start with the company id; company colours are applied only inside a company-scoped wrapper with an automatically readable foreground — never to JADARAH navigation or security indicators.
- **Directory contacts:** website/email/phone actions are shown only when the organization is `verified_official` or its own admin published them; listing ≠ partnership.
- **Exploratory tasks:** attempts are owner-only (RLS) and never visible to employers; feedback is learning-only, never a hiring score; AI receives only the task and the response (untrusted-input guard), with a transparent rule-based fallback.
