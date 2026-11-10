import Link from "next/link";
import { MapPin } from "lucide-react";
import { formatDate, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Jobs" };
export default async function PublicJobs() {
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select(
      "id, title_en, title_ar, city, work_mode, employment_type, deadline, company:company_profiles(name_en, name_ar)",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(60);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-32 pb-24 sm:px-6">
      <p className="eyebrow mb-3">{L("Open roles", "وظائف متاحة")}</p>
      <h1 className="editorial text-4xl font-extrabold sm:text-5xl">
        {L("Opportunities on JADARAH", "الفرص على جدارة")}
      </h1>
      <p className="text-muted mt-3">
        {L(
          "Sign in as a candidate to see your evidence match and apply.",
          "سجّل الدخول كمرشح لترى مطابقتك وتتقدّم.",
        )}
      </p>
      <ul className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data ?? []).map((j) => (
          <li key={j.id}>
            <Link
              href={`/jobs/${j.id}`}
              className="surface-card hover:border-primary/40 block p-5 transition hover:-translate-y-0.5"
            >
              <p className="text-subtle text-xs font-semibold">{pick(j.company, "name", locale)}</p>
              <p className="mt-1 text-lg font-bold">{pick(j, "title", locale)}</p>
              <p className="text-muted mt-2 flex items-center gap-1 text-xs">
                <MapPin className="size-3.5" /> {j.city} · {t.workMode[j.work_mode]} ·{" "}
                {t.employmentType[j.employment_type]}
              </p>
              {j.deadline && (
                <p className="text-subtle mt-3 text-xs">
                  {L("Apply by", "قدّم قبل")} {formatDate(j.deadline, locale)}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
