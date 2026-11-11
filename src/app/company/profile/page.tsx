import Link from "next/link";
import { CompanyStatusBadge } from "@/components/app/status-badge";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { IdentityEditor } from "@/features/company/identity-editor";
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
  const { data: ident } = await supabase
    .from("company_identity")
    .select("*")
    .eq("company_id", s.activeMembership.company_id)
    .maybeSingle();
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
      <Card className="mb-6">
        <CardHeader
          title={L("Company identity", "هوية الشركة")}
          description={L(
            "How candidates recognise you across JADARAH: logo, cover, colours and a short description.",
            "كيف يتعرّف عليك المرشحون في جدارة: الشعار والغلاف والألوان ووصف مختصر.",
          )}
        />
        <CardBody>
          <IdentityEditor
            companyId={c!.id}
            name={{ en: c!.name_en, ar: c!.name_ar }}
            initial={{
              logo_path: ident?.logo_path ?? "",
              cover_path: ident?.cover_path ?? "",
              tagline_en: ident?.tagline_en ?? "",
              tagline_ar: ident?.tagline_ar ?? "",
              primary_hex: ident?.primary_hex ?? "",
              secondary_hex: ident?.secondary_hex ?? "",
              accent_hex: ident?.accent_hex ?? "",
            }}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title={L("Company details", "بيانات الشركة")}
          description={L(
            "Names, description and public contact details. Only add contact details meant for the public.",
            "الأسماء والوصف وبيانات التواصل العامة. أضف فقط بيانات التواصل المخصصة للعموم.",
          )}
        />
        <CardBody>
          <CompanyForm mode="edit" defaults={{ ...c!, size_range: c!.size_range ?? "11-50" }} />
        </CardBody>
      </Card>
    </>
  );
}
