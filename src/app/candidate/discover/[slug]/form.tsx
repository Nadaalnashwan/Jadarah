"use client";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Textarea } from "@/components/ui/form";
import { submitExploration } from "@/features/candidate/exploration-actions";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

/** Draft is kept in this browser only (convenience), so leaving the page doesn't lose work. */
export function ExplorationForm({ slug }: { slug: string }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const key = `jadarah.explore.${slug}`;
  const [text, setText] = useState("");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(submitExploration.bind(null, slug), null);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a local draft once on mount
      setText(localStorage.getItem(key) ?? "");
    } catch {}
  }, [key]);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      onSubmit={() => {
        try {
          localStorage.removeItem(key);
        } catch {}
      }}
    >
      <Textarea
        name="response"
        rows={10}
        maxLength={12000}
        value={text}
        dir="auto"
        aria-label={L("Your response", "إجابتك")}
        placeholder={L("Write your approach here…", "اكتب طريقتك هنا…")}
        onChange={(e) => {
          setText(e.target.value);
          try {
            localStorage.setItem(key, e.target.value);
          } catch {}
        }}
      />
      <p className="text-subtle ltr-nums text-xs">
        {words} {L("words", "كلمة")}
      </p>
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" loading={pending} className="self-start">
        {L("Submit and get feedback", "أرسل واحصل على الملاحظات")}
      </Button>
    </form>
  );
}
