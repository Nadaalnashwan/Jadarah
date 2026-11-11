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
| 0011 | function_grants | EXECUTE for authenticated; internal helpers revoked |
| 0012 | fix_submit_assessment | enum cast fix found by live integration tests |
| 0013 | semantic_embeddings | pgvector: skill/candidate/job embeddings (768d, model-keyed), related_skills, semantic_fit, semantic_job_ranking |
| 0014 | ai_record_kinds | new AI analysis/generation record kinds |
| 0015 | fix_assessment_insert_returning | companies can create/clone assessments (row-based SELECT policy) |
| 0016 | internal_calendar | ends_at, attendance confirmation, participant booking windows + exclusion constraint, availability, free/busy, reminders (pg_cron) |
| 0017 | fix_interview_double_booking | conflicts raise instead of being swallowed |
| 0018 | video_interviews | Daily room columns, access RPC, attach/detach, attendance |
| 0019 | final_evaluation | interview rubric, final evaluations (draft/finalized), comments, decision + feedback RPCs |

Applying: migrations were applied through the Supabase MCP connection. For a fresh project use the Supabase CLI (`supabase db push`) or run the files in order.

## Status machine
`submitted → under_review → assessment_pending → assessment_completed → shortlisted → interview_scheduled → interview_completed → hired`, with `rejected`/`hired`/`withdrawn` reachable from any open state (see `application_transition_allowed`). `assessment_completed`, `interview_scheduled`, `interview_completed` and `withdrawn` are set only by their workflows.

## Mandatory rules (DB-enforced)
- Interview creation requires `was_shortlisted` and a shortlisted/interview stage (`create_interview` + `interviews_enforce_shortlist`).
- Hiring is allowed from any open stage without shortlisting.
- Job publication requires an approved company (`enforce_job_publication`).
- Users cannot change their own `status`, `account_type`, `email`, `is_demo`; companies cannot change their own approval fields.

## Demo seed
`scripts/demo/*.ts` (typed, fictional data) → `npm run seed:generate` → `supabase/seed/demo_seed.sql` defining `public.seed_demo(p_password)`. Idempotent (deterministic UUIDs, `on conflict do nothing`), refuses when `platform_settings.environment = 'production'`. Current counts: 61 Auth identities, 10 companies (9 approved, 1 pending), 30 jobs, 32 candidates, 15 assessments (75 questions), 51 learning resources, 10 plan templates, 12 personal plans, 82 applications, 28 interviews, 51 assessment submissions.
