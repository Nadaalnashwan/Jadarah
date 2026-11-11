"use client";
import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/form";
import { Avatar, Badge } from "@/components/ui/primitives";
import { inviteMember, resendInvitation, revokeInvitation, updateMember } from "@/features/company/actions";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

type Role = "company_admin" | "recruiter" | "interviewer";

export function InviteForm() {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(inviteMember, null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label={t.auth.email} htmlFor="inv-email" required>
        <Input id="inv-email" name="email" type="email" required dir="ltr" />
      </Field>
      <Field label={L("Role", "الدور")} htmlFor="inv-role">
        <Select id="inv-role" name="role" defaultValue="recruiter">
          {(["recruiter", "interviewer", "company_admin"] as Role[]).map((r) => (
            <option key={r} value={r}>
              {t.roles[r]}
            </option>
          ))}
        </Select>
      </Field>
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" loading={pending}>
        {L("Create invitation", "إنشاء دعوة")}
      </Button>
      <p className="text-subtle text-xs">
        {L(
          "We email a personal link. Only someone signed in with this exact email can accept it, and it expires after 14 days.",
          "نرسل رابطًا شخصيًا بالبريد. لا يقبله إلا من سجّل الدخول بهذا البريد نفسه، وتنتهي صلاحيته بعد 14 يومًا.",
        )}
      </p>
    </form>
  );
}

const DELIVERY: Record<string, [string, string, "positive" | "progress" | "negative" | "muted"]> = {
  sent: ["Email sent", "أُرسل البريد", "positive"],
  queued: ["Sending…", "قيد الإرسال…", "progress"],
  sending: ["Sending…", "قيد الإرسال…", "progress"],
  failed: ["Email failed", "تعذّر الإرسال", "negative"],
  suppressed: ["Test address · not emailed", "عنوان تجريبي · لم يُرسل", "muted"],
  cancelled: ["Cancelled", "أُلغي", "muted"],
};

export function InvitationRow({
  id,
  email,
  roleLabel,
  expires,
  expired,
  link,
  delivery,
}: {
  id: string;
  email: string;
  roleLabel: string;
  expires: string;
  expired: boolean;
  link: string;
  delivery: string | null;
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const d = delivery ? DELIVERY[delivery] : null;
  const run = (fn: () => Promise<ActionResult>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(ok);
      router.refresh();
    });
  return (
    <li className="flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span dir="ltr" className="font-medium break-all">
          {email}
        </span>
        <span className="text-subtle text-xs">
          {roleLabel} · {expired ? L("Expired", "منتهية") : `${L("Expires", "تنتهي")} ${expires}`}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {d ? <Badge tone={d[2]}>{locale === "ar" ? d[1] : d[0]}</Badge> : <Badge tone="muted">{L("Link only", "رابط فقط")}</Badge>}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              toast.success(L("Invitation link copied", "نُسخ رابط الدعوة"));
            } catch {
              toast.error(link);
            }
          }}
        >
          {L("Copy link", "نسخ الرابط")}
        </Button>
        {!expired && (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => resendInvitation(id), L("Sent again", "أُعيد الإرسال"))}>
            {L("Resend", "إعادة الإرسال")}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-danger"
          disabled={pending}
          onClick={() => confirm(L("Cancel this invitation?", "إلغاء هذه الدعوة؟")) && run(() => revokeInvitation(id), L("Invitation cancelled", "أُلغيت الدعوة"))}
        >
          {L("Cancel", "إلغاء")}
        </Button>
      </div>
    </li>
  );
}

export function MemberRow({
  id,
  name,
  email,
  role,
  active,
  self,
}: {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  self: boolean;
}) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (r: Role, a: boolean) =>
    start(async () => {
      const res = await updateMember(id, r, a);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border p-3">
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {name} {self && <Badge tone="info">{L("You", "أنت")}</Badge>}
        </p>
        <p className="text-subtle truncate text-xs" dir="ltr">
          {email}
        </p>
      </div>
      {!active && <Badge tone="muted">{L("Removed", "مُزال")}</Badge>}
      <select
        aria-label={L("Role", "الدور")}
        className="bg-surface rounded-lg border px-2 py-1.5 text-sm"
        value={role}
        disabled={pending}
        onChange={(e) => run(e.target.value as Role, active)}
      >
        {(["company_admin", "recruiter", "interviewer"] as Role[]).map((r) => (
          <option key={r} value={r}>
            {t.roles[r]}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant={active ? "ghost" : "soft"}
        disabled={pending}
        onClick={() => run(role, !active)}
      >
        {active ? L("Remove", "إزالة") : L("Restore", "استعادة")}
      </Button>
    </li>
  );
}
