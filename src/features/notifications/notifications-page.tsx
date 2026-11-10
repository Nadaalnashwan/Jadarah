import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireSession } from "@/lib/auth/session";
import { formatRelative, pick } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead, markNotificationRead } from "./actions";

export async function NotificationsPage() {
  const session = await requireSession();
  const { t, locale } = await getI18n();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(100);
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <>
      <PageHeader
        title={t.common.notifications}
        actions={
          unread > 0 && (
            <form action={markAllNotificationsRead}>
              <Button variant="outline" size="sm">
                <CheckCheck /> {locale === "ar" ? "تعليم الكل كمقروء" : "Mark all as read"}
              </Button>
            </form>
          )
        }
      />
      <Card>
        {items.length === 0 ? (
          <EmptyState title={t.common.emptyTitle} />
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id} className={cn("flex items-start gap-4 p-4 sm:p-5", !n.read_at && "bg-accent-soft/40")}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{pick(n, "title", locale)}</p>
                  {pick(n, "body", locale) && <p className="mt-0.5 text-sm text-muted">{pick(n, "body", locale)}</p>}
                  <p className="mt-1 text-xs text-subtle">{formatRelative(n.created_at, locale)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {n.link && (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={n.link}>{t.common.open}</Link>
                    </Button>
                  )}
                  {!n.read_at && (
                    <form action={markNotificationRead.bind(null, n.id)}>
                      <Button variant="ghost" size="sm" aria-label={locale === "ar" ? "تعليم كمقروء" : "Mark as read"}>
                        <CheckCheck />
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
