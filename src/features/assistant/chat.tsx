"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bot, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import type { AssistantReply } from "./actions";
import { SUGGESTIONS_MARKER } from "./markers";

type Msg = { role: "user" | "assistant"; text: string; meta?: AssistantReply };

export function AssistantChat({ scope, starters }: { scope: "candidate" | "company"; starters: string[] }) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", text }, { role: "assistant", text: "" }]);
    setInput("");
    setBusy(true);
    const update = (patch: Partial<Msg>) =>
      setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, ...patch } : x)));
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, message: text }),
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      if (res.headers.get("X-AI-Mode") !== "ai") {
        // Labelled rule-based guidance (no provider available) — not presented as AI.
        const r = (await res.json()) as { reply: string; suggestions: string[] };
        update({ text: r.reply, meta: { ...r, mode: "rule_based", provider: "rule_based" } });
        return;
      }
      const provider = `${res.headers.get("X-AI-Provider")} · ${res.headers.get("X-AI-Model")}`;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let full = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        update({ text: full.split(SUGGESTIONS_MARKER)[0].trimStart() });
        end.current?.scrollIntoView({ block: "end" });
      }
      const [reply, tail = ""] = full.split(SUGGESTIONS_MARKER);
      const suggestions = tail
        .split("\n")
        .map((l) => l.replace(/^[\s\-•*\d.)]+/, "").trim())
        .filter(Boolean)
        .slice(0, 3);
      update({ text: reply.trim(), meta: { reply: reply.trim(), suggestions, mode: "ai", provider } });
    } catch {
      update({ text: t.common.errorBody });
    } finally {
      setBusy(false);
      requestAnimationFrame(() => end.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  const last = msgs.findLast((m) => m.meta)?.meta;
  return (
    <div className="bg-surface flex h-[min(70vh,44rem)] flex-col overflow-hidden rounded-[1.75rem] border">
      <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
        {msgs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="bg-navy text-lavender flex size-14 items-center justify-center rounded-2xl">
              <Bot className="size-7" />
            </span>
            <p className="mt-4 font-bold">{L("Ask about your journey", "اسأل عن رحلتك")}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {starters.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="hover:border-primary/50 rounded-full border px-3 py-1.5 text-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {msgs.filter((m) => m.text || m.role === "user").map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  m.role === "user" ? "bg-primary text-white" : "bg-surface-2",
                )}
              >
                <p className="whitespace-pre-line" dir="auto">
                  {m.text}
                </p>
                {m.meta && (
                  <Badge tone={m.meta.mode === "ai" ? "progress" : "neutral"} className="mt-2">
                    {m.meta.mode === "ai"
                      ? t.common.aiGenerated
                      : t.common.ruleBased}
                  </Badge>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && !msgs[msgs.length - 1]?.text && (
          <div className="flex gap-1 px-2" aria-label={t.common.loading}>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="bg-primary size-2 rounded-full"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        )}
        <div ref={end} />
      </div>
      {last?.suggestions?.length ? (
        <div className="flex flex-wrap gap-2 border-t px-4 pt-3">
          {last.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="bg-surface-2 hover:bg-accent-soft rounded-full px-3 py-1 text-xs"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t p-3"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          className="min-h-11 resize-none"
          placeholder={L("Type your question…", "اكتب سؤالك…")}
          aria-label={L("Message", "الرسالة")}
          maxLength={1500}
        />
        <Button type="submit" size="icon" className="size-11" loading={busy} aria-label={t.common.submit}>
          <Send className="rtl:-scale-x-100" />
        </Button>
      </form>
    </div>
  );
}
