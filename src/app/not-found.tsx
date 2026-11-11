import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4">
      <EmptyState
        title={t.common.notFound}
        body={t.common.notFoundBody}
        action={
          <Button asChild>
            <Link href="/">{t.common.goHome}</Link>
          </Button>
        }
      />
    </main>
  );
}
