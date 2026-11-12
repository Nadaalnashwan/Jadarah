import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody } from "@/components/ui/primitives";
import { acceptInvitationByToken } from "@/features/company/actions";
import { signOutAction } from "@/features/auth/actions";
import { requireSession } from "@/lib/auth/session";
import { pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Landing page of the emailed invitation link. Shows only what the secret token unlocks
 * (organization, role, masked email, state). Acceptance is decided by the database:
 * same confirmed email, pending, not expired, never demotes an existing admin.
 */
export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token && UUID.test(sp.token) ? sp.token : null;
  const session = await requireSession(token ? `/invitations/accept?token=${token}` : "/invitations");
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data } = token ? await supabase.rpc("invitation_preview", { p_token: token }) : { data: null };
  const inv = data?.[0] ?? null;

  let body: React.ReactNode;
  if (!inv) {
    body = (
      <p className="text-muted">
        {L(
          "This invitation link isn't valid. Ask the company admin to send a new invitation",
          "رابط الدعوة غير صالح. اطلب من مدير الشركة إرسال دعوة جديدة",
        )}
      </p>
    );
  } else if (inv.state !== "pending") {
    const msg: Record<string, [string, string]> = {
      accepted: ["This invitation has already been accepted", "قُبلت هذه الدعوة مسبقًا"],
      revoked: ["The company cancelled this invitation", "ألغت الشركة هذه الدعوة"],
      expired: ["This invitation has expired. Ask the company admin to send a new one", "انتهت صلاحية هذه الدعوة. اطلب من مدير الشركة إرسال دعوة جديدة"],
    };
    const m = msg[inv.state] ?? msg.expired;
    body = <p className="text-muted">{locale === "ar" ? m[1] : m[0]}</p>;
  } else if (!inv.for_current_user) {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-muted">
          {L(
            `This invitation was sent to ${inv.email_masked}. You're signed in as ${session.email}`,
            `أُرسلت هذه الدعوة إلى ${inv.email_masked}، وأنت مسجّل الدخول بحساب ${session.email}`,
          )}
        </p>
        <p className="text-muted text-sm">
          {L(
            "Sign out, then sign in (or create an account) with the invited email address",
            "سجّل الخروج، ثم سجّل الدخول (أو أنشئ حسابًا) بالبريد الذي وصلته الدعوة",
          )}
        </p>
        <form action={signOutAction}>
          <Button type="submit" variant="outline">
            {L("Sign out", "تسجيل الخروج")}
          </Button>
        </form>
      </div>
    );
  } else if (!session.emailConfirmed && !(await supabase.auth.getUser()).data.user?.email_confirmed_at) {
    body = (
      <p className="text-muted">
        {L("Confirm your email address first, then open this link again", "أكّد بريدك الإلكتروني أولًا، ثم افتح هذا الرابط مجددًا")}
      </p>
    );
  } else {
    body = (
      <form action={acceptInvitationByToken.bind(null, token!)} className="flex flex-col gap-3">
        <p className="text-muted">
          {L(
            "Accepting gives you access to this organization's JADARAH workspace with the role shown",
            "بقبول الدعوة تحصل على صلاحية الوصول إلى مساحة عمل هذه الجهة على جدارة بالدور الموضح",
          )}
        </p>
        <Button type="submit" size="lg">
          {L("Accept invitation", "قبول الدعوة")}
        </Button>
      </form>
    );
  }

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <Logo />
      <h1 className="editorial text-3xl font-extrabold">{L("Team invitation", "دعوة للانضمام إلى فريق")}</h1>
      {sp.error && (
        <p role="alert" className="text-danger text-sm">
          {L("That invitation could not be accepted", "تعذّر قبول تلك الدعوة")}
        </p>
      )}
      <Card>
        <CardBody className="flex flex-col gap-4">
          {inv && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-bold">{pick({ name_en: inv.company_name_en, name_ar: inv.company_name_ar }, "name", locale)}</p>
              <Badge tone="info">{t.roles[inv.role]}</Badge>
            </div>
          )}
          {body}
        </CardBody>
      </Card>
      <Link href="/invitations" className="text-primary text-sm font-semibold">
        {L("All my invitations", "كل دعواتي")}
      </Link>
    </main>
  );
}
