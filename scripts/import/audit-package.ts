/**
 * Read-only audit of the assessment/reference package (untrusted data — parsed, never executed).
 *   npx tsx scripts/import/audit-package.ts <extracted-package-dir> [--sheet "<workbook substring>"]
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { readXlsx } from "./xlsx";

const root = process.argv[2];
const focus = process.argv.indexOf("--sheet") > 0 ? process.argv[process.argv.indexOf("--sheet") + 1] : null;
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
(async () => {
  for (const f of walk(root).filter((f) => f.endsWith(".xlsx")).sort()) {
    const rel = relative(root, f);
    if (focus && !rel.includes(focus)) continue;
    console.log(`\n=== ${rel}`);
    for (const ws of await readXlsx(f)) {
      console.log(`  [${ws.name}] rows=${ws.rows.length}`);
      const show = focus ? ws.rows.length : 2;
      for (const r of ws.rows.slice(0, show)) console.log("    | " + r.map((c) => c.replace(/\s+/g, " ").slice(0, focus ? 160 : 40)).join(" | "));
    }
  }
})();
