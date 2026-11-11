import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cookie-less server client using only the publishable key. Used for server-key RPCs
 * (internal_*: shared rate limits, AI cooldowns, email outbox, webhooks) where there is no
 * user session. It carries no privilege of its own: every internal RPC re-checks the server key.
 */
let client: SupabaseClient<Database> | null = null;
export function rpcClient(): SupabaseClient<Database> {
  client ??= createSupabaseClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-client-info": "jadarah-server" } },
  });
  return client;
}
