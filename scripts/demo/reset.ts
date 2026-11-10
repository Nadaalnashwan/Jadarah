/**
 * Removes all is_demo identities and companies by calling public.demo_reset()
 * over a privileged Postgres connection. Refuses on production in two places:
 * here (JADARAH_ENV) and inside the SQL function (platform_settings.environment).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  if (process.env.JADARAH_ENV === "production") throw new Error("Refusing to reset: JADARAH_ENV=production");
  if (!process.argv.includes("--yes")) throw new Error("Pass --yes to confirm deleting all demo data.");
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) throw new Error("SUPABASE_DB_URL is required.");
  const { default: pg } = await import("pg").catch(() => {
    throw new Error("Install the optional dev dependency first: npm i -D pg @types/pg");
  });
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { rows } = await client.query("select public.demo_reset() as result");
    console.log("✓ Demo reset:", rows[0].result);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
