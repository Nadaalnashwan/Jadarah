"use client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n/client";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <main id="main" className="flex min-h-[60dvh] items-center justify-center px-4">
      <EmptyState
        title={t.common.errorTitle}
        body={t.common.errorBody}
        action={<Button onClick={reset}>{t.common.retry}</Button>}
      />
    </main>
  );
}
