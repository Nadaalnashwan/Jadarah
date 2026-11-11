/**
 * Loads supabase/seed/demo_seed.sql and runs public.seed_demo(DEMO_USER_PASSWORD)
 * over a direct Postgres connection (SUPABASE_DB_URL, privileged, server-side only).
 *
 *   npm run seed:generate && SUPABASE_DB_URL=... DEMO_USER_PASSWORD=... npm run demo:seed
 *
 * Refuses when JADARAH_ENV=production; the SQL function also refuses when
 * platform_settings.environment = 'production'.
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  if (process.env.JADARAH_ENV === "production")
    throw new Error("Refusing to seed demo data: JADARAH_ENV=production");
  const dbUrl = process.env.SUPABASE_DB_URL;
  const password = process.env.DEMO_USER_PASSWORD;
  if (!dbUrl)
    throw new Error(
      "SUPABASE_DB_URL is required (Supabase → Project Settings → Database → connection string).",
    );
  if (!password || password.length < 12) throw new Error("DEMO_USER_PASSWORD (≥12 chars) is required.");
  const { default: pg } = await import("pg").catch(() => {
    throw new Error("Install the optional dev dependency first: npm i -D pg @types/pg");
  });
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(readFileSync("supabase/seed/demo_seed.sql", "utf8"));
    const { rows } = await client.query("select public.seed_demo($1) as result", [password]);
    console.log("✓ Demo seeded:", rows[0].result);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
