# Navigation consolidation (candidate & employer)

Grouping is done with **tabs on the existing pages** (`src/lib/nav-groups.ts`, `src/components/shell/section-tabs.tsx`):
every route still exists, deep links keep working, and permissions/data access are exactly as before. The sidebar item
of a group stays active on all of its tabs. No database table, record or field was removed.

## Candidate

| User type | Original tab | Action | New location | Reason |
|---|---|---|---|---|
| Candidate | نظرة عامة / Overview | Retained (1st) | `/candidate` | Starting point; its "Next actions" card now also covers what notifications used to flag |
| Candidate | اكتشف الوظائف / Discover Jobs | Retained, moved to 2nd | `/candidate/jobs` | Main journey |
| Candidate | الشركات / Companies | Retained, moved to 3rd | `/candidate/companies` | Main journey |
| Candidate | طلباتي / My Applications | Merged → **طلباتي ومقابلاتي** | `/candidate/applications` (tab "الطلبات") | Interviews belong to applications |
| Candidate | مقابلاتي / My Interviews | Merged into **طلباتي ومقابلاتي** | `/candidate/interviews` (tab "المقابلات") | Same journey; confirm/join still on the same page |
| Candidate | التقييمات / Assessments | Retained | `/candidate/assessments` | Distinct task workflow (attempts, uploads, results) |
| Candidate | التطوير المهني / Career Development | Merged → **مساري المهني** | `/candidate/career` (tab "خطتي") | Plan and exploration are one topic |
| Candidate | اكتشف مسارك / Discover careers | Merged into **مساري المهني** | `/candidate/discover` (tab "استكشف المسارات") | Same topic; exploratory tasks unchanged |
| Candidate | المساعد الذكي / AI Assistant | Retained | `/candidate/assistant` | General-purpose (jobs, CV, career), not only career |
| Candidate | ملفي / My Profile | Merged → **ملفي وسيرتي** | `/candidate/profile` (tab "الملف الشخصي") | One place for who you are |
| Candidate | سيري الذاتية / My CVs | Merged into **ملفي وسيرتي** | `/candidate/cvs` (tab "السير الذاتية") | Uploads, versions and review unchanged |
| Candidate | مهاراتي / My Skills | **Removed as a standalone tab**; moved into **ملفي وسيرتي** | `/candidate/skills` (tab "المهارات") | Requested; skill records, editing, matching, assessment evidence and career analysis untouched |
| Candidate | الإشعارات / Notifications (tab + bell) | **Removed from the interface** | `/candidate/notifications` → redirects to overview | Requested; notification records/tables and the workflows that create them are kept |
| Candidate | الإعدادات / Settings | Retained (last) | `/candidate/settings` | Account settings |

**Final candidate navigation (display order):** نظرة عامة · اكتشف الوظائف · الشركات · طلباتي ومقابلاتي · التقييمات ·
مساري المهني · المساعد الذكي · ملفي وسيرتي · الإعدادات (English: Overview · Discover Jobs · Companies · Applications &
interviews · Assessments · Career path · AI Assistant · Profile & CV · Settings). 14 items → 9.

## Company / employer

| User type | Original tab | Action | New location | Reason |
|---|---|---|---|---|
| Company | نظرة عامة / Overview | Retained (1st) | `/company` | Starting point with live counts |
| Company | الوظائف / Jobs | Retained | `/company/jobs` | Job creation, editing, publishing |
| Company | الطلبات / Applications | Retained | `/company/applications` | Applicant list; CV + assessment review and decisions are inside each application |
| Company | التقييمات / Assessments | Retained | `/company/assessments` | Assessment Builder, drafts and evaluation queue are a separate workflow |
| Company | المقابلات / Interviews | Merged → **المقابلات والتقويم** | `/company/interviews` (tab "المقابلات") | One scheduling area |
| Company | التقويم / Calendar | Merged into **المقابلات والتقويم** | `/company/calendar` (tab "التقويم") | Same interviews, calendar view; duplicate "My availability" button removed |
| Company | أوقات توفّري / My availability | Merged into **المقابلات والتقويم** | `/company/availability` (tab "أوقات توفّري") | Needed for scheduling; interviewers keep access |
| Company | التحليلات / Analytics | Retained | `/company/analytics` | Company-scoped recruitment monitoring |
| Company | المساعد الذكي / AI Assistant | Retained | `/company/assistant` | Recruiting assistant |
| Company | ملف الشركة / Company Profile | Merged → **الشركة والفريق** (admins) | `/company/profile` (tab "ملف الشركة") | Organization settings in one place |
| Company | الفريق / Team | Merged into **الشركة والفريق** (admins) | `/company/team` (tab "الفريق") | Same audience (company admins) |
| Company | الإشعارات / Notifications (tab + bell) | **Removed from the interface** | `/company/notifications` → redirects to overview | Requested; data and backend kept |
| Company | مجمّع المواهب / Talent Pool | Removed earlier (kept removed) | `/company/talent` → applications | Candidates are reached through jobs and applications; no data removed |
| Company | الإعدادات / Settings | Retained (last) | `/company/settings` | Personal account settings |

**Final employer navigation (display order):** نظرة عامة · الوظائف · الطلبات · التقييمات · المقابلات والتقويم ·
التحليلات · المساعد الذكي · الشركة والفريق · الإعدادات. Role filtering is unchanged: interviewers see Overview ·
Interviews & calendar · Settings; recruiters see everything except Company & team.

## Preserved functionality (verified in the running app)

Every route above returns 200 for its role in Arabic and English; grouped pages show their tabs with the correct active
tab and active sidebar item; `/candidate/notifications`, `/company/notifications` and `/company/talent` redirect; no
notification bell in candidate or employer headers (the Super Admin keeps theirs). E2E journeys (candidate apply → task →
file evidence → submit; employer review/shortlist; calendar scheduling → candidate confirms; interviewer sees only
assigned interviews; role isolation) pass on the production build. Candidate skill rows: 217 for existing users before and
after (the only additions are rows created by E2E test sign-ups).
