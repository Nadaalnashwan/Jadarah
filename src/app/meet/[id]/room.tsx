"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { CalendarX2, Camera, Clock, Loader2, Mic, MonitorUp, ShieldCheck, Video } from "lucide-react";
import type { DailyCall } from "@daily-co/daily-js";
import { Button } from "@/components/ui/button";
import { getJoinCredentials, recordPresence, type JoinState } from "@/features/interviews/join-actions";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

type Phase = "loading" | "lobby" | "joining" | "in_call" | "left" | "error";

export function MeetingRoom({
  interviewId,
  role,
  backHref,
  startsAt,
}: {
  interviewId: string;
  role: "candidate" | "interviewer";
  backHref: string;
  startsAt: string;
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [join, setJoin] = useState<JoinState | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const frameEl = useRef<HTMLDivElement>(null);
  const call = useRef<DailyCall | null>(null);

  const refresh = useCallback(async () => {
    const r = await getJoinCredentials(interviewId);
    if (!r.ok) {
      setError(r.error);
      setPhase("error");
      return;
    }
    setJoin(r.data!);
    setPhase((p) => (p === "in_call" || p === "joining" ? p : "lobby"));
  }, [interviewId]);

  // Initial load + re-check while waiting (room opens 15 min before the start).
  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(tick);
    };
  }, [refresh]);
  useEffect(() => {
    if (join?.state !== "waiting" && join?.state !== "room_pending") return;
    const wait = join.state === "waiting" ? Math.max(5_000, Date.parse(join.opensAt) - Date.now() + 1_000) : 20_000;
    const t = setTimeout(refresh, Math.min(wait, 60_000));
    return () => clearTimeout(t);
  }, [join, refresh]);

  // Leave cleanly when the page goes away.
  useEffect(
    () => () => {
      call.current?.destroy().catch(() => undefined);
    },
    [],
  );

  async function enter() {
    if (join?.state !== "ready" || !frameEl.current) return;
    setPhase("joining");
    const Daily = (await import("@daily-co/daily-js")).default;
    const frame = Daily.createFrame(frameEl.current, {
      iframeStyle: { width: "100%", height: "100%", border: "0", borderRadius: "1.25rem" },
      showLeaveButton: true,
      showFullscreenButton: true,
      lang: "user", // Daily Prebuilt has no Arabic UI; JADARAH's surrounding UI stays bilingual
    });
    call.current = frame;
    frame
      .on("loaded", () => setFrameLoaded(true))
      .on("joined-meeting", () => {
        setPhase("in_call");
        void recordPresence(interviewId, "joined");
      })
      .on("left-meeting", () => {
        void recordPresence(interviewId, "left");
        setPhase("left");
        frame.destroy().catch(() => undefined);
        call.current = null;
        setFrameLoaded(false);
      })
      .on("error", () => {
        setError(L("The video call could not continue. Please rejoin", "تعذّر استمرار المكالمة. يرجى الانضمام مجددًا"));
        setPhase("error");
      });
    try {
      await frame.join({ url: join.url, token: join.token });
    } catch {
      setError(L("Could not join the call. Check your connection and try again", "تعذّر الانضمام. تحقق من اتصالك وحاول مجددًا"));
      setPhase("error");
    }
  }

  const countdown = (() => {
    const target = join?.state === "waiting" ? Date.parse(join.opensAt) : Date.parse(startsAt);
    const s = Math.max(0, Math.floor((target - now) / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return d > 0 ? `${d}d ${h}h ${m}m` : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  })();

  const inCall = phase === "joining" || phase === "in_call";
  return (
    <main className="flex flex-1 flex-col p-3 sm:p-6">
      {/* the Daily frame mounts here once the participant enters */}
      <div
        ref={frameEl}
        className={
          inCall ? "ink relative h-[calc(100dvh-7.5rem)] min-h-[28rem] w-full overflow-hidden rounded-[1.25rem]" : "hidden"
        }
      >
        {phase === "joining" && !frameLoaded && (
          <span className="text-lavender pointer-events-none absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-8 animate-spin" />
          </span>
        )}
      </div>

      {!inCall && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mt-4 flex w-full max-w-2xl flex-col items-center gap-6 text-center"
        >
          {phase === "loading" && <Loader2 className="text-primary size-8 animate-spin" />}

          {phase === "error" && (
            <Panel icon={<CalendarX2 />} title={L("Unable to join", "تعذّر الانضمام")} body={error ?? ""}>
              <Button onClick={() => void refresh()}>{L("Try again", "حاول مجددًا")}</Button>
            </Panel>
          )}

          {phase === "left" && (
            <Panel
              icon={<ShieldCheck />}
              title={L("You left the interview", "غادرت المقابلة")}
              body={
                role === "interviewer"
                  ? L("Remember to submit your structured evaluation", "لا تنسَ إرسال تقييمك المنظّم")
                  : L("Thank you. The company will share updates on your application", "شكرًا لك. ستشاركك الشركة المستجدات بشأن طلبك")
              }
            >
              <div className="flex gap-2">
                <Button variant="soft" onClick={() => void refresh().then(() => setPhase("lobby"))}>
                  {L("Rejoin", "إعادة الانضمام")}
                </Button>
                <Button asChild>
                  <Link href={backHref}>{role === "interviewer" ? L("Evaluate now", "قيّم الآن") : L("Back", "رجوع")}</Link>
                </Button>
              </div>
            </Panel>
          )}

          {phase === "lobby" && join && (
            <>
              {join.state === "unavailable" && (
                <Panel
                  icon={<Video />}
                  title={L("Video interviews are not configured", "لم تُضبط المقابلات المرئية")}
                  body={L("Please contact the company for the meeting details", "يرجى التواصل مع الشركة لمعرفة تفاصيل الاجتماع")}
                />
              )}
              {join.state === "closed" && (
                <Panel
                  icon={<CalendarX2 />}
                  title={
                    join.reason === "cancelled"
                      ? L("This interview was cancelled", "أُلغيت هذه المقابلة")
                      : L("This interview has ended", "انتهت هذه المقابلة")
                  }
                  body=""
                >
                  <Button asChild variant="soft">
                    <Link href={backHref}>{L("Back", "رجوع")}</Link>
                  </Button>
                </Panel>
              )}
              {(join.state === "waiting" || join.state === "room_pending") && (
                <Panel
                  icon={<Clock />}
                  title={L("Waiting room", "غرفة الانتظار")}
                  body={
                    join.state === "waiting"
                      ? L("The room opens 15 minutes before the start", "تُفتح الغرفة قبل الموعد بخمس عشرة دقيقة")
                      : L("The interviewer is opening the room…", "يقوم المُقابِل بفتح الغرفة…")
                  }
                >
                  {join.state === "waiting" && (
                    <p className="ltr-nums text-navy text-5xl font-extrabold tracking-tight" aria-live="polite">
                      {countdown}
                    </p>
                  )}
                </Panel>
              )}
              {join.state === "ready" && (
                <Panel
                  icon={<Video />}
                  title={L("Your interview room is open", "غرفة مقابلتك مفتوحة")}
                  body={L(
                    "You'll check your camera and microphone before entering. The call is private to the participants and is not recorded",
                    "ستتحقق من الكاميرا والميكروفون قبل الدخول. المكالمة خاصة بالمشاركين ولا تُسجَّل",
                  )}
                >
                  <Button size="lg" onClick={() => void enter()}>
                    <Video /> {L("Join interview", "انضم إلى المقابلة")}
                  </Button>
                </Panel>
              )}
              <ul className="text-muted grid w-full gap-2 text-start text-sm sm:grid-cols-3">
                {[
                  [<Camera key="c" />, L("Camera ready, good lighting", "كاميرا جاهزة وإضاءة جيدة")],
                  [<Mic key="m" />, L("Quiet place, headphones help", "مكان هادئ، والسماعات تساعد")],
                  [<MonitorUp key="s" />, L("Screen sharing is available", "مشاركة الشاشة متاحة")],
                ].map(([icon, text], i) => (
                  <li key={i} className="bg-surface flex items-center gap-2 rounded-2xl border p-3 [&_svg]:size-4 [&_svg]:shrink-0">
                    {icon}
                    {text}
                  </li>
                ))}
              </ul>
            </>
          )}
        </motion.section>
      )}
    </main>
  );
}

function Panel({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="surface-card flex w-full flex-col items-center gap-4 p-8">
      <span className="ink text-primary-ink flex size-14 items-center justify-center rounded-2xl [&_svg]:size-7">{icon}</span>
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {body && <p className="text-muted max-w-md">{body}</p>}
      {children}
    </div>
  );
}
