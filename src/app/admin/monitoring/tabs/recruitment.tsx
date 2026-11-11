import { RecruitmentView } from "@/features/monitoring/recruitment-view";
import { demoIds, interviewAttendance, recruitmentMonitoring } from "@/services/monitoring";
import type { TabProps } from "./types";

export async function RecruitmentTab({ supabase, period, demo, locale, params = {} }: TabProps) {
  const excl = demo ? null : await demoIds(supabase);
  const d = await recruitmentMonitoring(supabase, period, {
    companyId: params.company || null,
    excludeCompanies: excl?.companies ?? null,
  });
  const att = await interviewAttendance(supabase, d.interviews.ids);
  return <RecruitmentView d={d} att={att} period={period} locale={locale} />;
}
