import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDate, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { UserControls } from "../admin-client";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const session = await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const page = Math.max(1, Number(sp.page ?? 1));
  let q = supabase.from("profiles").select("id, full_name, email, account_type, status, created_at, is_demo, user_roles!user_roles_user_id_fkey(role), company_memberships!company_memberships_user_id_fkey(role, company:company_profiles(name_en, name_ar))", { count: "exact" });
  if (sp.q) q = q.or(`full_name.ilike.%${sp.q.replace(/[%,()]/g, "")}%,email.ilike.%${sp.q.replace(/[%,()]/g, "")}%`);
  if (sp.type) q = q.eq("account_type", sp.type);
  if (sp.status) q = q.eq("status", sp.status as "active");
  const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * 25, page * 25 - 1);
  return (
    <>
      <PageHeader title={t.admin.nav.users} description={`${count ?? 0} ${t.common.results}`} />
      <form className="surface-card mb-4 grid gap-3 p-4 sm:grid-cols-4">
        <Input name="q" defaultValue={sp.q} placeholder={L("Name or email…", "الاسم أو البريد…")} aria-label={t.common.search} />
        <Select name="type" defaultValue={sp.type ?? ""} aria-label={L("Account type", "نوع الحساب")}><option value="">{t.common.all}</option><option value="candidate">{t.roles.candidate}</option><option value="company">{L("Company", "شركة")}</option><option value="admin">{t.roles.super_admin}</option></Select>
        <Select name="status" defaultValue={sp.status ?? ""} aria-label={t.common.status}><option value="">{t.common.all}</option><option value="active">{L("Active", "نشط")}</option><option value="suspended">{L("Suspended", "معلّق")}</option><option value="deactivated">{L("Deactivated", "معطّل")}</option></Select>
        <Button type="submit">{t.common.filter}</Button>
      </form>
      <Card><div className="overflow-x-auto"><table className="w-full min-w-[52rem] text-sm">
        <thead className="text-xs text-subtle"><tr className="border-b"><th className="p-4 text-start">{L("User", "المستخدم")}</th><th className="p-4 text-start">{L("Roles", "الأدوار")}</th><th className="p-4 text-start">{t.common.status}</th><th className="p-4 text-start">{L("Joined", "الانضمام")}</th><th className="p-4 text-end">{t.common.actions}</th></tr></thead>
        <tbody>{(data ?? []).map((u) => (
          <tr key={u.id} className="border-b last:border-0">
            <td className="p-4"><Link href={`/admin/users/${u.id}`} className="font-semibold hover:text-primary dark:hover:text-lavender">{u.full_name || "—"}</Link><p className="text-xs text-subtle" dir="ltr">{u.email}</p></td>
            <td className="p-4"><div className="flex flex-wrap gap-1">{u.user_roles.map((r) => <Badge key={r.role} tone={r.role === "super_admin" ? "accent" : "info"}>{t.roles[r.role]}</Badge>)}{u.company_memberships.map((m, i) => <Badge key={i} tone="progress">{t.roles[m.role]} · {locale === "ar" ? m.company?.name_ar : m.company?.name_en}</Badge>)}{u.is_demo && <Badge tone="muted">demo</Badge>}</div></td>
            <td className="p-4"><Badge tone={u.status === "active" ? "positive" : "negative"}>{u.status}</Badge></td>
            <td className="p-4 text-muted">{formatDate(u.created_at, locale)}</td>
            <td className="p-4"><div className="flex justify-end"><UserControls userId={u.id} status={u.status} isAdmin={u.user_roles.some((r) => r.role === "super_admin")} self={u.id === session.userId} /></div></td>
          </tr>))}</tbody>
      </table></div></Card>
      <div className="mt-4 flex justify-center gap-2">
        {page > 1 && <Button asChild variant="outline" size="sm"><Link href={`?${new URLSearchParams({ ...sp, page: String(page - 1) })}`}>{t.common.previous}</Link></Button>}
        {(count ?? 0) > page * 25 && <Button asChild variant="outline" size="sm"><Link href={`?${new URLSearchParams({ ...sp, page: String(page + 1) })}`}>{t.common.next}</Link></Button>}
      </div>
    </>
  );
}
