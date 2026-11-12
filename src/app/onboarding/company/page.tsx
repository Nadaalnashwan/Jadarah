import { redirect } from "next/navigation";
import { Clock, XCircle } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/shell/preference-toggles";
import { AccessRequestForm } from "@/features/auth/employer-access-form";
import { requireSession } from "@/lib/auth/session";
import { formatDate, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Employer accounts without an approved membership. Organizations are provisioned by JADARAH;
 * employees request access and wait for Super Admin approval (no self-service company creation).
 */
export default async function EmployerAccessStatus() {
  const session = await requireSession("/onboarding/company");
  if (session.activeMembership) redirect(session.serviceActive ? "/company" : "/workspace-paused");
  if (session.profile.account_type !== "company") redirect("/");
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();

  let { data: requests } = await supabase
    .from("company_access_requests")
    .select("id, status, job_title, requested_role, decision_note, created_at, company:company_profiles(name_en, name_ar)")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });

  // First visit after email verification: file the request captured at registration.
  if (!requests?.length) {
    const { data: auth } = await supabase.auth.getUser();
    const hint = auth.user?.user_metadata?.access_request as { company_id?: string; job_title?: string; role?: string } | undefined;
    if (hint?.company_id && hint.job_title && ["recruiter", "interviewer", "company_admin"].includes(hint.role ?? "")) {
      await supabase.rpc("request_company_access", {
        p_company: hint.company_id,
        p_job_title: hint.job_title,
        p_role: hint.role as "recruiter",
      });
      ({ data: requests } = await supabase
        .from("company_access_requests")
        .select("id, status, job_title, requested_role, decision_note, created_at, company:company_profiles(name_en, name_ar)")
        .eq("user_id", session.userId)
        .order("created_at", { ascending: false }));
    }
  }
  const latest = requests?.[0];
  const pending = latest?.status === "pending";
  const { data: companies } = pending ? { data: [] } : await supabase.rpc("access_request_companies");
  const orgName = (c: { name_en: string; name_ar: string } | null | undefined) => (c ? (locale === "ar" ? c.name_ar : c.name_en) : "—");

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-xl items-center justify-between px-4 py-6">
        <Logo />
        <LanguageSwitcher />
      </header>
      <main id="main" className="mx-auto flex max-w-xl flex-col gap-6 px-4 pb-20">
        {pending && latest && (
          <div className="surface-card flex flex-col items-center gap-3 p-8 text-center">
            <span className="ink text-primary-ink flex size-14 items-center justify-center rounded-2xl">
              <Clock className="size-7" />
            </span>
            <h1 className="text-2xl font-extrabold">{L("Pending approval", "بانتظار الموافقة")}</h1>
            <p className="text-muted">
              {orgName(latest.company)} · {latest.job_title} · {t.roles[latest.requested_role]}
            </p>
            <p className="text-subtle ltr-nums text-xs">{formatDate(latest.created_at, locale)}</p>
          </div>
        )}
        {!pending && (
          <>
            {latest?.status === "rejected" && (
              <div className="bg-danger/10 text-danger flex items-start gap-3 rounded-2xl p-4 text-sm">
                <XCircle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {L("Request not approved", "لم تتم الموافقة على الطلب")} · {orgName(latest.company)}
                  </p>
                  {latest.decision_note && <p className="mt-1">{latest.decision_note}</p>}
                </div>
              </div>
            )}
            <div className="surface-card p-6 sm:p-8">
              <h1 className="mb-5 text-2xl font-extrabold">{L("Request access", "طلب الانضمام")}</h1>
              <AccessRequestForm companies={companies ?? []} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
