"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Tabs for pages grouped under one sidebar item (e.g. Profile · CVs · Skills). Each tab is a real route, so links,
 * history and permissions behave exactly as before; only the navigation is consolidated.
 */
export function SectionTabs({ items, label }: { items: { href: string; label: string }[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-1 mb-5 overflow-x-auto px-1">
      <ul className="bg-surface-2/60 inline-flex min-w-max gap-1 rounded-full border p-1" role="list">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted hover:bg-surface hover:text-foreground",
                )}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
