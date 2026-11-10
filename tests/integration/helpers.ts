import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { Database } from "../../src/types/database";

config({ path: ".env.local" });

export const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "";
export const DEMO_DOMAIN = "jadarah-demo.test";

/** Integration tests run against the real Supabase project with real demo identities. */
export const integrationEnabled = Boolean(URL && KEY && DEMO_PASSWORD);

export function anon(): SupabaseClient<Database> {
  return createClient<Database>(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

const cache = new Map<string, SupabaseClient<Database>>();
export async function as(localPart: string): Promise<SupabaseClient<Database>> {
  const hit = cache.get(localPart);
  if (hit) return hit;
  const client = anon();
  const { error } = await client.auth.signInWithPassword({
    email: `${localPart}@${DEMO_DOMAIN}`,
    password: DEMO_PASSWORD,
  });
  if (error) throw new Error(`sign-in failed for ${localPart}: ${error.message}`);
  cache.set(localPart, client);
  return client;
}

export async function userId(client: SupabaseClient<Database>): Promise<string> {
  const { data } = await client.auth.getUser();
  if (!data.user) throw new Error("no user");
  return data.user.id;
}
