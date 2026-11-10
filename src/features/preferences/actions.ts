"use server";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  // Persist for signed-in users so emails/notifications can follow their language.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) await supabase.from("profiles").update({ locale }).eq("id", data.user.id);
}

export async function setThemeAction(theme: "light" | "dark" | "system") {
  const store = await cookies();
  if (theme === "system") store.delete("jadarah_theme");
  else store.set("jadarah_theme", theme, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
}
