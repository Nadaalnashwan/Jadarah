"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

export function CompareSelector({ children }: { children: React.ReactNode }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);
  return (
    <div
      onChange={(e) => {
        const el = e.target as HTMLInputElement;
        if (el.name !== "compare") return;
        setIds((p) => (el.checked ? [...p, el.value].slice(0, 4) : p.filter((x) => x !== el.value)));
      }}
    >
      {children}
      <AnimatePresence>
        {ids.length >= 2 && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
            <div className="flex items-center gap-3 rounded-full bg-navy px-5 py-3 text-ivory shadow-2xl">
              <span className="ltr-nums text-sm">{ids.length} {L("selected", "محدد")}</span>
              <Button size="sm" onClick={() => router.push(`/company/compare?ids=${ids.join(",")}`)}><GitCompareArrows /> {L("Compare", "قارن")}</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
