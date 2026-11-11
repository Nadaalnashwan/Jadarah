"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages, Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { setLocaleAction, setThemeAction } from "@/features/preferences/actions";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await setLocaleAction(locale === "ar" ? "en" : "ar");
          router.refresh();
        })
      }
      disabled={pending}
      className={cn(
        "text-foreground hover:bg-surface-2 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition disabled:opacity-60",
        className,
      )}
      aria-label={t.common.language}
      lang={locale === "ar" ? "en" : "ar"}
    >
      <Languages className="size-4" aria-hidden />
      {t.common.switchLanguage}
    </button>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { locale } = useI18n();
  function toggle() {
    const root = document.documentElement;
    const current =
      root.dataset.theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    start(async () => {
      await setThemeAction(next);
      router.refresh();
    });
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={cn(
        "hover:bg-surface-2 inline-flex size-9 items-center justify-center rounded-full transition",
        className,
      )}
      aria-label={locale === "ar" ? "تبديل المظهر" : "Toggle theme"}
    >
      <Sun className="size-4 [:root[data-theme=dark]_&]:hidden" aria-hidden />
      <Moon className="hidden size-4 [:root[data-theme=dark]_&]:block" aria-hidden />
    </button>
  );
}
