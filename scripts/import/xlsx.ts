/**
 * Minimal read-only XLSX reader for the import scripts (no dependencies; uses the system `unzip`).
 * Handles shared strings, inline strings, numbers and booleans. Untrusted input is only parsed.
 */
import { execFileSync } from "node:child_process";

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

export function readXlsx(file: string, only?: (sheetName: string) => boolean): Sheet[] {
  const wb = part(file, "xl/workbook.xml") ?? "";
  const rels = part(file, "xl/_rels/workbook.xml.rels") ?? "";
  const relMap = new Map([...rels.matchAll(re("<~Relationship\\b[^>]*>"))].map((m) => {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1] ?? "";
    const target = /Target="([^"]+)"/.exec(m[0])?.[1] ?? "";
    return [id, target.replace(/^\/?xl\//, "").replace(/^\//, "")];
  }));
  const ssXml = part(file, "xl/sharedStrings.xml") ?? "";
  const shared = [...ssXml.matchAll(re("<~si>([\\s\\S]*?)</~si>"))].map((m) => texts(m[1]));
  return [...wb.matchAll(re("<~sheet\\b[^>]*/?>"))].flatMap((m) => {
    const name = decode(/name="([^"]+)"/.exec(m[0])?.[1] ?? "");
    if (only && !only(name)) return [];
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1] ?? "";
    const xml = part(file, `xl/${relMap.get(rid) ?? ""}`) ?? "";
    const rows: string[][] = [];
    for (const r of xml.matchAll(re("<~row\\b[^>]*>([\\s\\S]*?)</~row>"))) {
      const row: string[] = [];
      for (const c of r[1].matchAll(re("<~c\\b([^>]*?)(?:/>|>([\\s\\S]*?)</~c>)"))) {
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
      if (row.some((x) => x)) rows.push(row);
    }
    return [{ name, rows }];
  });
}

export function sheetNames(file: string): string[] {
  const wb = part(file, "xl/workbook.xml") ?? "";
  return [...wb.matchAll(re("<~sheet\\b[^>]*/?>"))].map((m) => decode(/name="([^"]+)"/.exec(m[0])?.[1] ?? ""));
}
