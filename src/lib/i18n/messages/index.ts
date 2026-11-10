import type { Locale } from "../config";
import { ar } from "./ar";
import { en, type Messages } from "./en";

export type { Messages };

export function getMessages(locale: Locale): Messages {
  return locale === "ar" ? ar : en;
}

/** Replace {placeholders} in a message. */
export function fmt(message: string, values: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ""));
}
