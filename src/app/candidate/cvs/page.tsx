import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireCandidate } from "@/lib/auth/session";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { aiStatus } from "@/services/ai/provider";
import { CvList, CvUploader } from "./cv-client";

export default async function CvsPage() {
  const session = await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidate_documents")
    .select("id, file_name, label, version, is_primary, size_bytes, mime_type, parse_status, parsed_data, created_at")
    .eq("candidate_id", session.userId)
    .eq("kind", "cv")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const docs = (data ?? []).filter((d) => d.label !== "[archived]");
  const ai = aiStatus();
  return (
    <>
      <PageHeader
        eyebrow={t.candidate.nav.cvs}
        title={L("Your CVs", "سيرك الذاتية")}
        description={L(
          "Files are stored privately. Only you, and companies you apply to, can open them through short-lived links.",
          "تُحفظ الملفات بشكل خاص. لا يفتحها إلا أنت والشركات التي تتقدّم إليها عبر روابط مؤقتة.",
        )}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title={L("Upload a new version", "رفع نسخة جديدة")} description={L("PDF or Word, up to 10 MB. Uploads never overwrite earlier versions.", "PDF أو Word حتى 10 ميجابايت. الرفع لا يستبدل النسخ السابقة.")} />
          <CardBody>
            <CvUploader userId={session.userId} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title={L("Versions", "النسخ")}
            description={ai.configured ? L(`Parsing uses ${ai.provider} — you review every extracted field.`, `يستخدم التحليل ${ai.provider} — وتراجع كل حقل مستخرج.`) : t.common.ruleBased}
          />
          <CardBody>{docs.length ? <CvList docs={docs} /> : <EmptyState title={L("No CV uploaded yet", "لم تُرفع أي سيرة ذاتية بعد")} />}</CardBody>
        </Card>
      </div>
    </>
  );
}
