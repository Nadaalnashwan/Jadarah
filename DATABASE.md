# Database

Supabase project ref: `qqvvlornhvfykusaxaid`. All schema changes are versioned in `supabase/migrations/`.

| # | Migration | Contents |
|---|---|---|
| 0001 | core_identity | enums, profiles, user_roles, company_profiles/memberships/invitations/verification, auth helpers, new-user trigger, protected columns |
| 0002 | candidates_jobs | skills taxonomy, candidate profile tables, documents, preferences, job categories, jobs, requirements, skills, questions, saved jobs, publication trigger |
| 0003 | recruitment | applications (+documents, answers, history, notes), assessments (templates, sections, rubrics, questions, options, assignments, submissions, answers, evaluations), interviews (+participants, questions, evaluations, feedback) |
| 0004 | career_ai_admin | learning resources, career profiles/goals, gap analyses, development plans/items, learning progress, AI records/logs, notifications, preferences, audit logs, settings, reports, `notify()`/`write_audit()` |
| 0005 | rls | access helpers + RLS policies for every table |
| 0006 | business_rules | status machine, shortlist trigger, apply/withdraw, status change, timeline, company onboarding/review, admin user/role ops, team ops, assessment lifecycle + scoring, interviews, dashboard stats |
| 0007 | storage | 6 private buckets + object policies |
| 0008 | grants_hardening | function EXECUTE hardening |
| 0009 | showcase_demo | anonymised landing showcase, public contact, guarded `demo_reset()`, default settings |
| 0010 | table_grants | least-privilege table grants (project grants nothing by default) |
| 0011 | function_grants | EXECUTE for authenticated; internal helpers revoked (2026-11-11: the demo-seed revokes are now conditional so a fresh project builds from the migrations alone — no effect on an existing database) |
| 0012 | fix_submit_assessment | enum cast fix found by live integration tests |
| 0013 | semantic_embeddings | pgvector: skill/candidate/job embeddings (768d, model-keyed), related_skills, semantic_fit, semantic_job_ranking |
| 0014 | ai_record_kinds | new AI analysis/generation record kinds |
| 0015 | fix_assessment_insert_returning | companies can create/clone assessments (row-based SELECT policy) |
| 0016 | internal_calendar | ends_at, attendance confirmation, participant booking windows + exclusion constraint, availability, free/busy, reminders (pg_cron) |
| 0017 | fix_interview_double_booking | conflicts raise instead of being swallowed |
| 0018 | video_interviews | Daily room columns, access RPC, attach/detach, attendance |
| 0019 | final_evaluation | interview rubric, final evaluations (draft/finalized), comments, decision + feedback RPCs |
| 0020 | b2b_subscriptions_access | organization registry fields, brand profiles, aliases, subscriptions, payments, access requests; `company_service_active()` inside `has_company_role`; credits trigger; `admin_provision_company`, `request_company_access`, `review_access_request`; public `create_company` revoked; daily expiry cron |
| 0021 | fix_job_insert_returning | companies can create jobs (row-based SELECT policy) |
| 0022 | catalogue_listing_types | `jobs.listing_type` verified/simulation (+ source URL and check date; verified requires a source), sector skill and job categories |
| 0023 | assessment_reference_library | sector skills, reference assessments (recruiter-readable), reference assessor content (Super Admin only), reference embeddings, generations, assessor guides, assessment materials; private buckets `assessment-materials` and `reference-library` |
| 0024 | assessment_materials_delete | owning company may remove its material files (regenerating draft data) |
| 0025 | product_experience | job ↔ practical task lifecycle: `apply_to_job` auto-assigns the job's published task (status `assessment_pending`, `applications.requires_task/task_assignment_id/completed_at`), application complete only when the task is submitted (trigger); `attach_job_task` (same org, task published before job, never replaced once candidates have it — `jobs_enforce_task`); `job_task_preview` (candidate-safe, anon); `start_assessment` blocks closed applications and resumes attempts; task content locked once assigned (`lock_assigned_task_*` triggers); `assessments.job_id/creation_key` (idempotent creation); employer-managed `company_identity` + `update_company_identity` (company admins) + public bucket `company-identity`; `exploration_tasks` / `exploration_attempts` (candidate-private) |
| 0026 | exploration_tasks | 12 exploratory tasks (one per job category), generated from `scripts/exploration/tasks.ts` |
| 0027 | public_exploration_preview | anonymous read of active exploratory task titles (learning content; attempts stay private) |
| 0029 | `20261111000029_platform_completion.sql` — **applied to production 2026-11-12** with owner approval (ledger version `20261112061024`, name `platform_completion`) | private server key, shared rate limits/AI cooldowns, **assessment answer files** (`file_upload` questions: table, RPCs, storage policies), interview attachments, email outbox, Daily webhook ledger, health ping. Candidate evidence uploads require it. Verified locally (integration + E2E upload → persist → submit → employer download, isolation). |
| 0032 | `20261112000032_task_solution_files.sql` — **applied to production 2026-11-12** with owner approval (ledger version `20261112061323`, name `task_solution_files`) | **Task Solution Files** (ملفات حل المهمة): `assessment_answer_files.kind` (`answer`/`solution`, solution rows have no question), `register_task_solution_file()` (in-progress + time checks, storage metadata wins, ≤ 10 files, 20 MB), `.doc` accepted, storage write rule for `<uid>/<submission>/solution/<file>`. Verified on production with the owner's PDF: UI upload → storage + metadata → refresh → submit → same-company employer download (bytes identical); other company, other candidate and anonymous denied; `.exe` and 21 MB refused by UI and by storage. |
| 0033 | `20261112000033_question_level_evaluation.sql` — **applied to production 2026-11-12** with owner approval (ledger `20261112072336 question_level_evaluation`) | **Question-level evaluation** (see `docs/EVALUATION.md`): files for every open question; question-scoped rubrics split from the builder's task mapping (tasks already given to candidates are not changed — mapped read-only by the app); `assessment_ai_evaluations` (append-only, recruiter-only); `assessment_evaluations.source/ai_evaluation_id/candidate_feedback/updated_at`; `assessment_evaluation_history`; `review_assessment_question`, per-question score recomputation (no double counting); per-question feedback and files in `get_assessment_result`. Verified locally (SQL tests) and on production (live E2E, 29 checks). |
| 0031 (proposal) | `supabase/proposals/0031_monitoring.sql` — **PROPOSED, NOT APPLIED to production** (applied to the local Supabase only) | additive + reversible (rollback at the top of the file): `ai_provider_logs.request_id/attempt/is_fallback` (exact fallback correlation), monitoring indexes, `raise_monitoring_alert()` (Super Admin only; in-app notification with 6 h cooldown; `private.monitoring_alerts` dedupe table), `monitoring_assessment_generations()` (Super Admin only; Assessment Builder **metadata** — status, model, check pass/fail, reference count — never draft content or assessor guidance). Without it the app still works: AI logging drops the extra columns, fallback correlation is labelled approximate, alerts are shown on the page only, and Assessment Monitoring shows a notice that draft records are recruiter-only under current RLS. |
| 0030 (proposal) | `supabase/proposals/0030_workflow_cv_listings.sql` — **PROPOSED, NOT APPLIED** (needs owner approval; kept outside `migrations/` so `supabase db push` cannot apply it by accident. To apply after approval and a backup: copy it to `supabase/migrations/20261111000030_workflow_cv_listings.sql`, then `npx tsx scripts/import/apply-migration.ts supabase/migrations/20261111000030_workflow_cv_listings.sql` (one transaction, recorded in the ledger) or `supabase db push`) | candidate profile row created at sign-up (+ backfill); `change_application_status` allows only reject/hire while the job's task is outstanding; `jobs.listing_type` gains `employer` (new default; employer-authored rows backfilled), `simulation` kept for imported practice scenarios; `admin_platform_stats` excludes demo/practice records; demo `landing_showcase()` no longer executable by API roles. The application enforces the same rules without it. Verified on a local Supabase (integration + E2E). |

