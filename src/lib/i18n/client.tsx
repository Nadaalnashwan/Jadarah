"use client";
import { createContext, useContext } from "react";
import type { Locale } from "./config";
import { getMessages, type Messages } from "./messages";

const I18nContext = createContext<{ locale: Locale; t: Messages } | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, t: getMessages(locale) }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
