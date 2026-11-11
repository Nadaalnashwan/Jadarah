/** Read-only: find skill dictionary sheets in each sector workbook and count normalized skills. */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readXlsx, sheetNames } from "./xlsx";

const dir = process.argv[2];
(async () => {
for (const f of readdirSync(dir).filter((x) => x.endsWith(".xlsx")).sort()) {
  const file = join(dir, f);
  const names = sheetNames(file);
  const wanted = names.filter((n) => /وصف المهارات/.test(n));
  const sheets = await readXlsx(file, (n) => wanted.includes(n));
  console.log(`\n${f}\n  sheets: ${names.length} | description sheets: ${wanted.map((w) => `"${w.trim()}"`).join(", ") || "NONE"}`);
  for (const s of sheets) {
    const hdrIdx = s.rows.findIndex((r) => r.some((c) => /وصف المهار/.test(c)));
    const body = s.rows.slice(hdrIdx + 1).filter((r) => r.filter(Boolean).length >= 2);
    console.log(`  [${s.name.trim()}] header_row=${hdrIdx} skills=${body.length} sample: ${body.slice(0, 2).map((r) => r.filter(Boolean)[0]).join(" ؛ ")}`);
  }
}
})();
