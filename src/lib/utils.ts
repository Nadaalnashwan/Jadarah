import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string | null | undefined) {
  if (!name) return "؟";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Map a Postgres/Supabase error to a safe, user-presentable message (no internals). */
export function safeError(
  error: { message?: string; code?: string } | null | undefined,
  fallback: string,
): string {
  if (!error) return fallback;
  // Business-rule exceptions raised by our RPCs use P0001/P0002/23505/42501 with curated messages.
  if (error.code && ["P0001", "P0002", "23505"].includes(error.code) && error.message)
    return capitalize(error.message);
  if (error.code === "42501") return "You don't have permission to do that.";
  return fallback;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
