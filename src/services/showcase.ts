import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getPlatformContact(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("public_contact_email" as never);
    return (data as unknown as string) || null;
  } catch {
    return null;
  }
}
