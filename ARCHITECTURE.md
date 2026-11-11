# Architecture

```
src/
  app/                 Routes (App Router). (marketing) public, (auth) auth flows, candidate/, company/, admin/
  components/          brand/ (logo, signature animation), shell/ (headers, workspace shell/nav), ui/ (primitives), app/ (charts, badges, match explanation)
  features/            Server actions + feature UI: auth, candidate, company, assessments, admin, assistant, notifications, settings, landing
  services/            Server-only services: ai/ (provider, cv, recruiting), candidate, showcase
  lib/                 auth/session, supabase clients, i18n (config, messages, server/client), domain rules, errors, rate limit, motion tokens
  types/database.ts    Generated Supabase types
  proxy.ts             Session refresh + unauthenticated redirect (Next 16 replacement for middleware)
supabase/migrations/   Versioned SQL (schema, RLS, RPCs, storage, grants)
supabase/seed/         Generated demo seed function
scripts/               Admin provisioning, demo data + generator, seed/reset
tests/                 unit/, integration/ (live DB), e2e/ (Playwright)
```

## Layers and trust boundaries
1. **Browser** — publishable key only. Direct uploads go to private buckets whose object policies allow only `{auth.uid()}/…` (candidates) or `{company_id}/…` (company admins).
2. **Next.js server** — Server Components read with the *user's* session (`createClient()` in `lib/supabase/server.ts`), so every query is filtered by RLS. Server Actions validate input with Zod and call business RPCs. Role checks in `lib/auth/session.ts` (`requireCandidate`, `requireCompanyMember`, `requireSuperAdmin`) are presentation/navigation guards.
3. **Postgres** — the enforcement point:
   - RLS on every table; helper functions (`can_view_candidate`, `can_recruit`, `can_view_application`, …) are `SECURITY DEFINER` with `search_path=''`.
   - Recruitment state changes only through RPCs (`apply_to_job`, `change_application_status`, `assign_assessment`, `submit_assessment`, `create_interview`, `review_company`, …) which re-check the caller.
   - Triggers enforce the status machine, shortlist-before-interview, job publication only for approved companies, and protected profile/company columns.
   - Least-privilege `GRANT`s: tables written only by RPCs are `SELECT`-only for API roles.

## Key domain rules (mirrored in TS for UI + unit tests)
- `lib/domain/application-status.ts` ↔ `public.application_transition_allowed()`
- `lib/domain/scoring.ts` ↔ `public.submit_assessment()`
- `lib/domain/matching.ts` — explainable matching (matched / partial / missing / unverified, weighted, experience ≤15%)
- `lib/domain/career.ts` — gap analysis, plan progress, profile completion

## AI
`services/ai/provider.ts` selects Gemini or OpenAI from server env, applies timeout, one retry, per-user rate limit, Zod-validated JSON output and logs every call to `ai_provider_logs`. With no key, callers use labelled rule-based fallbacks (CV taxonomy matching, built-in question bank, guideline assistant) — never simulated AI output. Generated job posts, assessments and interview questions are inserted as drafts/suggestions and require human review.

## i18n & RTL
Locale cookie `jadarah_locale` (default `ar`) sets `<html lang dir>`. Messages in `lib/i18n/messages/{en,ar}.ts` (Arabic typed against English). Long-tail copy uses `tx(locale)`. Numbers/dates use Gregorian calendar and Latin digits in both languages; bilingual DB columns are read with `pick(row, "title", locale)`.

## Motion
Tokens in `lib/motion.ts` and CSS variables. Signature "revealed layers" animation (`components/brand/signature-layers.tsx`) with pointer parallax. All animations honour `prefers-reduced-motion`.
