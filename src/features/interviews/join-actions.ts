"use server";
import { requireSession } from "@/lib/auth/session";
import { localizeError, type ActionResult } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { JOIN_EARLY_MIN, JOIN_LATE_MIN, createMeetingToken, dailyConfigured } from "@/services/daily";
import { ensureVideoRoom } from "./video";

export type JoinState =
  | { state: "waiting"; opensAt: string; role: "candidate" | "interviewer" }
  | { state: "ready"; url: string; token: string; role: "candidate" | "interviewer"; endsAt: string }
  | { state: "room_pending"; role: "candidate" | "interviewer" }
  | { state: "closed"; reason: "cancelled" | "completed" | "ended" }
  | { state: "unavailable" };

/**
 * Join credentials for the built-in video interview. The database decides who may join
 * (interview_video_access: the application's candidate or an assigned interviewer — nobody else);
 * the Daily token is minted server-side, room-scoped and expires shortly after the interview.
 */
export async function getJoinCredentials(interviewId: string): Promise<ActionResult<JoinState>> {
  await requireSession();
  const { locale } = await getI18n();
  if (!dailyConfigured()) return { ok: true, data: { state: "unavailable" } };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("interview_video_access", { p_interview: interviewId });
  if (error || !data?.[0]) return { ok: false, error: localizeError(error, locale) };
  const v = data[0];
  const role = v.access_role as "candidate" | "interviewer";
  if (v.status !== "scheduled") return { ok: true, data: { state: "closed", reason: v.status as "cancelled" | "completed" } };
  const now = Date.now();
  const opens = Date.parse(v.scheduled_at) - JOIN_EARLY_MIN * 60_000;
  const closes = Date.parse(v.ends_at) + JOIN_LATE_MIN * 60_000;
  if (now > closes) return { ok: true, data: { state: "closed", reason: "ended" } };
  if (now < opens) return { ok: true, data: { state: "waiting", opensAt: new Date(opens).toISOString(), role } };

  let roomName = v.room_name;
  let roomUrl = v.room_url;
  if (!roomName || !roomUrl) {
    // Interviewers can create the room on first join; candidates wait for it (attach is staff-only).
    if (role !== "interviewer") return { ok: true, data: { state: "room_pending", role } };
    const room = await ensureVideoRoom(supabase, interviewId).catch(() => null);
    if (!room) return { ok: true, data: { state: "room_pending", role } };
    roomName = room.name;
    roomUrl = room.url;
  }
  const { data: auth } = await supabase.auth.getUser();
  const token = await createMeetingToken({
    roomName,
    userId: auth.user!.id,
    userName: v.display_name,
    owner: role === "interviewer",
    endsAt: v.ends_at,
  });
  return { ok: true, data: { state: "ready", url: roomUrl, token, role, endsAt: v.ends_at } };
}

export async function recordPresence(interviewId: string, event: "joined" | "left"): Promise<void> {
  await requireSession();
  const supabase = await createClient();
  await supabase.rpc("record_interview_presence", { p_interview: interviewId, p_event: event });
}
