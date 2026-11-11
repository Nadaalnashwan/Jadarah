import "server-only";
import { randomBytes } from "node:crypto";

/**
 * Daily.co REST client (server only — DAILY_API_KEY never reaches the browser).
 * Rooms are private: nobody can join without a meeting token minted here after the database
 * confirmed the caller belongs to the interview (public.interview_video_access).
 * No recording or transcription is enabled.
 */
const API = "https://api.daily.co/v1";
export const JOIN_EARLY_MIN = 15; // room opens 15 min before the start (waiting room until then)
export const JOIN_LATE_MIN = 30; // and closes 30 min after the scheduled end

export function dailyConfigured() {
  return Boolean(process.env.DAILY_API_KEY);
}

class DailyError extends Error {}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new DailyError(`daily_http_${res.status}`);
  return (await res.json()) as T;
}

const unix = (iso: string, deltaMin = 0) => Math.floor(Date.parse(iso) / 1000) + deltaMin * 60;

function windowProps(startsAt: string, endsAt: string) {
  return { nbf: unix(startsAt, -JOIN_EARLY_MIN), exp: unix(endsAt, JOIN_LATE_MIN) };
}

export async function createRoom(interviewId: string, startsAt: string, endsAt: string) {
  const name = `jdr-${interviewId.replace(/-/g, "").slice(0, 16)}-${randomBytes(4).toString("hex")}`;
  const room = await call<{ name: string; url: string }>("/rooms", {
    method: "POST",
    body: JSON.stringify({
      name,
      privacy: "private",
      properties: {
        ...windowProps(startsAt, endsAt),
        eject_at_room_exp: true,
        enable_prejoin_ui: true, // camera/mic check before entering
        enable_knocking: false, // token-only access
        enable_screenshare: true,
        enable_chat: true,
        max_participants: 8,
        lang: "user",
      },
    }),
  });
  return { name: room.name, url: room.url };
}

/** Move the room's open/close window after a reschedule. */
export async function updateRoomWindow(name: string, startsAt: string, endsAt: string) {
  await call(`/rooms/${encodeURIComponent(name)}`, {
    method: "POST",
    body: JSON.stringify({ properties: windowProps(startsAt, endsAt) }),
  });
}

export async function deleteRoom(name: string) {
  try {
    await call(`/rooms/${encodeURIComponent(name)}`, { method: "DELETE" });
  } catch (e) {
    if (!(e instanceof DailyError && e.message === "daily_http_404")) throw e;
  }
}

/** Short-lived, room-scoped token. Interviewers are room owners; candidates are not. */
export async function createMeetingToken(opts: {
  roomName: string;
  userId: string;
  userName: string;
  owner: boolean;
  endsAt: string;
}) {
  const exp = Math.min(unix(opts.endsAt, JOIN_LATE_MIN), Math.floor(Date.now() / 1000) + 3 * 3600);
  const { token } = await call<{ token: string }>("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: opts.roomName,
        user_id: opts.userId,
        user_name: opts.userName.slice(0, 60),
        is_owner: opts.owner,
        exp,
        eject_at_token_exp: true,
        enable_screenshare: true,
        start_cloud_recording: false,
      },
    }),
  });
  return token;
}
