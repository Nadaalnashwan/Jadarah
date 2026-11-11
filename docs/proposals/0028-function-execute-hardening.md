# Proposal 0028 — function EXECUTE hardening (NOT APPLIED)

Status: **awaiting owner approval**. Nothing below has been run against production.
Target: Supabase project **maknon Project**, ref `qqvvlornhvfykusaxaid` (ap-southeast-1).
SQL: `supabase/proposals/0028_function_execute_hardening.sql` (one transaction, rollback block included).

## Evidence (read-only inspection, 2026-11-11, project `qqvvlornhvfykusaxaid`)
- Security advisor `0028_anon_security_definer_function_executable` lists 10 functions; 4 of them have no
  reason to be public: `attach_job_task`, `update_company_identity`, `assessment_is_in_use` (SECURITY DEFINER)
  and `match_reference_assessments` (SECURITY INVOKER, found by grant inspection).
- Their ACL is `{=X/postgres, postgres=X, service_role=X, authenticated=X}`. The leading `=X` is EXECUTE for
  **PUBLIC**, which `anon` inherits. So the fix must revoke from PUBLIC, not only from `anon`.
- `rls_auto_enable()` is owned by `postgres`, returns `event_trigger`, and backs the `ensure_rls` event trigger
  (on `ddl_command_end`, it enables RLS on every new `public` table). Its ACL includes `authenticated=X`
  (granted by our 0011 `grant execute on all functions in schema public to authenticated`).
- No RLS policy references any of these functions. `assessment_is_in_use` is called by the triggers
  `lock_assigned_task_content` / `lock_assigned_task_meta` (both SECURITY DEFINER, owner `postgres`) and by one
  page: `src/app/company/assessments/[id]/page.tsx`.

## Changes, impact, rollback

| # | Change | App impact | Risk | Rollback |
|---|---|---|---|---|
| 1 | `attach_job_task`: revoke from PUBLIC/anon; keep `authenticated`, `service_role` | None. Called only from signed-in employer actions (`job-task-actions.ts`, `builder-actions.ts`). It already rejects callers without a recruiter role. | Very low | `grant execute … to public;` |
| 2 | `update_company_identity`: same | None. Called only from `src/features/company/actions.ts` by signed-in company admins; it already re-checks `company_admin`. | Very low | same |
| 3 | `match_reference_assessments`: same | None. Called only by the Assessment Builder (`assessment-builder.ts`) under a signed-in recruiter. Anonymous callers already got no rows (RLS on `reference_embeddings`). | Very low | same |
| 4 | **Existence leak:** `assessment_is_in_use` — revoke from PUBLIC, anon **and authenticated**; add `assessment_in_use_for_manager(uuid)`, which returns the answer only to people who may manage that assessment (`can_manage_assessment`: its company's admins/recruiters, or a Super Admin) and NULL to everyone else | The lock triggers keep working (they run as `postgres`). The assessment page now calls the new function and **falls back to the old one if the new one is missing**, so it works before and after the migration. After the migration, a candidate or another company can no longer probe whether an assessment ID has been assigned. | Low. Worst case the page shows no "locked" banner; the database lock is still enforced by the triggers. | Re-grant `assessment_is_in_use` to `public, authenticated`; keep the new function until the app stops calling it, then drop it |
| 5 | `rls_auto_enable()`: revoke from PUBLIC, anon, authenticated | None. Postgres refuses to call an `event_trigger` function directly, so this is hygiene only. The `ensure_rls` event trigger runs as its owner and keeps enabling RLS on new tables. | Very low. It is a Supabase-created function: if a future platform update re-grants it, that is harmless. | `grant execute on function public.rls_auto_enable() to authenticated;` |

Not changed (intentionally public): `landing_showcase`, `job_task_preview`, `can_view_job`, `is_company_approved`,
`is_super_admin`, `public_contact_email`, `access_request_companies`, `application_transition_allowed`,
`related_skills`. These power anonymous pages (landing, job board, employer access form) and return no private data.

## Verification plan after approval
1. Apply in one transaction (`apply_migration` or `npx tsx scripts/import/apply-migration.ts`).
2. Re-run the security advisor: the 4 functions should leave the anon list.
3. Check anon: `POST /rest/v1/rpc/assessment_is_in_use` → 401/404; `assessment_in_use_for_manager` as a candidate → `null`.
4. As a recruiter, open a published task that candidates hold → "locked" banner still shown; edits still rejected by the DB.
5. `tests/db/run-local.sh` already applies all migrations to a local throwaway database; add the file there first.

## Owner-only: leaked-password protection (Supabase Dashboard)
1. Open https://supabase.com/dashboard/project/qqvvlornhvfykusaxaid
2. Left sidebar → **Authentication** → **Sign In / Providers** (on older layouts: **Providers**).
3. Open **Email** (the only enabled provider).
4. Turn on **Prevent use of leaked passwords** (HaveIBeenPwned check).
5. While there, set **Minimum password length** to at least 10 and **Password requirements** to letters + digits
   (the app's sign-up form already requires 10+ characters).
6. **Save**. Existing passwords keep working; the check applies at sign-up and password change.

Notes: the leaked-password check needs a paid plan (Pro or higher). If the toggle is disabled, the project is on the Free plan.
Verify afterwards: the advisor `auth_leaked_password_protection` warning disappears.
