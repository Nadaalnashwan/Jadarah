"use client";
import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/form";
import { Avatar, Badge } from "@/components/ui/primitives";
import { inviteMember, updateMember } from "@/features/company/actions";
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
          "Invitation emails are not sent automatically. Share the sign-up link; the invitation appears after they sign in with this email.",
          "لا تُرسل رسائل الدعوة تلقائيًا. شارك رابط التسجيل؛ وتظهر الدعوة بعد تسجيل الدخول بهذا البريد.",
        )}
      </p>
    </form>
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
