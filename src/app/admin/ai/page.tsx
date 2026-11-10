import { Badge, Card, CardBody, CardHeader, PageHeader, Stat } from "@/components/ui/primitives";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDateTime, formatNumber, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { aiStatus } from "@/services/ai/provider";

export default async function AdminAI() {
  await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const ai = aiStatus();
  const [{ data: logs }, { data: gens }, { count: analyses }] = await Promise.all([
    supabase.from("ai_provider_logs").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("ai_generation_records").select("kind, provider, review_status, is_demo, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("ai_analysis_records").select("id", { count: "exact", head: true }),
  ]);
  const ok = (logs ?? []).filter((l) => l.success).length;
  const lat = (logs ?? []).filter((l) => l.latency_ms).map((l) => l.latency_ms!);
  return (
    <>
      <PageHeader title={t.admin.nav.ai} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5"><p className="text-xs font-semibold text-muted">{L("Provider", "المزوّد")}</p><p className="mt-1 text-xl font-extrabold">{ai.configured ? `${ai.provider} · ${ai.model}` : L("Not configured", "غير مضبوط")}</p><Badge tone={ai.configured ? "positive" : "neutral"} className="mt-2">{ai.configured ? L("Keys present on server", "المفاتيح موجودة على الخادم") : t.common.ruleBased}</Badge></Card>
        <Card className="p-5"><Stat label={L("Recent calls (success)", "الاستدعاءات الأخيرة (ناجحة)")} value={`${formatNumber(ok, locale)}/${formatNumber(logs?.length ?? 0, locale)}`} /></Card>
        <Card className="p-5"><Stat label={L("Avg. latency", "متوسط زمن الاستجابة")} value={lat.length ? `${formatNumber(Math.round(lat.reduce((a, b) => a + b, 0) / lat.length), locale)} ms` : "—"} /></Card>
        <Card className="p-5"><Stat label={L("Analysis records", "سجلات التحليل")} value={formatNumber(analyses ?? 0, locale)} hint={L("CV parsing etc. (incl. rule-based)", "تحليل السير وغيرها (يشمل المبني على قواعد)")} /></Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card><CardHeader title={L("Provider calls", "استدعاءات المزوّد")} /><CardBody>{(logs ?? []).length === 0 ? <p className="text-sm text-subtle">{L("No provider calls recorded.", "لا توجد استدعاءات مسجلة.")}</p> : <ul className="space-y-1 text-sm">{logs!.map((l) => <li key={l.id} className="flex justify-between gap-2"><span>{l.operation} · {l.provider}</span><span className="text-xs text-subtle">{l.success ? "✓" : `✗ ${l.error_code}`} · {formatDateTime(l.created_at, locale)}</span></li>)}</ul>}</CardBody></Card>
        <Card><CardHeader title={L("Generated content awaiting human review", "محتوى مولّد بانتظار المراجعة البشرية")} /><CardBody>{(gens ?? []).length === 0 ? <p className="text-sm text-subtle">—</p> : <ul className="space-y-1 text-sm">{gens!.map((g, i) => <li key={i} className="flex justify-between"><span>{g.kind} · {g.provider}</span><Badge tone={g.review_status === "pending_review" ? "progress" : "neutral"}>{g.review_status}</Badge></li>)}</ul>}</CardBody></Card>
      </div>
    </>
  );
}
