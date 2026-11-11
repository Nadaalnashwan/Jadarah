/** Read-only: verify package hashes against 04_Admin/INVENTORY.csv and classify PDFs (text vs image-only). */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";

const root = process.argv[2];
(async () => {
  const inv = readFileSync(join(root, "04_Admin/INVENTORY.csv"), "utf8").replace(/^﻿/, "").trim().split("\n").slice(1);
  let ok = 0, bad = 0;
  const pdfs: string[] = [];
  for (const line of inv) {
    const [path, , sha] = line.split(",");
    try {
      const h = createHash("sha256").update(readFileSync(join(root, path))).digest("hex");
      if (h === sha) ok++; else { bad++; console.log("HASH MISMATCH", path); }
    } catch { bad++; console.log("MISSING", path); }
    if (path.endsWith(".pdf")) pdfs.push(path);
  }
  console.log(`inventory entries=${inv.length} hash_ok=${ok} problems=${bad}`);
  for (const p of pdfs) {
    const buf = new Uint8Array(readFileSync(join(root, p)));
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    const t = (Array.isArray(text) ? text.join(" ") : text).replace(/\s+/g, " ").trim();
    console.log(`${t.length > 200 ? "TEXT " : "IMAGE"} pages=${pdf.numPages} chars=${t.length} ${p}`);
  }
})();
