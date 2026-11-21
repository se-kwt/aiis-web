#!/usr/bin/env node
// Byte-compares a built Eleventy output file against the pre-build baseline.
//
// Usage: node tools/compare-output.mjs <relativePath> [ref=baseline-static-site]
//
// Reads `_site/<relativePath>` from disk and `site/<relativePath>` as it
// existed at git ref `ref` (default: the `baseline-static-site` tag), compares
// them as Buffers, and exits 0 silently on a match or prints a short diff
// summary and exits 1 on a mismatch. This is the test oracle every later task
// in the Eleventy/Decap migration plan uses to confirm the new build produces
// byte-identical output to the original hand-built site.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const [relativePath, ref = "baseline-static-site"] = process.argv.slice(2);

if (!relativePath) {
  console.error("Usage: node tools/compare-output.mjs <relativePath> [ref=baseline-static-site]");
  process.exit(1);
}

let actual;
try {
  actual = readFileSync(`_site/${relativePath}`);
} catch (err) {
  console.error(`Could not read built output _site/${relativePath}: ${err.message}`);
  process.exit(1);
}

let expected;
try {
  expected = execFileSync("git", ["show", `${ref}:site/${relativePath}`]);
} catch (err) {
  console.error(`Could not read baseline ${ref}:site/${relativePath}: ${err.message}`);
  process.exit(1);
}

if (Buffer.compare(actual, expected) === 0) {
  process.exit(0);
}

// Mismatch: print a short line-based diff summary (first ~10 differing lines).
const actualLines = actual.toString("utf8").split("\n");
const expectedLines = expected.toString("utf8").split("\n");
const maxLines = Math.max(actualLines.length, expectedLines.length);

console.error(`Mismatch: _site/${relativePath} differs from ${ref}:site/${relativePath}`);
console.error(`  built: ${actual.length} bytes, ${actualLines.length} lines`);
console.error(`  baseline: ${expected.length} bytes, ${expectedLines.length} lines`);

let shown = 0;
for (let i = 0; i < maxLines && shown < 10; i++) {
  const a = actualLines[i];
  const e = expectedLines[i];
  if (a !== e) {
    console.error(`  line ${i + 1}:`);
    console.error(`    - baseline: ${e === undefined ? "<missing>" : e}`);
    console.error(`    + built:    ${a === undefined ? "<missing>" : a}`);
    shown++;
  }
}

process.exit(1);
