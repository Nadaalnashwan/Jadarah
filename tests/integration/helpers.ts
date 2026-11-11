import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";
import { onTestFinished } from "vitest";
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
// Sessions are reused across test files (vitest workers) to stay well under Supabase Auth's
// sign-in rate limit. Stored in a private (0600) temp file; demo identities only.
const SESSION_FILE = join(tmpdir(), "jadarah-integration-sessions.json");
function readSessions(): Record<string, { access_token: string; refresh_token: string; expires_at: number }> {
  try {
    return JSON.parse(readFileSync(SESSION_FILE, "utf8"));
  } catch {
    return {};
  }
}
export async function as(localPart: string): Promise<SupabaseClient<Database>> {
  const hit = cache.get(localPart);
  if (hit) return hit;
  const client = anon();
  const saved = readSessions()[localPart];
  if (saved && saved.expires_at * 1000 > Date.now() + 120_000) {
    const { error } = await client.auth.setSession({ access_token: saved.access_token, refresh_token: saved.refresh_token });
    if (!error) {
      cache.set(localPart, client);
      return client;
    }
  }
  const { data, error } = await client.auth.signInWithPassword({
    email: `${localPart}@${DEMO_DOMAIN}`,
    password: DEMO_PASSWORD,
  });
  if (error) throw new Error(`sign-in failed for ${localPart}: ${error.message}`);
  const all = readSessions();
  all[localPart] = {
    access_token: data.session!.access_token,
    refresh_token: data.session!.refresh_token,
    expires_at: data.session!.expires_at ?? 0,
  };
  writeFileSync(SESSION_FILE, JSON.stringify(all), { mode: 0o600 });
  cache.set(localPart, client);
  return client;
}

export async function userId(client: SupabaseClient<Database>): Promise<string> {
  const { data } = await client.auth.getUser();
  if (!data.user) throw new Error("no user");
  return data.user.id;
}


/**
 * A fresh published job owned by the recruiter's company, so tests never exhaust the finite
 * seeded candidate/job pairs. Created through RLS as the recruiter (no privileged access).
 */
export async function freshJob(recruiter: SupabaseClient<Database>, companyId: string): Promise<{ id: string }> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await recruiter
    .from("jobs")
    .insert({ company_id: companyId, title_en: `Test role ${stamp}`, title_ar: `وظيفة اختبار ${stamp}`, city: "Riyadh", status: "published", min_years: 0 })
    .select("id")
    .single();
  if (error) throw new Error(`freshJob failed: ${error.message}`);
  // Keep test roles out of public listings once the test ends.
  onTestFinished(async () => {
    await recruiter.from("jobs").update({ status: "closed" }).eq("id", data.id);
  });
  return data;
}