Applying: 0025–0027 were applied to project `qqvvlornhvfykusaxaid` through the Supabase MCP connection on 2026-11-11 (plus a follow-up `product_experience_embed_fix` that drops two FKs so PostgREST embeds stay unambiguous — the repo's 0025 file already reflects the final state). 0001–0019 were applied through the Supabase MCP connection; 0020–0023 with `npx tsx scripts/import/apply-migration.ts <file>` (one transaction, recorded in `supabase_migrations.schema_migrations`). 0029 and 0032 were applied through the Supabase MCP connection on 2026-11-12, so the ledger records them under the MCP's own timestamps (`20261112061024`, `20261112061323`), not the file versions: **do not re-apply them** with `apply-migration.ts` (it checks the file version and would run them again) — `/api/health` reports `database_schema: "0029"` and `task_solution_files: "ready"` when both are present. For a fresh project use the Supabase CLI (`supabase db push`) or run the files in order.

## Recruitment workflow and status machine
Workflow: `apply_to_job` creates the application and, when the job carries a published practical task, assigns it in the same transaction (`submitted → assessment_pending`, `requires_task`, `task_assignment_id`) — no employer approval before the assessment. `submit_assessment` completes the application (`assessment_completed`, `completed_at`) and notifies the employer, who then evaluates the CV + evidence (`under_review`) → `shortlisted` → interview → decision. Jobs without a task are complete at submission (`submitted → under_review`).

Allowed transitions (`application_transition_allowed`) are unchanged; `rejected`/`hired`/`withdrawn` are reachable from any open state. `assessment_completed`, `interview_scheduled`, `interview_completed` and `withdrawn` are set only by their workflows. While a job's task is outstanding the employer may only reject or hire (application layer today; DB as well once proposal 0030 is applied).

## Mandatory rules (DB-enforced)
- Interview creation requires `was_shortlisted` and a shortlisted/interview stage (`create_interview` + `interviews_enforce_shortlist`).
- Hiring is allowed from any open stage without shortlisting.
- Job publication requires an approved company (`enforce_job_publication`).
- Employer access needs an active user, an approved membership with an authorised role, an approved organization and an eligible subscription (`active`, not past `ends_on`) — enforced by `has_company_role` in every employer policy and RPC, and by `requireCompanyMember` (redirects to `/workspace-paused`). There is no organization-count limit.
- Organizations are provisioned by a Super Admin only (`admin_provision_company`); employees request access (`request_company_access`, email confirmed) and a Super Admin approves or rejects (`review_access_request`, role adjustable). One pending request per user and organization.
- Demonstration subscriptions carry `payment_status = 'demo'` and no price; payments cannot be recorded against them. Revenue reports separate recorded payments, contract value and demonstrations.
- Simulation jobs are labelled in every listing; verified jobs need a source URL.
- Assessment reference assessor content is readable by Super Admin only; recruiters receive rubric structure through `reference_rubrics_for_builder`. Candidate materials are readable only by candidates assigned the assessment; assessor materials and guides never.
- Users cannot change their own `status`, `account_type`, `email`, `is_demo`; companies cannot change their own approval fields.

## Removing fabricated data
`scripts/cleanup/remove-fabricated-data.sql` (manual, owner-approved): removes demo identities and fictional companies (with what cascades from them), "Integration Test Org …" leftovers and imported practice listings that no real candidate applied to. Keeps real users, registry organizations, employer-posted jobs, every assessment/template (saved builder drafts included), the reference library, skills, resources and settings. Runs in one transaction, prints what it would remove and **rolls back** unless the last line is changed to `COMMIT`. Verified end to end on a local copy (dry run + commit). Not run against the hosted project.

Until it is run, the application hides that data from real users: public/candidate listings exclude practice scenarios (`LISTED_JOB_FILTER`), the talent pool and application lists exclude demo identities for non-demo viewers, and the landing page no longer reads `landing_showcase()`.

## Demo seed
`scripts/demo/*.ts` (typed, fictional data) → `npm run seed:generate` → `supabase/seed/demo_seed.sql` defining `public.seed_demo(p_password)`. Idempotent (deterministic UUIDs, `on conflict do nothing`), refuses when `platform_settings.environment = 'production'`. Current counts: 61 Auth identities, 10 companies (9 approved, 1 pending), 30 jobs, 32 candidates, 15 assessments (75 questions), 51 learning resources, 10 plan templates, 12 personal plans, 82 applications, 28 interviews, 51 assessment submissions.


## Known timezone risk (not changed — needs a reviewed migration)

`company_service_active()` compares `starts_on` / `expires_on` with UTC `current_date`. Between 00:00 and 03:00 Riyadh
time on a subscription's first day (or the day after expiry) the organization is evaluated against the previous UTC
date, so its workspace can appear paused for up to three hours. Suggested fix (proposal, not applied): compare with
`(now() at time zone 'Asia/Riyadh')::date`. Documented only; no database change was made.
