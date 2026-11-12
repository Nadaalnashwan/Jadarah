import { notFound } from "next/navigation";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDate, formatDateTime, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { MembershipForm, UserControls } from "../../admin-client";

export default async function AdminUserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: u } = await supabase
    .from("profiles")
    .select(
      "*, user_roles!user_roles_user_id_fkey(role), company_memberships!company_memberships_user_id_fkey(role, status, company:company_profiles(id, name_en, name_ar))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!u) notFound();
  const [{ data: companies }, { data: audit }, { count: apps }] = await Promise.all([
    supabase.from("company_profiles").select("id, name_en, name_ar").order("name_en"),
    supabase
      .from("audit_logs")
      .select("action, created_at")
      .or(`actor_id.eq.${id},entity_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("candidate_id", id),
  ]);
  return (
    <>
      <PageHeader
        title={u.full_name || u.email}
        description={u.email}
        actions={
          <UserControls
            userId={u.id}
            status={u.status}
            isAdmin={u.user_roles.some((r) => r.role === "super_admin")}
            self={u.id === session.userId}
          />
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={L("Account", "الحساب")} />
          <CardBody className="space-y-2 text-sm">
            <p>
              {L("Type", "النوع")}: {u.account_type} · {t.common.status}:{" "}
              <Badge tone={u.status === "active" ? "positive" : "negative"}>{u.status}</Badge>
            </p>
            <p>
              {L("Joined", "الانضمام")}: {formatDate(u.created_at, locale)} · {L("Applications", "الطلبات")}:{" "}
              <span className="ltr-nums">{apps ?? 0}</span>
            </p>
            {u.deactivation_requested_at && (
              <p className="text-danger">
                {L("Deactivation requested", "طُلب التعطيل")}:{" "}
                {formatDate(u.deactivation_requested_at, locale)}
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              {u.user_roles.map((r) => (
                <Badge key={r.role} tone="info">
                  {t.roles[r.role]}
                </Badge>
              ))}
              {u.company_memberships.map((m, i) => (
                <Badge key={i} tone="progress">
                  {t.roles[m.role]} · {pick(m.company, "name", locale)} ({m.status})
                </Badge>
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title={L("Company role", "الدور في شركة")}
            description={L("Assign or change company administrators", "تعيين مديري الشركات أو تغييرهم")}
          />
          <CardBody>
            <MembershipForm
              userId={u.id}
              companies={(companies ?? []).map((c) => ({ id: c.id, name: pick(c, "name", locale) }))}
            />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={L("Activity", "النشاط")} />
          <CardBody>
            <ul className="space-y-1 text-sm">
              {(audit ?? []).map((a, i) => (
                <li key={i}>
                  {a.action} ·{" "}
                  <span className="text-subtle text-xs">{formatDateTime(a.created_at, locale)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
