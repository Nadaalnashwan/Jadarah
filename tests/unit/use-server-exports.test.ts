import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Next.js rejects 'use server' modules that export anything but async functions — at runtime, as a
 * 500 on every action of the page (this broke CV upload once). Guard it statically.
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

describe("'use server' modules", () => {
  it("export only async functions (and types)", () => {
    const offenders = files("src")
      .filter((f) => /^\s*["']use server["']/.test(readFileSync(f, "utf8")))
      .flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .filter((l) => /^export\s+(const|let|var|class|enum|default\s+(?!async))/.test(l) || /^export\s+\{/.test(l))
          .map((l) => `${f}: ${l.trim()}`),
      );
    expect(offenders).toEqual([]);
  });
});
