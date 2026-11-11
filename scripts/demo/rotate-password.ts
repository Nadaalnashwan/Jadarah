/**
 * Rotate the shared password of the fictional demo identities (e.g. when it was lost).
 * - Touches ONLY Auth users whose email ends in @jadarah-demo.test AND whose profile has is_demo = true.
 * - Changes the password only: no users, profiles or data are deleted or recreated.
 * - Generates a strong random password, writes it to .env.local as DEMO_USER_PASSWORD, never prints it.
 * - Refuses when platform_settings.environment = 'production' or JADARAH_ENV=production.
 *
 *   npm run demo:rotate-password -- --yes
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { Database } from "../../src/types/database";

config({ path: ".env.local", quiet: true });

async function main() {
  if (!process.argv.includes("--yes")) throw new Error("Pass --yes to confirm.");
  if (process.env.JADARAH_ENV === "production") throw new Error("Refusing: JADARAH_ENV=production.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: env } = await db.from("platform_settings").select("value").eq("key", "environment").maybeSingle();
  if (JSON.stringify(env?.value ?? "").includes("production")) throw new Error("Refusing: platform environment is production.");

  const { data: demoProfiles, error: pErr } = await db.from("profiles").select("id, email").eq("is_demo", true);
  if (pErr) throw pErr;
  const targets = (demoProfiles ?? []).filter((p) => p.email?.toLowerCase().endsWith("@jadarah-demo.test"));
  if (!targets.length) throw new Error("No demo identities found.");

  // Letters + digits, 24 chars: satisfies the platform rule (≥12, letters and numbers).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(24);
  let password = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  if (!/\d/.test(password)) password = password.slice(0, 23) + "7";

  let ok = 0;
  const failed: string[] = [];
  for (const t of targets) {
    const { error } = await db.auth.admin.updateUserById(t.id, { password });
    if (error) failed.push(`${t.email}: ${error.message}`);
    else ok++;
  }

  const envPath = ".env.local";
  const current = readFileSync(envPath, "utf8");
  const next = /^DEMO_USER_PASSWORD=.*$/m.test(current)
    ? current.replace(/^DEMO_USER_PASSWORD=.*$/m, `DEMO_USER_PASSWORD=${password}`)
    : `${current.trimEnd()}\nDEMO_USER_PASSWORD=${password}\n`;
  if (ok > 0) writeFileSync(envPath, next, { mode: 0o600 });

  console.log(`demo identities: ${targets.length}, updated: ${ok}, failed: ${failed.length}`);
  for (const f of failed) console.log(`  ✗ ${f}`);
  console.log(ok > 0 ? "DEMO_USER_PASSWORD written to .env.local (not printed)." : "No changes written.");
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
