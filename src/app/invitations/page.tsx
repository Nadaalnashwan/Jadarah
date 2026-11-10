import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardBody, EmptyState } from "@/components/ui/primitives";
import { acceptInvitation } from "@/features/company/actions";
import { requireSession } from "@/lib/auth/session";
import { pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function InvitationsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const session = await requireSession("/invitations");
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data } = await supabase.from("company_invitations").select("id, role, expires_at, company:company_profiles(name_en, name_ar)").eq("status", "pending").ilike("email", session.email);
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-4">
      <Logo />
      <h1 className="editorial text-3xl font-extrabold">{L("Team invitations", "دعوات الفرق")}</h1>
      {sp.error && <p className="text-sm text-danger">{L("That invitation could not be accepted.", "تعذّر قبول تلك الدعوة.")}</p>}
      {(data ?? []).length === 0 ? <Card><EmptyState title={L("No pending invitations for this account", "لا توجد دعوات معلّقة لهذا الحساب")} /></Card> : (
        <ul className="flex flex-col gap-3">{data!.map((i) => (
          <Card key={i.id}><CardBody className="flex items-center justify-between gap-3"><div><p className="font-bold">{pick(i.company, "name", locale)}</p><p className="text-sm text-muted">{t.roles[i.role]}</p></div><form action={acceptInvitation.bind(null, i.id)}><Button type="submit">{L("Accept", "قبول")}</Button></form></CardBody></Card>
        ))}</ul>
      )}
    </main>
  );
}
