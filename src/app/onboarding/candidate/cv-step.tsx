"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { CvUploader } from "@/app/candidate/cvs/cv-client";
import { CvReview } from "@/features/candidate/cv-review";
import { parseCv } from "@/features/candidate/cv-actions";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";
import type { ParsedCv } from "@/services/ai/cv";

/**
 * Onboarding step 1 (optional): upload a CV → secure storage → extraction → editable review → approved data saved.
 * Skipping is always possible; the candidate can complete the profile manually.
 */
export function CvFirstStep({ userId }: { userId: string }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [phase, setPhase] = useState<"upload" | "extracting" | "review" | "failed">("upload");
  const [docId, setDocId] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedCv | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function extract(id: string) {
    setDocId(id);
    setPhase("extracting");
    const r = await parseCv(id).catch(() => null);
    if (!r || !r.ok) {
      setError(r && !r.ok ? r.error : L("We couldn't read this CV", "تعذّرت قراءة هذه السيرة"));
      return setPhase("failed");
    }
    setParsed(r.data!.parsed);
    setPhase("review");
  }

  return (
    <section className="surface-card mt-10 p-6 sm:p-8" aria-labelledby="cv-step-title">
      <p className="eyebrow mb-2">{L("Step 1 · optional", "الخطوة 1 · اختيارية")}</p>
      <h2 id="cv-step-title" className="text-xl font-bold">
        {L("Start from your CV", "ابدأ من سيرتك الذاتية")}
      </h2>
      <p className="text-muted mt-1 max-w-xl text-sm">
        {L(
          "We read your CV, you review every item, and only what you approve is added to your profile. Your original file is kept privately as a version",
          "نقرأ سيرتك، وتراجع كل عنصر، ولا يُضاف لملفك إلا ما تعتمده. يُحفظ ملفك الأصلي بشكل خاص كنسخة",
        )}
      </p>
      <div className="mt-6">
        {phase === "upload" && <CvUploader userId={userId} onUploaded={extract} />}
        {phase === "extracting" && (
          <p className="text-muted flex items-center gap-2 text-sm" role="status">
            <Loader2 className="size-4 animate-spin" />
            <ScanSearch className="size-4" /> {L("Reading your CV…", "جارٍ قراءة سيرتك…")}
          </p>
        )}
        {phase === "failed" && (
          <div className="flex flex-col items-start gap-3">
            <FormMessage>{error}</FormMessage>
            <p className="text-muted text-sm">
              {L("Your CV was saved. You can retry or continue manually", "حُفظت سيرتك. يمكنك المحاولة مجددًا أو المتابعة يدويًا")}
            </p>
            <div className="flex gap-2">
              {docId && (
                <Button size="sm" variant="outline" onClick={() => extract(docId)}>
                  {L("Try again", "حاول مجددًا")}
                </Button>
              )}
              <Button size="sm" asChild>
                <Link href="/onboarding/candidate?cv=skip">{L("Continue manually", "المتابعة يدويًا")}</Link>
              </Button>
            </div>
          </div>
        )}
        {phase === "review" && parsed && docId && (
          <CvReview documentId={docId} parsed={parsed} onDone={() => router.push("/onboarding/candidate?cv=done")} />
        )}
      </div>
      {phase !== "review" && (
        <p className="mt-6 text-sm">
          <Link href="/onboarding/candidate?cv=skip" className="text-primary font-semibold">
            {L("Skip — I'll fill my profile manually", "تخطَّ — سأكمل ملفي يدويًا")}
          </Link>
        </p>
      )}
    </section>
  );
}
