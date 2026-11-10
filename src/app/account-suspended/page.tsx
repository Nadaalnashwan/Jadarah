import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { getI18n } from "@/lib/i18n/server";

export default async function SuspendedPage() {
  const { t } = await getI18n();
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
      <ShieldAlert className="size-10 text-danger" aria-hidden />
      <h1 className="text-3xl font-extrabold">{t.auth.suspendedTitle}</h1>
      <p className="text-muted">{t.auth.suspendedBody}</p>
      <div className="flex gap-2">
        <form action={signOutAction}>
          <Button type="submit" variant="outline">{t.common.signOut}</Button>
        </form>
        <Button asChild variant="ghost"><Link href="/">{t.common.goHome}</Link></Button>
      </div>
    </main>
  );
}
