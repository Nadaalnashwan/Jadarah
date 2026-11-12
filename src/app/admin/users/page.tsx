import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDate, pick, tx } from "@/lib/i18n/config";
import { dateRange, pageOf, pageRange, searchTerm, validUuid, type AdminListParams } from "@/lib/admin-filters";
import { AdminFilterBar, AdminPager } from "../list-controls";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { UserControls } from "../admin-client";
import { exhibitionMode } from "@/lib/exhibition";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<AdminListParams> }) {
  const exhibition = exhibitionMode();
  const sp = await searchParams;
  const session = await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const page = pageOf(sp);
  let cq = supabase.from("company_profiles").select("id, name_en, name_ar").order("name_en");
  if (exhibitionMode()) cq = cq.not("registry_id", "is", null);
  const { data: companyRows } = await cq;
  let q = supabase
    .from("profiles")
    .select(
      "id, full_name, email, account_type, status, created_at, is_demo, user_roles!user_roles_user_id_fkey(role), company_memberships!company_memberships_user_id_fkey(role, company:company_profiles(name_en, name_ar))",
      { count: "exact" },
    );
  const term = searchTerm(sp.q);
  if (term) q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  if (sp.status && ["active", "suspended", "deactivated"].includes(sp.status)) q = q.eq("status", sp.status as "active");
  // Role: candidate / super admin come from user_roles; employer roles from active memberships.
  let ids: string[] | null = null;
  const intersect = (next: string[]) => (ids = ids === null ? next : ids.filter((x) => next.includes(x)));
  if (sp.role === "candidate" || sp.role === "super_admin") {
    const { data } = await supabase.from("user_roles").select("user_id").eq("role", sp.role);
    intersect((data ?? []).map((r) => r.user_id));
  } else if (sp.role === "company_admin" || sp.role === "recruiter" || sp.role === "interviewer") {
    const { data } = await supabase.from("company_memberships").select("user_id").eq("role", sp.role);
    intersect((data ?? []).map((r) => r.user_id));
  }
  const company = validUuid(sp.company);
  if (company) {
    const { data } = await supabase.from("company_memberships").select("user_id").eq("company_id", company);
    intersect((data ?? []).map((r) => r.user_id));
  }
  if (ids !== null) q = q.in("id", (ids as string[]).length ? (ids as string[]) : ["00000000-0000-0000-0000-000000000000"]);
  const range = dateRange(sp);
  if (range.gte) q = q.gte("created_at", range.gte);
  if (range.lt) q = q.lt("created_at", range.lt);
  const [from, to] = pageRange(page);
  const { data, count } = await q.order("created_at", { ascending: false }).range(from, to);
  return (
    <>
      <PageHeader title={t.admin.nav.users} description={`${count ?? 0} ${t.common.results}`} />
      <AdminFilterBar
        params={sp}
        locale={locale}
        searchPlaceholder={L("Name or email…", "الاسم أو البريد…")}
        role={{
          label: L("Role", "الدور"),
          options: [
            { value: "candidate", label: t.roles.candidate },
            { value: "company_admin", label: t.roles.company_admin },
            { value: "recruiter", label: t.roles.recruiter },
            { value: "interviewer", label: t.roles.interviewer },
            { value: "super_admin", label: t.roles.super_admin },
          ],
        }}
        status={{
          label: t.common.status,
          options: [
            { value: "active", label: L("Active", "نشط") },
            { value: "suspended", label: L("Suspended", "معلّق") },
            { value: "deactivated", label: L("Deactivated", "معطّل") },
          ],
        }}
        companies={(companyRows ?? []).map((c) => ({ value: c.id, label: pick(c, "name", locale) }))}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="text-subtle text-xs">
              <tr className="border-b">
                <th className="p-4 text-start">{L("User", "المستخدم")}</th>
                <th className="p-4 text-start">{L("Roles", "الأدوار")}</th>
                <th className="p-4 text-start">{t.common.status}</th>
                <th className="p-4 text-start">{L("Joined", "الانضمام")}</th>
                <th className="p-4 text-end">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="p-4">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="hover:text-primary font-semibold"
                    >
                      {u.full_name || "—"}
                    </Link>
                    <p className="text-subtle text-xs" dir="ltr">
                      {u.email}
                    </p>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {u.user_roles.map((r) => (
                        <Badge key={r.role} tone={r.role === "super_admin" ? "accent" : "info"}>
                          {t.roles[r.role]}
                        </Badge>
                      ))}
                      {u.company_memberships.map((m, i) => (
                        <Badge key={i} tone="progress">
                          {t.roles[m.role]} · {locale === "ar" ? m.company?.name_ar : m.company?.name_en}
                        </Badge>
                      ))}
                      {u.is_demo && !exhibition && <Badge tone="muted">demo</Badge>}
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge tone={u.status === "active" ? "positive" : "negative"}>{u.status}</Badge>
                  </td>
                  <td className="text-muted p-4">{formatDate(u.created_at, locale)}</td>
                  <td className="p-4">
                    <div className="flex justify-end">
                      <UserControls
                        userId={u.id}
                        status={u.status}
                        isAdmin={u.user_roles.some((r) => r.role === "super_admin")}
                        self={u.id === session.userId}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <AdminPager params={sp} page={page} count={count ?? 0} locale={locale} />
    </>
  );
}
