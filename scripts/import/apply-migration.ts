/**
 * Apply ONE migration file over SUPABASE_DB_URL inside a transaction and record it in
 * supabase_migrations.schema_migrations (same ledger the Supabase CLI/MCP use). Refuses if the
 * version is already recorded. Never prints the connection string.
 *   npx tsx scripts/import/apply-migration.ts supabase/migrations/<file>.sql
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { config } from "dotenv";
import pg from "pg";
config({ path: ".env.local", quiet: true });

(async () => {
  const file = process.argv[2];
  const m = /^(\d{14})_(.+)\.sql$/.exec(basename(file));
  if (!m) throw new Error("expected <version>_<name>.sql");
  const [, version, name] = m;
  const sql = readFileSync(file, "utf8");
  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const done = await client.query("select 1 from supabase_migrations.schema_migrations where version = $1", [version]);
    if (done.rowCount) throw new Error(`version ${version} already applied`);
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)", [version, name, [sql]]);
    await client.query("commit");
    console.log(`applied ${version}_${name}`);
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    console.error("✗", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
