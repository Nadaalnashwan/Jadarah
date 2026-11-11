"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCandidate, requireCompanyMember } from "@/lib/auth/session";
import { DEFAULT_TZ, addDays, freeSlots, zonedToUtcMs, type Slot } from "@/lib/domain/calendar";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

const windowSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    start_minute: z.number().int().min(0).max(1439),
    end_minute: z.number().int().min(1).max(1440),
  })
  .refine((w) => w.end_minute > w.start_minute);

const availabilitySchema = z.object({
  timezone: z.string().min(3).max(60),
  windows: z.array(windowSchema).max(42),
});

/** Replace the signed-in member's weekly availability for their active company (RLS: own rows). */
export async function saveMyAvailability(input: unknown): Promise<ActionResult> {
  const s = await requireCompanyMember();
  const { locale } = await getI18n();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: L("Check the time ranges.", "تحقق من الفترات الزمنية.") };
  try {
    new Intl.DateTimeFormat("en", { timeZone: parsed.data.timezone });
  } catch {
    return { ok: false, error: L("Unknown time zone.", "منطقة زمنية غير معروفة.") };
  }
  // Overlaps within a day are rejected up front (the DB exclusion constraint is the final guard).
  for (let d = 0; d < 7; d++) {
    const day = parsed.data.windows.filter((w) => w.weekday === d).sort((a, b) => a.start_minute - b.start_minute);
    for (let i = 1; i < day.length; i++)
      if (day[i].start_minute < day[i - 1].end_minute)
        return { ok: false, error: L("Time ranges on the same day overlap.", "تتداخل فترات اليوم نفسه.") };
  }
  const supabase = await createClient();
  const cid = s.activeMembership.company_id;
  const del = await supabase.from("interviewer_availability").delete().eq("user_id", s.userId).eq("company_id", cid);
  if (del.error) return { ok: false, error: localizeError(del.error, locale) };
  if (parsed.data.windows.length) {
    const { error } = await supabase.from("interviewer_availability").insert(
      parsed.data.windows.map((w) => ({ ...w, user_id: s.userId, company_id: cid, timezone: parsed.data.timezone })),
    );
    if (error) return { ok: false, error: localizeError(error, locale) };
  }
  revalidatePath("/company/availability");
  return { ok: true, message: L("Availability saved.", "حُفظت أوقات التوفّر.") };
}

/** Candidate confirms attendance (RPC re-checks ownership and timing). */
export async function confirmInterview(interviewId: string): Promise<ActionResult> {
  await requireCandidate();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_interview_attendance", { p_interview: interviewId });
  if (error) return { ok: false, error: localizeError(error, locale) };
  revalidatePath("/candidate/interviews");
  return { ok: true, message: locale === "ar" ? "تم تأكيد حضورك." : "Attendance confirmed." };
}

const slotQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.number().int().min(15).max(240),
  interviewers: z.array(z.string().uuid()).min(1).max(8),
  timezone: z.string().min(3).max(60).default(DEFAULT_TZ),
});

/**
 * Free slots for the selected interviewers on a date: weekly availability ∩ not busy (free/busy RPC).
 * Recruiters only. Suggestions — the database still rejects any conflicting booking.
 */
export async function getSchedulingSlots(input: unknown): Promise<ActionResult<{ slots: Slot[]; configured: string[] }>> {
  const s = await requireCompanyMember(["company_admin", "recruiter"]);
  const { locale } = await getI18n();
  const parsed = slotQuery.safeParse(input);
  if (!parsed.success) return { ok: false, error: localizeError(null, locale) };
  const q = parsed.data;
  const supabase = await createClient();
  const cid = s.activeMembership.company_id;
  const from = new Date(zonedToUtcMs(addDays(q.date, -1), q.timezone)).toISOString();
  const to = new Date(zonedToUtcMs(addDays(q.date, 2), q.timezone)).toISOString();
  const [{ data: availability, error: aErr }, { data: busy, error: bErr }] = await Promise.all([
    supabase
      .from("interviewer_availability")
      .select("user_id, weekday, start_minute, end_minute, timezone")
      .eq("company_id", cid)
      .in("user_id", q.interviewers),
    supabase.rpc("interviewer_busy", { p_company: cid, p_users: q.interviewers, p_from: from, p_to: to }),
  ]);
  if (aErr || bErr) return { ok: false, error: localizeError(aErr ?? bErr, locale) };
  const slots = freeSlots({
    date: q.date,
    timeZone: q.timezone,
    durationMinutes: q.duration,
    interviewers: q.interviewers,
    availability: availability ?? [],
    busy: busy ?? [],
  });
  return { ok: true, data: { slots, configured: [...new Set((availability ?? []).map((a) => a.user_id))] } };
}
