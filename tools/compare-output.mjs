#!/usr/bin/env node
// Byte-compares a built Eleventy output file against the pre-build baseline.
//
// Usage: node tools/compare-output.mjs <relativePath> [ref=baseline-static-site]
//
// Reads the built output from disk and `site/<relativePath>` as it existed at
// git ref `ref` (default: the `baseline-static-site` tag), compares them as
// Buffers, and exits 0 silently on a match or prints a short diff summary and
// exits 1 on a mismatch. This is the test oracle every later task in the
// Eleventy/Decap migration plan uses to confirm the new build produces
// byte-identical output to the original hand-built site.
//
// The baseline side is the flat `site/<relativePath>` file, with one
// intentional, documented normalization applied before comparing (see
// BASELINE_PATH_REWRITES below). The built side tries `_site/<relativePath>`
// first; if that doesn't exist and `relativePath` ends in `.html`, it falls
// back to `_site/<relativePath without .html>/index.html` — this lets a page
// built with an extensionless-URL permalink (e.g. `/our-story/index.html`,
// which Eleventy writes to `_site/our-story/index.html`) still be checked
// with the same flat `<name>.html` argument used for every other page.
//
// Baseline normalization: the original hand-built site was a flat directory
// of files at the site root, so document-relative asset references
// (`href="css/...`, `src="js/...`, `src="assets/...`) resolved correctly from
// every page. This branch's Eleventy build emits nested pretty-permalink
// directories (`_site/<slug>/index.html`) for every page except the
// homepage, so those same relative references would 404 once served; the
// chrome templates (base.njk, header.njk, menu.njk, footer.njk, home.njk's
// shared icons) were fixed to use root-relative paths (`/css/...`,
// `/js/...`, `/assets/...`) instead. That is a deliberate, one-way
// difference from the baseline — not a regression — so before comparing,
// the baseline bytes get the same substitutions applied, via
// BASELINE_PATH_REWRITES below.
//
// The rewrites list EXACT literal attribute values (e.g.
// `src="assets/logos/crest-web.png"`), not a generic `src="assets/` prefix.
// A generic prefix rewrite would also touch the homepage's own
// content-driven asset paths (hero video, promise/division/learning/values
// photos — all read unprefixed straight out of content/homepage.json, e.g.
// `"video": "assets/video/hero.mp4"`), which were correctly left unrooted
// because the homepage alone is always built at the site root and was never
// part of this fix. Keeping the rewrites exact avoids that collateral
// match; every other byte must still match exactly.

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Literal (non-regex) substring substitutions applied to the baseline bytes
// only, to account for the root-relative chrome asset paths described
// above. `href="css/` is left as a prefix (it is followed by a
// per-stylesheet filename, e.g. `css/tokens.css`, `css/header.css`) since
// nothing else in the site uses that substring; every other entry is the
// exact, full attribute value that changed in the templates, so this list
// never touches the unrelated, intentionally-unrooted `assets/...` paths
// that come from content/homepage.json.
const BASELINE_PATH_REWRITES = [
  ['href="css/', 'href="/css/'],
  ['src="js/main.js"', 'src="/js/main.js"'],
  ['src="assets/logos/crest-web.png"', 'src="/assets/logos/crest-web.png"'],
  ['src="assets/logos/wordmark-web.png"', 'src="/assets/logos/wordmark-web.png"'],
  ['src="assets/art/values-spiral.svg"', 'src="/assets/art/values-spiral.svg"'],
  ['src="assets/art/closing-spirograph.svg"', 'src="/assets/art/closing-spirograph.svg"'],
];

const [relativePath, ref = "baseline-static-site"] = process.argv.slice(2);

if (!relativePath) {
  console.error("Usage: node tools/compare-output.mjs <relativePath> [ref=baseline-static-site]");
  process.exit(1);
}

let builtPath = `_site/${relativePath}`;
if (!existsSync(builtPath) && relativePath.endsWith(".html")) {
  const fallbackPath = `_site/${relativePath.slice(0, -".html".length)}/index.html`;
  if (existsSync(fallbackPath)) builtPath = fallbackPath;
}

let actual;
try {
  actual = readFileSync(builtPath);
} catch (err) {
  console.error(`Could not read built output ${builtPath}: ${err.message}`);
  process.exit(1);
}

let expected;
try {
  expected = execFileSync("git", ["show", `${ref}:site/${relativePath}`]);
} catch (err) {
  console.error(`Could not read baseline ${ref}:site/${relativePath}: ${err.message}`);
  process.exit(1);
}

{
  let expectedText = expected.toString("utf8");
  for (const [from, to] of BASELINE_PATH_REWRITES) {
    expectedText = expectedText.split(from).join(to);
  }
  expected = Buffer.from(expectedText, "utf8");
}

if (Buffer.compare(actual, expected) === 0) {
  process.exit(0);
}

// Mismatch: print a short line-based diff summary (first ~10 differing lines).
const actualLines = actual.toString("utf8").split("\n");
const expectedLines = expected.toString("utf8").split("\n");
const maxLines = Math.max(actualLines.length, expectedLines.length);

console.error(`Mismatch: ${builtPath} differs from ${ref}:site/${relativePath}`);
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
