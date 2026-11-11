/**
 * Minimal read-only XLSX reader for the import scripts (no dependencies; uses the system `unzip`).
 * Handles shared strings, inline strings, numbers and booleans. Untrusted input is only parsed.
 */
import { execFileSync, spawn } from "node:child_process";

const part = (file: string, name: string): string | null => {
  try {
    return execFileSync("unzip", ["-p", file, name], { maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
  } catch {
    return null;
  }
};
const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
// Namespace-agnostic: matches <t>, <x:t>, etc.
const P = "(?:[A-Za-z0-9]+:)?";
const re = (src: string, flags = "g") => new RegExp(src.replace(/~/g, P), flags);
const texts = (xml: string) => [...xml.matchAll(re("<~t(?:\\s[^>]*)?>([\\s\\S]*?)</~t>"))].map((m) => decode(m[1])).join("");
const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

export type Sheet = { name: string; rows: string[][] };

/**
 * Stream a worksheet's rows. Some source workbooks format every row down to 1,048,576 (40–110 MB of
 * XML); streaming stops after `emptyRun` consecutive rows without values once data has been seen.
 */
function streamRows(file: string, partName: string, shared: string[], emptyRun = 3000): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const proc = spawn("unzip", ["-p", file, partName]);
    const rows: string[][] = [];
    let buf = "";
    let empties = 0;
    let seen = false;
    let done = false;
    const rowRe = re("<~row\\b[^>]*?(?:/>|>([\\s\\S]*?)</~row>)");
    const finish = () => {
      if (done) return;
      done = true;
      proc.kill();
      resolve(rows);
    };
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => {
      if (done) return;
      buf += chunk;
      let m: RegExpExecArray | null;
      rowRe.lastIndex = 0;
      let consumed = 0;
      while ((m = rowRe.exec(buf))) {
        consumed = rowRe.lastIndex;
        const row: string[] = [];
        for (const c of (m[1] ?? "").matchAll(re("<~c\\b([^>]*?)(?:/>|>([\\s\\S]*?)</~c>)"))) {
          const attrs = c[1];
          const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
          const t = /t="([^"]+)"/.exec(attrs)?.[1];
          const body = c[2] ?? "";
          const v = re("<~v>([\\s\\S]*?)</~v>", "").exec(body)?.[1];
          let val = "";
          if (t === "s" && v !== undefined) val = shared[Number(v)] ?? "";
          else if (t === "inlineStr") val = texts(body);
          else if (v !== undefined) val = decode(v);
          const idx = ref ? colIndex(ref) : row.length;
          while (row.length < idx) row.push("");
          row[idx] = val.trim();
        }
        if (row.some((x) => x)) {
          rows.push(row);
          seen = true;
          empties = 0;
        } else if (seen && ++empties >= emptyRun) return finish();
      }
      buf = buf.slice(consumed);
    });
    proc.on("close", finish);
    proc.on("error", reject);
  });
}

export async function readXlsx(file: string, only?: (sheetName: string) => boolean): Promise<Sheet[]> {
  const wb = part(file, "xl/workbook.xml") ?? "";
  const rels = part(file, "xl/_rels/workbook.xml.rels") ?? "";
  const relMap = new Map([...rels.matchAll(re("<~Relationship\\b[^>]*>"))].map((m) => {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1] ?? "";
    const target = /Target="([^"]+)"/.exec(m[0])?.[1] ?? "";
    return [id, target.replace(/^\/?xl\//, "").replace(/^\//, "")];
  }));
  const ssXml = part(file, "xl/sharedStrings.xml") ?? "";
  const shared = [...ssXml.matchAll(re("<~si>([\\s\\S]*?)</~si>"))].map((m) => texts(m[1]));
  const out: Sheet[] = [];
  for (const m of wb.matchAll(re("<~sheet\\b[^>]*/?>"))) {
    const name = decode(/name="([^"]+)"/.exec(m[0])?.[1] ?? "");
    if (only && !only(name)) continue;
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1] ?? "";
    out.push({ name, rows: await streamRows(file, `xl/${relMap.get(rid) ?? ""}`, shared) });
  }
  return out;
}

export function sheetNames(file: string): string[] {
  const wb = part(file, "xl/workbook.xml") ?? "";
  return [...wb.matchAll(re("<~sheet\\b[^>]*/?>"))].map((m) => decode(/name="([^"]+)"/.exec(m[0])?.[1] ?? ""));
}
