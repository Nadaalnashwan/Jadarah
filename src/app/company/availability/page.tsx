import { PageHeader } from "@/components/ui/primitives";
import { GroupTabs } from "@/components/shell/group-tabs";
import { requireCompanyMember } from "@/lib/auth/session";
import { DEFAULT_TZ } from "@/lib/domain/calendar";
import { tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AvailabilityEditor } from "./editor";

export default async function AvailabilityPage() {
  const s = await requireCompanyMember();
  const { locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("interviewer_availability")
    .select("weekday, start_minute, end_minute, timezone")
    .eq("user_id", s.userId)
    .eq("company_id", s.activeMembership.company_id)
    .order("weekday")
    .order("start_minute");
  return (
    <>
      <GroupTabs group="company-interviews" />
      <PageHeader
        title={L("My availability", "أوقات توفّري")}
        description={L("Weekly interview hours. If none are set, Sunday–Thursday 09:00–17:00 is used.", "ساعات المقابلات الأسبوعية. إن لم تُحدَّد يُعتمد الأحد–الخميس 09:00–17:00.")}
      />
      <AvailabilityEditor
        initial={(data ?? []).map((w) => ({ weekday: w.weekday, start_minute: w.start_minute, end_minute: w.end_minute }))}
        initialTimezone={data?.[0]?.timezone ?? DEFAULT_TZ}
      />
    </>
  );
}
