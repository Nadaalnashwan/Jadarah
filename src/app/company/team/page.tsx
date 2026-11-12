import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { GroupTabs } from "@/components/shell/group-tabs";
import { requireCompanyMember } from "@/lib/auth/session";
import { formatDate, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { invitationUrl } from "@/services/email/templates";
import { InvitationRow, InviteForm, MemberRow } from "./team-client";

export default async function TeamPage() {
  const s = await requireCompanyMember(["company_admin"]);
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const cid = s.activeMembership.company_id;
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("company_memberships")
      .select(
        "id, user_id, role, status, created_at, profile:profiles!company_memberships_user_id_fkey(full_name, email)",
      )
      .eq("company_id", cid)
      .order("created_at"),
    supabase
      .from("company_invitations")
      .select("id, email, role, status, expires_at, token")
      .eq("company_id", cid)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);
  // Delivery state per invitation (absent before migration 0029 → shown as "link only").
  const { data: delivery } = await supabase.rpc("company_invitation_delivery", { p_company: cid });
  const deliveryBy = new Map((delivery ?? []).map((d) => [d.invitation_id, d]));
  return (
    <>
      <GroupTabs group="company-organization" />
      <PageHeader
        title={t.company.nav.team}
        description={L(
          "Recruiters manage hiring; interviewers only see interviews assigned to them",
          "مسؤولو التوظيف يديرون التوظيف، والمُقابِلون يرون المقابلات المسندة إليهم فقط",
        )}
      />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title={L("Members", "الأعضاء")} />
          <CardBody>
            <ul className="flex flex-col gap-2">
              {(members ?? []).map((m) => (
                <MemberRow
                  key={m.id}
                  id={m.id}
                  name={m.profile?.full_name ?? "—"}
                  email={m.profile?.email ?? ""}
                  role={m.role}
                  active={m.status === "active"}
                  self={m.user_id === s.userId}
                />
              ))}
            </ul>
          </CardBody>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={L("Invite a member", "دعوة عضو")} />
            <CardBody>
              <InviteForm />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={L("Pending invitations", "الدعوات المعلّقة")} />
            <CardBody>
              {(invites ?? []).length ? (
                <ul className="space-y-2 text-sm">
                  {invites!.map((i) => (
                    <InvitationRow
                      key={i.id}
                      id={i.id}
                      email={i.email}
                      roleLabel={t.roles[i.role]}
                      expires={formatDate(i.expires_at, locale)}
                      expired={new Date(i.expires_at) < new Date()}
                      link={invitationUrl(publicEnv.siteUrl, i.token)}
                      delivery={(deliveryBy.get(i.id)?.status as string | undefined) ?? null}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-subtle text-sm">—</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
