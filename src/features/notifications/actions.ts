"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";

export async function markNotificationRead(id: string) {
  const session = await requireSession();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", session.userId);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const session = await requireSession();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", session.userId)
    .is("read_at", null);
  revalidatePath("/", "layout");
}

export async function saveNotificationPreferences(form: FormData) {
  const session = await requireSession();
  const supabase = await createClient();
  await supabase.from("notification_preferences").upsert({
    user_id: session.userId,
    in_app_enabled: form.get("in_app") === "on",
    email_enabled: form.get("email") === "on",
    updated_at: new Date().toISOString(),
  });
  revalidatePath("/", "layout");
}
