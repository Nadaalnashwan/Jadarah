import { notFound } from "next/navigation";
import { CompanyProfile, loadCompany } from "@/features/companies/directory";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function PublicCompany({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, locale } = await getI18n();
  const data = await loadCompany(await createClient(), slug);
  if (!data) notFound();
  return (
    <div className="mx-auto max-w-5xl px-4 pt-32 pb-24 sm:px-6">
      <CompanyProfile data={data} locale={locale} t={t} jobHref={(id) => `/jobs/${id}`} />
    </div>
  );
}
