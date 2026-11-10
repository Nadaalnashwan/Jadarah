# Deployment (Vercel)

Status: **not deployed**. The app builds (`npm run build`) and is Vercel-compatible.

1. Import the GitHub repo in Vercel; framework preset **Next.js**; Node 24.
2. Environment variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL=https://<your-domain>`
   - `JADARAH_ENV=production` (Preview: `demo`)
   - Optional AI: `AI_PROVIDER`, `GEMINI_API_KEY`/`OPENAI_API_KEY`, model names, `AI_TIMEOUT_MS`
   - Do **not** add `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_USER_PASSWORD` or `SUPABASE_DB_URL` to the web app.
3. Supabase Dashboard → Authentication → URL configuration: set **Site URL** to the production domain and add `https://<domain>/auth/callback` (and preview URLs) to **Redirect URLs**.
4. Supabase → Authentication → SMTP: configure a custom SMTP provider (required for real volumes).
5. For production data, set `platform_settings.environment` to `production` via SQL **before** go-live so demo seed/reset refuse to run:
   ```sql
   update public.platform_settings set value = '"production"' where key = 'environment';
   ```
6. Provision the first Super Admin from a trusted machine: `npm run admin:provision`.
7. Verify: sign-up → confirmation email → sign-in; candidate apply; company approval; admin dashboard.

Never claim a deployment is live until the URL has been opened and these checks pass.
