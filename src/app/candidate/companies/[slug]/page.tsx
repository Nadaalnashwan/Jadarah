import { notFound } from "next/navigation";
import { CompanyProfile, loadCompany } from "@/features/companies/directory";
import { requireCandidate } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function CandidateCompany({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireCandidate();
  const { t, locale } = await getI18n();
  const data = await loadCompany(await createClient(), slug);
  if (!data) notFound();
  return <CompanyProfile data={data} locale={locale} t={t} jobHref={(id) => `/candidate/jobs/${id}`} />;
}
