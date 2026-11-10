import Link from "next/link";
import { CompanyStatusBadge } from "@/components/app/status-badge";
import { Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { CompanyForm } from "@/features/company/company-form";
import { requireCompanyMember } from "@/lib/auth/session";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function CompanyProfilePage() {
  const s = await requireCompanyMember(["company_admin"]);
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("company_profiles")
    .select("*")
    .eq("id", s.activeMembership.company_id)
    .single();
  return (
    <>
      <PageHeader
        title={t.company.nav.profile}
        actions={
          <>
            <CompanyStatusBadge status={c!.status} t={t} />
            <Link
              href="/company/verification"
              className="text-primary dark:text-lavender text-sm font-semibold"
            >
              {L("Verification", "التحقق")}
            </Link>
          </>
        }
      />
      <Card>
        <CardBody>
          <CompanyForm mode="edit" defaults={{ ...c!, size_range: c!.size_range ?? "11-50" }} />
        </CardBody>
      </Card>
    </>
  );
}
