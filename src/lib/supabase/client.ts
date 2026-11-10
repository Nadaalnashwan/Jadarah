"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { publicEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser client (publishable key only). Used for direct-to-storage uploads under RLS. */
export function getBrowserClient() {
  if (!client) client = createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey);
  return client;
}
