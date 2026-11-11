import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

/** True when candidates already received this job's practical task (it can no longer be replaced). */
export async function jobTaskLocked(supabase: ServerSupabase, jobId: string): Promise<boolean> {
  const { count } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("requires_task", true);
  return (count ?? 0) > 0;
}
