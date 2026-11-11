import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { createRoom, dailyConfigured, deleteRoom, updateRoomWindow } from "@/services/daily";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/** Interview types that happen on JADARAH's built-in Daily video call (phone/on-site do not). */
export const VIDEO_TYPES = ["video", "technical", "behavioral", "panel"] as const;

/**
 * Make sure a scheduled video interview has its private Daily room. Caller must be a recruiter of the
 * company or an assigned interviewer (attach_video_room re-checks). Returns the room or null.
 */
export async function ensureVideoRoom(supabase: ServerSupabase, interviewId: string) {
  if (!dailyConfigured()) return null;
  const { data: iv } = await supabase
    .from("interviews")
    .select("id, type, status, scheduled_at, ends_at, video_room_name, video_room_url")
    .eq("id", interviewId)
    .maybeSingle();
  if (!iv || iv.status !== "scheduled" || !(VIDEO_TYPES as readonly string[]).includes(iv.type)) return null;
  if (iv.video_room_name && iv.video_room_url) return { name: iv.video_room_name, url: iv.video_room_url };
  const room = await createRoom(iv.id, iv.scheduled_at, iv.ends_at);
  const { error } = await supabase.rpc("attach_video_room", { p_interview: iv.id, p_name: room.name, p_url: room.url });
  if (error) {
    await deleteRoom(room.name).catch(() => undefined);
    return null;
  }
  return room;
}

/** After a reschedule: move the room's open/close window (or create it if it was missing). */
export async function syncVideoRoomWindow(supabase: ServerSupabase, interviewId: string) {
  if (!dailyConfigured()) return;
  const { data: iv } = await supabase
    .from("interviews")
    .select("scheduled_at, ends_at, video_room_name")
    .eq("id", interviewId)
    .maybeSingle();
  if (!iv) return;
  if (iv.video_room_name) await updateRoomWindow(iv.video_room_name, iv.scheduled_at, iv.ends_at);
  else await ensureVideoRoom(supabase, interviewId);
}

/** After a cancellation: delete the Daily room so no one can join with an old token. */
export async function removeVideoRoom(supabase: ServerSupabase, interviewId: string) {
  if (!dailyConfigured()) return;
  const { data: iv } = await supabase.from("interviews").select("video_room_name").eq("id", interviewId).maybeSingle();
  if (!iv?.video_room_name) return;
  await deleteRoom(iv.video_room_name);
  await supabase.rpc("detach_video_room", { p_interview: interviewId });
}
