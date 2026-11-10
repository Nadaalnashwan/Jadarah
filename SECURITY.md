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
