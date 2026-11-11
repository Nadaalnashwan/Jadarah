// Regenerates /public/brand/*.svg and src/app/icon.svg from the approved symbol geometry in src/components/brand/logo.tsx.
import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync("src/components/brand/logo.tsx", "utf8");
const get = (k) => src.match(new RegExp(`\\b${k}:\\s*\\n?\\s*"([^"]+)"`))[1];
const S = Object.fromEntries(["viewBox", "back", "tunnel", "middle", "front", "door", "jamb", "path"].map((k) => [k, get(k)]));
const defs = `<defs>
<linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6A8CFF"/><stop offset="1" stop-color="#3B6CFF"/></linearGradient>
<linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A9B8FF"/><stop offset="1" stop-color="#8A8DFF"/></linearGradient>
<linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4C63E8"/><stop offset="1" stop-color="#2E46C9"/></linearGradient>
<linearGradient id="c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4E62E6"/><stop offset=".6" stop-color="#5C6CF0"/><stop offset="1" stop-color="#4459E2"/></linearGradient>
<linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFF7E8"/></linearGradient>
<linearGradient id="p" x1=".8" y1="0" x2=".1" y2="1"><stop offset="0" stop-color="#FFF7E8"/><stop offset=".55" stop-color="#FCE7EC"/><stop offset="1" stop-color="#C9C3FF" stop-opacity=".2"/></linearGradient>
</defs>`;
const body = `<path d="${S.back}" fill="url(#a)" opacity=".92"/><path d="${S.tunnel}" fill="url(#t)"/><path d="${S.middle}" fill="url(#b)" fill-rule="evenodd" opacity=".74"/><path d="${S.front}" fill="url(#c)" fill-rule="evenodd" opacity=".92"/><path d="${S.door}" fill="url(#d)"/><path d="${S.jamb}" fill="#BFC8FF" opacity=".95"/><path d="${S.path}" fill="url(#p)"/>`;
const symbol = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${S.viewBox}" role="img" aria-label="JADARAH symbol">${defs}${body}</svg>\n`;
writeFileSync("public/brand/jadarah-symbol.svg", symbol);
writeFileSync("public/brand/jadarah-symbol-dark.svg", symbol);
// The symbol is placed through a nested <svg> using its own viewBox, so it is never cropped or distorted.
const [, , vw, vh] = S.viewBox.split(/\s+/).map(Number);
const place = (x, y, h) => `<svg x="${x}" y="${y}" width="${+(h * vw / vh).toFixed(2)}" height="${h}" viewBox="${S.viewBox}">${body}</svg>`;
const lockup = (ink) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="12 0 300 120" role="img" aria-label="JADARAH | جدارة">${defs}
<text x="110" y="66" text-anchor="middle" font-family="'IBM Plex Sans Arabic', sans-serif" font-weight="700" font-size="58" fill="${ink}">جَدارة</text>
<text x="110" y="98" text-anchor="middle" font-family="Manrope, sans-serif" font-weight="600" font-size="15" letter-spacing="9" fill="${ink}">JADARAH</text>
${place(204, 8, 104)}</svg>\n`;
writeFileSync("public/brand/jadarah-logo-light.svg", lockup("#0D1B3F"));
writeFileSync("public/brand/jadarah-logo-dark.svg", lockup("#FFFFFF"));
// App icon (board: navy rounded tile with the symbol)
writeFileSync("src/app/icon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${defs}<rect width="128" height="128" rx="28" fill="#0D1B3F"/>${place(+(64 - (100 * vw / vh) / 2).toFixed(2), 14, 100)}</svg>\n`);
console.log("brand assets written");
