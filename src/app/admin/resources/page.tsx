import { CheckCircle2 } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDate, pick, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { ResourceForm, ResourceRowActions } from "../admin-client";

export default async function AdminResources() {
  await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data } = await supabase.from("learning_resources").select("*").order("topic").order("title_en");
  const verified = (data ?? []).filter((r) => r.link_verified_at).length;
  return (
    <>
      <PageHeader title={t.admin.nav.resources} description={L(`${data?.length ?? 0} resources · ${verified} links verified by an automated check`, `${data?.length ?? 0} مصدرًا · ${verified} روابط تم التحقق منها آليًا`)} />
      <Card className="mb-6"><CardHeader title={L("Add resource", "إضافة مصدر")} /><CardBody><ResourceForm /></CardBody></Card>
      <Card><div className="overflow-x-auto"><table className="w-full min-w-[48rem] text-sm">
        <thead className="text-xs text-subtle"><tr className="border-b"><th className="p-4 text-start">{L("Resource", "المصدر")}</th><th className="p-4 text-start">{L("Topic", "الموضوع")}</th><th className="p-4 text-start">{L("Link", "الرابط")}</th><th className="p-4 text-end">{t.common.actions}</th></tr></thead>
        <tbody>{(data ?? []).map((r) => <tr key={r.id} className="border-b last:border-0"><td className="p-4"><a href={r.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-primary dark:hover:text-lavender">{pick(r, "title", locale)}</a><p className="text-xs text-subtle">{r.provider} · {r.kind} · {r.level}</p></td><td className="p-4 text-muted">{r.topic}</td><td className="p-4">{r.link_verified_at ? <span className="flex items-center gap-1 text-xs text-success"><CheckCircle2 className="size-3.5" /> {formatDate(r.link_verified_at, locale)}</span> : <Badge tone="neutral">{L("Not verified", "غير موثّق")}</Badge>}{!r.is_active && <Badge tone="muted" className="ms-1">{L("Inactive", "معطّل")}</Badge>}</td><td className="p-4"><div className="flex justify-end"><ResourceRowActions id={r.id} active={r.is_active} /></div></td></tr>)}</tbody>
      </table></div></Card>
    </>
  );
}
