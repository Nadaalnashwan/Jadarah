import { PageHeader } from "@/components/ui/primitives";
import { CompanyGrid, loadDirectory } from "@/features/companies/directory";
import { requireCandidate } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function CandidateCompanies() {
  await requireCandidate();
  const { t, locale } = await getI18n();
  const companies = await loadDirectory(await createClient());
  return (
    <>
      <PageHeader title={t.candidate.nav.companies} />
      <CompanyGrid companies={companies} locale={locale} hrefBase="/candidate/companies" />
    </>
  );
}
