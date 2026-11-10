import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireCompanyMember } from "@/lib/auth/session";
import { formatDate, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { InviteForm, MemberRow } from "./team-client";

export default async function TeamPage() {
  const s = await requireCompanyMember(["company_admin"]);
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const cid = s.activeMembership.company_id;
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("company_memberships").select("id, user_id, role, status, created_at, profile:profiles!company_memberships_user_id_fkey(full_name, email)").eq("company_id", cid).order("created_at"),
    supabase.from("company_invitations").select("id, email, role, status, expires_at").eq("company_id", cid).eq("status", "pending"),
  ]);
  return (
    <>
      <PageHeader title={t.company.nav.team} description={L("Recruiters manage hiring; interviewers only see interviews assigned to them.", "مسؤولو التوظيف يديرون التوظيف، والمُقابِلون يرون المقابلات المسندة إليهم فقط.")} />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title={L("Members", "الأعضاء")} />
          <CardBody><ul className="flex flex-col gap-2">{(members ?? []).map((m) => <MemberRow key={m.id} id={m.id} name={m.profile?.full_name ?? "—"} email={m.profile?.email ?? ""} role={m.role} active={m.status === "active"} self={m.user_id === s.userId} />)}</ul></CardBody>
        </Card>
        <div className="flex flex-col gap-6">
          <Card><CardHeader title={L("Invite a member", "دعوة عضو")} /><CardBody><InviteForm /></CardBody></Card>
          <Card>
            <CardHeader title={L("Pending invitations", "الدعوات المعلّقة")} />
            <CardBody>{(invites ?? []).length ? <ul className="space-y-2 text-sm">{invites!.map((i) => <li key={i.id} className="flex justify-between rounded-xl border p-3"><span dir="ltr">{i.email}</span><span className="text-xs text-subtle">{t.roles[i.role]} · {formatDate(i.expires_at, locale)}</span></li>)}</ul> : <p className="text-sm text-subtle">—</p>}</CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
