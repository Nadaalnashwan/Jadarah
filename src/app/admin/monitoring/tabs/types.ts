import type { Locale } from "@/lib/i18n/config";
import type { MonitoringParams, Period } from "@/lib/monitoring/period";
import type { ServerSupabase } from "@/lib/supabase/server";

export type TabProps = {
  supabase: ServerSupabase;
  period: Period;
  /** Include demo identities/companies (scope=all). */
  demo: boolean;
  locale: Locale;
  params?: MonitoringParams & { page?: string };
};
