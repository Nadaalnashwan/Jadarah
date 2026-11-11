import { CompanyGrid, loadDirectory } from "@/features/companies/directory";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Companies" };

export default async function PublicCompanies() {
  const { locale } = await getI18n();
  const companies = await loadDirectory(await createClient());
  return (
    <div className="mx-auto max-w-6xl px-4 pt-32 pb-24 sm:px-6">
      <h1 className="editorial mb-8 text-4xl font-extrabold">{tx(locale)("Companies", "الشركات")}</h1>
      <CompanyGrid companies={companies} locale={locale} hrefBase="/companies" />
    </div>
  );
}
