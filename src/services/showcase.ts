import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ShowcaseData } from "@/features/landing/types";

/** Live, anonymised demo data for the landing page (only is_demo records; see public.landing_showcase()). */
export async function getShowcase(): Promise<ShowcaseData | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("landing_showcase" as never);
    if (error || !data) return null;
    const d = data as unknown as ShowcaseData;
    return d.candidate || d.company || d.plan ? d : null;
  } catch {
    return null;
  }
}

export async function getPlatformContact(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("public_contact_email" as never);
    return (data as unknown as string) || null;
  } catch {
    return null;
  }
}
