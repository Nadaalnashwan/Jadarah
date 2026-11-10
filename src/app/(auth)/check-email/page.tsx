import { MailCheck } from "lucide-react";
import { ResendForm } from "@/features/auth/forms";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/messages";

export const metadata = { title: "Check your email" };

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = "" } = await searchParams;
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-6">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-primary dark:text-lavender">
        <MailCheck className="size-7" aria-hidden />
      </span>
      <div>
        <h1 className="editorial text-4xl font-extrabold">{t.auth.checkEmailTitle}</h1>
        <p className="mt-3 text-muted">{fmt(t.auth.checkEmailBody, { email: email || "—" })}</p>
        <p className="mt-2 text-sm text-subtle">{t.auth.checkEmailNote}</p>
      </div>
      {email && <ResendForm email={email} />}
    </div>
  );
}
