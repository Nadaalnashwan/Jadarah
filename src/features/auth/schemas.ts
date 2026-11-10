import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10)
  .max(128)
  .refine((v) => /[A-Za-z؀-ۿ]/.test(v) && /\d/.test(v), { message: "weak" });

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
  next: z.string().optional(),
});

export const signUpSchema = z
  .object({
    accountType: z.enum(["candidate", "company"]),
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(254),
    password: passwordSchema,
    confirmPassword: z.string(),
    consent: z.literal("on"),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "mismatch" });

export const emailOnlySchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export const resetSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "mismatch" });

/** Only allow same-origin relative redirects. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
