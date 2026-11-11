# Demo accounts

All demo identities are **fictional** and live in the `jadarah-demo.test` domain (reserved; cannot receive email). They are real Supabase Auth users with confirmed emails, linked profiles and roles.

**Password:** shared by all demo identities and supplied at seed time via `DEMO_USER_PASSWORD`. It is **never committed**. Ask the project owner, or reseed with your own value.

| Role | Email pattern | Notes |
|---|---|---|
| Super Admin (demo) | `platform.admin@jadarah-demo.test` | Full platform control |
| Company Admin | `admin.<company>@jadarah-demo.test` | `nawat, ofuq, rakeeza, wasl, madar, nabd, rawafid, souqa, haseen, imtidad` |
| Recruiter | `recruiter.<company>@jadarah-demo.test` | Approved companies only |
| Interviewer | `interviewer.<company>@jadarah-demo.test` | Sees assigned interviews only |
| Candidate | `candidate01` … `candidate32@jadarah-demo.test` | Varied roles and seniority |

**Registry organizations (ALM-001 … ALM-010)** — demonstration identities, not employees of these organizations:

| Role | Email pattern |
|---|---|
| Company Admin | `admin.<org>@jadarah-demo.test` |
| Recruiter | `recruiter.<org>@jadarah-demo.test` |
| Interviewer | `interviewer.<org>@jadarah-demo.test` |

`<org>` = `mc, gea, elm, dgda, stc, sdaia, sipchem, srsa, mof, sidf`. Their subscriptions are demonstrations (no price, no revenue) and their jobs are labelled simulations. The fictional companies above are unlisted and kept for regression.

`imtidad` (امتداد للخدمات اللوجستية) is intentionally **pending approval** so the approval workflow can be demonstrated.

The real initial Super Admin is created separately with `npm run admin:provision` using `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` (never committed).

Reset: `npm run demo:reset -- --yes` (refuses when `JADARAH_ENV=production` or `platform_settings.environment` is not `demo`/`local`).
